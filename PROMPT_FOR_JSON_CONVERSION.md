# SkinLab Excel → JSON変換プロンプト

以下のプロンプトを他のAIに渡して、Excelデータの変換を依頼してください。
Excelファイルを添付してからこのプロンプトを貼り付けてください。

---

## プロンプト本文

添付のExcelファイル（SkinLab成分データベース）を、TypeScript のソースコードに変換してください。
2つのファイルを出力します。

---

### 入力（Excel）

#### シート1: `ingredients`
| 列名 | 説明 |
|------|------|
| `id` | 一意のID |
| `name_cosmetic` | 化粧品表示名称 |
| `name_quasi_drug` | 医薬部外品名（空欄の場合あり） |
| `name_inci` | INCI名 |
| `aliases` | パイプ `\|` 区切りの別名 |
| `ingredient_type` | 成分分類（`水性成分` / `油性成分` / `界面活性剤` / `有効成分` / `その他`） |
| `categories` | パイプ `\|` 区切りの効能カテゴリ（空欄の場合あり） |
| `irritation` | `low` / `medium` / `high` |
| `photosensitivity` | `TRUE` / `FALSE` |
| `comedogenic` | 数値 0-5 |
| `safety_note` | 安全性メモ（空欄の場合あり） |
| `description` | 成分説明 |

#### シート2: `research`
| 列名 | 説明 |
|------|------|
| `ingredient_id` | シート1の `id` に対応 |
| `title` | 論文タイトル |
| `journal` | 掲載誌名 |
| `year` | 発表年 |
| `finding` | 主な知見（日本語） |

---

### 出力ファイル1: `types/index.ts`

以下の内容をそのまま出力してください（Excel内容に関わらず固定）：

```typescript
// types/index.ts

/** 効能カテゴリ */
export type CategoryKey =
  | 'brightening'
  | 'moisturizing'
  | 'anti_inflammatory'
  | 'antioxidant'
  | 'exfoliating'
  | 'anti_aging';

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  brightening: '美白',
  moisturizing: '保湿',
  anti_inflammatory: '抗炎症',
  antioxidant: '抗酸化',
  exfoliating: '角質ケア',
  anti_aging: 'エイジング',
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
```

---

### 出力ファイル2: `data/ingredients.ts`

Excelのデータを以下の形式で TypeScript の配列に変換してください。

```typescript
// data/ingredients.ts
import { IngredientEntry } from '../types';

export const INGREDIENTS_DB: IngredientEntry[] = [
  {
    id: 'ascorbic_acid',
    name_cosmetic: 'アスコルビン酸',
    name_quasi_drug: 'L-アスコルビン酸',
    name_inci: 'Ascorbic Acid',
    aliases: ['ビタミンC', 'ピュアビタミンC'],
    ingredient_type: '有効成分',
    categories: ['brightening', 'antioxidant', 'anti_aging'],
    safety: {
      irritation: 'medium',
      photosensitivity: true,
      comedogenic: 0,
      note: '高濃度では刺激あり。朝使用時は日焼け止め必須。酸化しやすいため冷暗所保管。',
    },
    research: [
      {
        title: 'Topical L-Ascorbic Acid: Percutaneous Absorption Studies',
        journal: 'Dermatologic Surgery',
        year: 2001,
        finding: '15%濃度で皮膚組織中のVC量が最大化',
      },
      {
        title: 'Vitamin C in dermatology',
        journal: 'Indian Dermatol Online J',
        year: 2013,
        finding: 'メラニン合成の複数段階で抑制効果を確認',
      },
    ],
    description: '最も研究が豊富なビタミンC。直接型で即効性が高いが、安定性が低く酸化しやすい。',
  },
  // ... 以降、全成分を同じ形式で出力
];
```

---

### 変換ルール

#### フィールドマッピング

| Excel列 | TypeScript フィールド | 変換方法 |
|---------|----------------------|---------|
| `id` | `id` | そのまま |
| `name_cosmetic` | `name_cosmetic` | そのまま |
| `name_quasi_drug` | `name_quasi_drug` | 空欄の場合は `''`（空文字列） |
| `name_inci` | `name_inci` | そのまま |
| `aliases` | `aliases` | パイプ `\|` で分割して文字列配列に。空欄の場合は `[]` |
| `ingredient_type` | `ingredient_type` | そのまま（`'水性成分'` / `'油性成分'` / `'界面活性剤'` / `'有効成分'` / `'その他'`） |
| `categories` | `categories` | パイプ `\|` で分割して文字列配列に。空欄の場合は `[]` |
| `irritation` | `safety.irritation` | そのまま |
| `photosensitivity` | `safety.photosensitivity` | `TRUE` → `true`, `FALSE` → `false` |
| `comedogenic` | `safety.comedogenic` | そのまま（数値） |
| `safety_note` | `safety.note` | 空欄の場合は `''` |
| `description` | `description` | そのまま |

#### researchの結合

`research` シートのデータを `ingredient_id` でグルーピングし、対応する成分の `research` 配列に格納する。
`research` シートに該当がない成分は `research: []` とする。

---

### フォーマット規則

1. **インデント**: スペース2つ
2. **末尾カンマ**: あり（trailing comma）
3. **文字列のクォート**: シングルクォート `'`
4. **配列**: 要素が1-3個の短い配列は1行で書く。4個以上は改行して1要素1行
5. **research配列**: 各論文オブジェクトは改行して書く（上の例の通り）
6. **safety オブジェクト**: 改行して書く
7. **空文字列 `''`** と **空配列 `[]`** は省略せず明示的に書く
8. **コメント**: 成分分類ごとにコメント行を入れる（例: `// ── 水性成分 ──`）
9. **並び順**: `ingredient_type` でグルーピングして以下の順で並べる：
   - `有効成分`（最初に配置）
   - `水性成分`
   - `油性成分`
   - `界面活性剤`
   - `その他`

---

### 出力形式

- 2ファイル（`types/index.ts` と `data/ingredients.ts`）の**TypeScriptソースコード全文**を出力してください
- そのままファイルに保存してアプリで使える状態にしてください
- **全成分を漏れなく出力**してください（省略・「以下同様」は不可）

---

### 品質チェックリスト

出力前に以下を確認してください：
- [ ] Excelの全行が `INGREDIENTS_DB` 配列に含まれていること（件数を数えて一致確認）
- [ ] `research` シートの全論文が対応する成分の `research` 配列に含まれていること
- [ ] `name_quasi_drug` が空欄の行は `''` になっていること
- [ ] `categories` が空欄の行は `[]` になっていること
- [ ] `photosensitivity` が `true` / `false`（boolean）になっていること（文字列 `'TRUE'` ではない）
- [ ] `ingredient_type` の値が5種のいずれかであること
- [ ] TypeScriptとして構文エラーがないこと（カンマ忘れ、クォート閉じ忘れ等）
