// services/matcher.ts
import { INGREDIENTS_DB } from '../data/ingredients';
import {
  IngredientEntry,
  MatchedIngredient,
  CategoryKey,
  ScanResult,
} from '../types';

/**
 * OCRで取得した成分名リストをDBとマッチングする
 */
export function matchIngredients(ocrTexts: string[]): MatchedIngredient[] {
  return ocrTexts.map((raw, index) => {
    const entry = findIngredient(raw);
    return {
      raw_text: raw,
      entry,
      order: index + 1,
    };
  });
}

/**
 * 成分名テキストからDBを検索する
 * 完全一致 → alias一致 → INCI一致 → 部分一致
 */
function findIngredient(text: string): IngredientEntry | null {
  const normalized = normalizeText(text);

  const exactMatch = INGREDIENTS_DB.find(
    (entry) => normalizeText(entry.name_ja) === normalized
  );
  if (exactMatch) return exactMatch;

  const aliasMatch = INGREDIENTS_DB.find((entry) =>
    entry.aliases.some((alias) => normalizeText(alias) === normalized)
  );
  if (aliasMatch) return aliasMatch;

  const inciMatch = INGREDIENTS_DB.find(
    (entry) => normalizeText(entry.name_inci) === normalized
  );
  if (inciMatch) return inciMatch;

  const partialMatch = INGREDIENTS_DB.find((entry) => {
    const entryName = normalizeText(entry.name_ja);
    return (
      (entryName.length >= 3 && normalized.includes(entryName)) ||
      (normalized.length >= 3 && entryName.includes(normalized))
    );
  });
  if (partialMatch) return partialMatch;

  const partialAliasMatch = INGREDIENTS_DB.find((entry) =>
    entry.aliases.some((alias) => {
      const normalizedAlias = normalizeText(alias);
      return (
        (normalizedAlias.length >= 3 && normalized.includes(normalizedAlias)) ||
        (normalized.length >= 3 && normalizedAlias.includes(normalized))
      );
    })
  );
  if (partialAliasMatch) return partialAliasMatch;

  return null;
}

/**
 * テキスト正規化
 */
function normalizeText(text: string): string {
  return text
    .replace(/[\uff01-\uff5e]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
    )
    .replace(/\u3000/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, '')
    .trim();
}

/**
 * マッチした成分をカテゴリ別にグルーピングする
 * 1つの成分が複数カテゴリに属する場合、それぞれのカテゴリに含まれる
 */
export function groupByCategory(
  ingredients: MatchedIngredient[]
): Record<CategoryKey, MatchedIngredient[]> {
  const groups: Record<CategoryKey, MatchedIngredient[]> = {
    brightening: [],
    moisturizing: [],
    anti_inflammatory: [],
    antioxidant: [],
    exfoliating: [],
    anti_aging: [],
  };

  for (const item of ingredients) {
    if (!item.entry) continue;
    for (const cat of item.entry.categories) {
      if (groups[cat]) {
        groups[cat].push(item);
      }
    }
  }

  return groups;
}

/**
 * スキャン結果をまとめて生成する
 */
export function createScanResult(
  ocrTexts: string[],
  imageUri: string,
  productName: string = ''
): ScanResult {
  const ingredients = matchIngredients(ocrTexts);

  return {
    id: Date.now().toString(),
    product_name: productName,
    scanned_at: new Date().toISOString(),
    image_uri: imageUri,
    ingredients,
  };
}

/**
 * デバッグ用：マッチ率を表示
 */
export function getMatchStats(ingredients: MatchedIngredient[]) {
  const total = ingredients.length;
  const matched = ingredients.filter((i) => i.entry !== null).length;
  const unmatched = ingredients
    .filter((i) => i.entry === null)
    .map((i) => i.raw_text);

  return {
    total,
    matched,
    matchRate: total > 0 ? Math.round((matched / total) * 100) : 0,
    unmatchedTexts: unmatched,
  };
}

/**
 * 貼り付けられたテキストから成分名リストをパースする
 * 対応区切り: 、 , ・ ， / 改行
 */
export function parseIngredientText(text: string): string[] {
  // 「全成分：水、グリセリン…」のようなプレフィックスを除去
  let cleaned = text.replace(
    /^[\s\u3000]*(全成分|成分|配合成分|Ingredients)\s*[:：]\s*/i,
    ''
  );

  // 各種区切り文字をカンマに統一
  const normalized = cleaned
    .replace(/[、，・\/]/g, ',')
    .replace(/\n+/g, ',');

  // 分割 → トリム → 空文字除外
  return normalized
    .split(',')
    .map((s) => s.replace(/[\s\u3000]+/g, ' ').trim())
    .filter((s) => s.length > 0);
}
