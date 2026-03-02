// types/index.ts

/** 効能カテゴリ */
export type CategoryKey =
  | 'brightening'
  | 'moisturizing'
  | 'anti_inflammatory'
  | 'antioxidant'
  | 'exfoliating'
  | 'anti_aging'
  | 'oil_based'
  | 'uv_filter';

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  brightening: '美白',
  moisturizing: '保湿',
  anti_inflammatory: '抗炎症',
  antioxidant: '抗酸化',
  exfoliating: '角質ケア',
  anti_aging: 'エイジング',
  oil_based: '油性成分',
  uv_filter: '日焼け止め成分',
};

/** 成分分類 */
export type IngredientType = '水性成分' | '油性成分' | '界面活性剤' | '有効成分' | 'その他';

/** 成分DBの1エントリ */
export interface IngredientEntry {
  id: string;
  name_cosmetic: string;
  name_quasi_drug: string;
  name_inci: string;
  aliases: string[];
  ingredient_type: IngredientType;
  categories: CategoryKey[];
  safety: {
    irritation: 'low' | 'medium' | 'high';
    photosensitivity: boolean;
    comedogenic: number;
    note: string;
  };
  research: {
    title: string;
    journal: string;
    year: number;
    finding: string;
  }[];
  description: string;
}

/** スキャン結果の個別成分 */
export interface MatchedIngredient {
  raw_text: string;
  entry: IngredientEntry | null;
  order: number;
}

/** スキャン結果全体 */
export interface ScanResult {
  id: string;
  product_name: string;
  scanned_at: string;
  image_uri: string;
  ingredients: MatchedIngredient[];
}
