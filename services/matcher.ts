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
 * 完全一致 → alias完全一致 → INCI完全一致 → 部分一致（最長優先・5文字以上）
 */
function findIngredient(text: string): IngredientEntry | null {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  // 化粧品表示名称で完全一致
  const cosmeticMatch = INGREDIENTS_DB.find(
    (entry) => normalizeText(entry.name_cosmetic) === normalized
  );
  if (cosmeticMatch) return cosmeticMatch;

  // 医薬部外品名で完全一致
  const quasiDrugMatch = INGREDIENTS_DB.find(
    (entry) => entry.name_quasi_drug && normalizeText(entry.name_quasi_drug) === normalized
  );
  if (quasiDrugMatch) return quasiDrugMatch;

  // alias完全一致
  const aliasMatch = INGREDIENTS_DB.find((entry) =>
    entry.aliases.some((alias) => normalizeText(alias) === normalized)
  );
  if (aliasMatch) return aliasMatch;

  // INCI名完全一致
  const inciMatch = INGREDIENTS_DB.find(
    (entry) => normalizeText(entry.name_inci) === normalized
  );
  if (inciMatch) return inciMatch;

  // 部分一致: 最低5文字以上 & 最長一致を優先（短いクエリの誤爆防止）
  if (normalized.length >= 5) {
    const partialCandidates: Array<{ entry: IngredientEntry; matchLen: number }> = [];

    for (const entry of INGREDIENTS_DB) {
      const entryName = normalizeText(entry.name_cosmetic);
      // DB側の名前がクエリに含まれる（DB名が5文字以上）
      if (entryName.length >= 5 && normalized.includes(entryName)) {
        partialCandidates.push({ entry, matchLen: entryName.length });
      }
      // クエリがDB名に含まれる（クエリが5文字以上 && DB名がクエリの120%以内）
      else if (entryName.includes(normalized) && entryName.length <= normalized.length * 1.2) {
        partialCandidates.push({ entry, matchLen: normalized.length });
      }
    }

    if (partialCandidates.length > 0) {
      // 最長一致を優先
      partialCandidates.sort((a, b) => b.matchLen - a.matchLen);
      return partialCandidates[0].entry;
    }
  }

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
    oil_based: [],
    uv_filter: [],
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
 */
export function parseIngredientText(text: string): string[] {
  let cleaned = text.replace(
    /^[\s\u3000]*(全成分|成分|配合成分|Ingredients)\s*[:：]\s*/i,
    ''
  );

  const normalized = cleaned
    .replace(/[、，・]/g, ',')
    .replace(/\n+/g, ',');

  return normalized
    .split(',')
    .map((s) => s.replace(/[\s\u3000]+/g, ' ').trim())
    .filter((s) => s.length > 0);
}
