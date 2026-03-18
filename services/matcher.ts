// services/matcher.ts
import { INGREDIENTS_DB } from '../data/ingredients';
import {
  IngredientEntry,
  MatchedIngredient,
  CategoryKey,
  ScanResult,
} from '../types';
import { toHalfWidth } from '../utils/normalize';

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

// ── 検索用インデックス（初回アクセス時に構築、以降 O(1) ルックアップ） ──
let exactIndex: Map<string, IngredientEntry> | null = null;
let partialIndex: Array<{ normalized: string; entry: IngredientEntry }> | null = null;

function buildIndex(): void {
  exactIndex = new Map();
  partialIndex = [];

  for (const entry of INGREDIENTS_DB) {
    // 化粧品表示名称
    const cosmetic = normalizeText(entry.name_cosmetic);
    if (cosmetic && !exactIndex.has(cosmetic)) {
      exactIndex.set(cosmetic, entry);
    }
    // 医薬部外品名
    if (entry.name_quasi_drug) {
      const quasi = normalizeText(entry.name_quasi_drug);
      if (quasi && !exactIndex.has(quasi)) {
        exactIndex.set(quasi, entry);
      }
    }
    // INCI名
    const inci = normalizeText(entry.name_inci);
    if (inci && !exactIndex.has(inci)) {
      exactIndex.set(inci, entry);
    }
    // aliases
    for (const alias of entry.aliases) {
      const norm = normalizeText(alias);
      if (norm && !exactIndex.has(norm)) {
        exactIndex.set(norm, entry);
      }
    }
    // 部分一致用
    if (cosmetic.length >= 5) {
      partialIndex.push({ normalized: cosmetic, entry });
    }
  }
}

/**
 * 成分名テキストからDBを検索する
 * 完全一致（Map O(1)） → 部分一致（最長優先・5文字以上）
 */
function findIngredient(text: string): IngredientEntry | null {
  if (!exactIndex || !partialIndex) buildIndex();

  const normalized = normalizeText(text);
  if (!normalized) return null;

  // 完全一致（化粧品名・医薬部外品名・INCI・aliases すべてインデックス済み）
  const exact = exactIndex!.get(normalized);
  if (exact) return exact;

  // 部分一致: 最低5文字以上 & 最長一致を優先
  if (normalized.length >= 5) {
    const partialCandidates: Array<{ entry: IngredientEntry; matchLen: number }> = [];

    for (const { normalized: entryName, entry } of partialIndex!) {
      if (normalized.includes(entryName)) {
        partialCandidates.push({ entry, matchLen: entryName.length });
      } else if (entryName.includes(normalized) && entryName.length <= normalized.length * 1.2) {
        partialCandidates.push({ entry, matchLen: normalized.length });
      }
    }

    if (partialCandidates.length > 0) {
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
  return toHalfWidth(text)
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
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
