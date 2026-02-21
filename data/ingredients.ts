// data/ingredients.ts
import { IngredientEntry } from '../types';

/**
 * 成分データベース
 *
 * 💡 まず主要30成分からスタート。テストしながら徐々に追加する。
 *    最終的には200-500成分を目標に。
 *
 * aliases（別名）が OCR マッチングの精度を大きく左右する。
 * 実際の製品で OCR テストしながら aliases を増やしていくのが重要。
 */
export const INGREDIENTS_DB: IngredientEntry[] = [
  // ── ベース成分 ──
  {
    id: 'water',
    name_ja: '水',
    name_inci: 'Water',
    aliases: ['精製水', 'Aqua'],
    categories: ['moisturizing'],
    scores: { brightening: 0, moisturizing: 5, anti_inflammatory: 0, antioxidant: 0, exfoliating: 0, anti_aging: 0 },
    safety: { irritation: 'low', photosensitivity: false, comedogenic: 0, note: '' },
    research: [],
    description: '化粧品の基剤。ほとんどの製品で最も多く配合される。',
  },
  {
    id: 'glycerin',
    name_ja: 'グリセリン',
    name_inci: 'Glycerin',
    aliases: ['濃グリセリン'],
    categories: ['moisturizing'],
    scores: { brightening: 0, moisturizing: 80, anti_inflammatory: 5, antioxidant: 0, exfoliating: 0, anti_aging: 10 },
    safety: { irritation: 'low', photosensitivity: false, comedogenic: 0, note: '' },
    research: [
      { title: 'Glycerol and the skin: holistic approach', journal: 'Br J Dermatol', year: 2008, finding: '角質層の水分保持に重要な役割を果たすことを確認' },
    ],
    description: '最も基本的な保湿成分。角質層の水分を保持し、肌を柔軟にする。低刺激で安全性が高い。',
  },
  {
    id: 'bg',
    name_ja: 'BG',
    name_inci: 'Butylene Glycol',
    aliases: ['1,3-ブチレングリコール', 'ブチレングリコール'],
    categories: ['moisturizing'],
    scores: { brightening: 0, moisturizing: 50, anti_inflammatory: 0, antioxidant: 0, exfoliating: 0, anti_aging: 0 },
    safety: { irritation: 'low', photosensitivity: false, comedogenic: 1, note: '' },
    research: [],
    description: '保湿剤・溶剤として広く使用。グリセリンよりさっぱりした使用感。防腐効果も若干あり。',
  },
  {
    id: 'dpg',
    name_ja: 'DPG',
    name_inci: 'Dipropylene Glycol',
    aliases: ['ジプロピレングリコール'],
    categories: ['moisturizing'],
    scores: { brightening: 0, moisturizing: 40, anti_inflammatory: 0, antioxidant: 0, exfoliating: 0, anti_aging: 0 },
    safety: { irritation: 'low', photosensitivity: false, comedogenic: 0, note: '' },
    research: [],
    description: 'BGに近い保湿剤。さっぱりとした質感。',
  },

  // ── ビタミンC系 ──
  {
    id: 'ascorbic_acid',
    name_ja: 'アスコルビン酸',
    name_inci: 'Ascorbic Acid',
    aliases: ['ビタミンC', 'L-アスコルビン酸', 'ピュアビタミンC'],
    categories: ['brightening', 'antioxidant', 'anti_aging'],
    scores: { brightening: 90, moisturizing: 0, anti_inflammatory: 30, antioxidant: 95, exfoliating: 10, anti_aging: 80 },
    safety: { irritation: 'medium', photosensitivity: true, comedogenic: 0, note: '高濃度では刺激あり。朝使用時は日焼け止め必須。酸化しやすいため冷暗所保管。' },
    research: [
      { title: 'Topical L-Ascorbic Acid: Percutaneous Absorption Studies', journal: 'Dermatologic Surgery', year: 2001, finding: '15%濃度で皮膚組織中のVC量が最大化' },
      { title: 'Vitamin C in dermatology', journal: 'Indian Dermatol Online J', year: 2013, finding: 'メラニン合成の複数段階で抑制効果を確認' },
    ],
    description: '最も研究が豊富なビタミンC。直接型で即効性が高いが、安定性が低く酸化しやすい。',
  },
  {
    id: 'aa2g',
    name_ja: 'アスコルビルグルコシド',
    name_inci: 'Ascorbyl Glucoside',
    aliases: ['AA2G', 'ビタミンCグルコシド', '安定型ビタミンC'],
    categories: ['brightening', 'antioxidant'],
    scores: { brightening: 65, moisturizing: 0, anti_inflammatory: 15, antioxidant: 60, exfoliating: 0, anti_aging: 40 },
    safety: { irritation: 'low', photosensitivity: false, comedogenic: 0, note: '安定性が高く刺激が少ない。' },
    research: [
      { title: 'Skin lightening effect of AA2G', journal: 'J Cosmet Sci', year: 2004, finding: '2%濃度で8週間後に有意な美白効果' },
    ],
    description: 'ビタミンC誘導体。安定性が高く低刺激。肌の酵素で徐々にビタミンCに変換される。',
  },
  {
    id: 'apps',
    name_ja: 'パルミチン酸アスコルビルリン酸3Na',
    name_inci: 'Trisodium Ascorbyl Palmitate Phosphate',
    aliases: ['APPS', 'アプレシエ'],
    categories: ['brightening', 'antioxidant', 'anti_aging'],
    scores: { brightening: 75, moisturizing: 0, anti_inflammatory: 20, antioxidant: 75, exfoliating: 0, anti_aging: 65 },
    safety: { irritation: 'low', photosensitivity: false, comedogenic: 0, note: '' },
    research: [
      { title: 'Novel multifunctional ascorbic acid derivative', journal: 'J Cosmet Dermatol', year: 2009, finding: '水溶性・脂溶性両方の性質を持ち、従来の誘導体より高い浸透性' },
    ],
    description: '両親媒性ビタミンC誘導体。浸透性が高く、コラーゲン産生促進効果も報告されている。',
  },

  // ── ナイアシンアミド ──
  {
    id: 'niacinamide',
    name_ja: 'ナイアシンアミド',
    name_inci: 'Niacinamide',
    aliases: ['ニコチン酸アミド', 'ビタミンB3', 'VB3'],
    categories: ['brightening', 'moisturizing', 'anti_aging'],
    scores: { brightening: 70, moisturizing: 50, anti_inflammatory: 40, antioxidant: 30, exfoliating: 0, anti_aging: 60 },
    safety: { irritation: 'low', photosensitivity: false, comedogenic: 0, note: '5%以上で赤みが出る場合あり。' },
    research: [
      { title: 'Niacinamide: A B Vitamin that Improves Aging Facial Skin Appearance', journal: 'Dermatologic Surgery', year: 2005, finding: 'シワ、シミ、肌のキメ、赤みに対する改善効果を確認' },
      { title: 'The effect of niacinamide on reducing cutaneous pigmentation', journal: 'Br J Dermatol', year: 2002, finding: 'メラノソーム転送を抑制し色素沈着を軽減' },
    ],
    description: '万能型のビタミンB3誘導体。美白・バリア強化・皮脂抑制・抗シワなど多機能。',
  },

  // ── レチノイド系 ──
  {
    id: 'retinol',
    name_ja: 'レチノール',
    name_inci: 'Retinol',
    aliases: ['ビタミンA', 'VA'],
    categories: ['anti_aging', 'exfoliating'],
    scores: { brightening: 40, moisturizing: 0, anti_inflammatory: 0, antioxidant: 20, exfoliating: 60, anti_aging: 95 },
    safety: { irritation: 'high', photosensitivity: true, comedogenic: 0, note: '皮むけ・赤み（A反応）が起きやすい。妊娠中は使用不可。夜のみ使用。' },
    research: [
      { title: 'Retinoids in the treatment of skin aging', journal: 'Clin Interv Aging', year: 2006, finding: 'コラーゲン産生促進・表皮ターンオーバー正常化の強力なエビデンス' },
    ],
    description: 'エイジングケアの王道。コラーゲン産生促進、ターンオーバー正常化。刺激が強いため慣れが必要。',
  },

  // ── 美白成分 ──
  {
    id: 'tranexamic_acid',
    name_ja: 'トラネキサム酸',
    name_inci: 'Tranexamic Acid',
    aliases: ['t-AMCHA', 'TXA'],
    categories: ['brightening', 'anti_inflammatory'],
    scores: { brightening: 80, moisturizing: 0, anti_inflammatory: 60, antioxidant: 0, exfoliating: 0, anti_aging: 20 },
    safety: { irritation: 'low', photosensitivity: false, comedogenic: 0, note: '' },
    research: [
      { title: 'Topical tranexamic acid for melasma treatment', journal: 'J Cosmet Dermatol', year: 2019, finding: '肝斑の改善にハイドロキノンと同等の効果で副作用が少ない' },
    ],
    description: '医薬部外品の美白有効成分。メラニン生成のシグナルを遮断。抗炎症作用もあり敏感肌にも使いやすい。',
  },
  {
    id: 'arbutin',
    name_ja: 'アルブチン',
    name_inci: 'Arbutin',
    aliases: ['α-アルブチン', 'αアルブチン', 'β-アルブチン', 'ハイドロキノン誘導体'],
    categories: ['brightening'],
    scores: { brightening: 75, moisturizing: 0, anti_inflammatory: 5, antioxidant: 10, exfoliating: 0, anti_aging: 15 },
    safety: { irritation: 'low', photosensitivity: false, comedogenic: 0, note: '' },
    research: [
      { title: 'Inhibitory effect of alpha-arbutin on melanogenesis', journal: 'Biol Pharm Bull', year: 2004, finding: 'チロシナーゼ活性を競合的に阻害しメラニン生成を抑制' },
    ],
    description: 'ハイドロキノンの配糖体。チロシナーゼ阻害による美白効果。α型はβ型の10倍の効果。',
  },

  // ── 保湿・バリア ──
  {
    id: 'hyaluronic_acid',
    name_ja: 'ヒアルロン酸Na',
    name_inci: 'Sodium Hyaluronate',
    aliases: ['ヒアルロン酸', 'ヒアルロン酸ナトリウム', 'HA'],
    categories: ['moisturizing'],
    scores: { brightening: 0, moisturizing: 90, anti_inflammatory: 5, antioxidant: 0, exfoliating: 0, anti_aging: 20 },
    safety: { irritation: 'low', photosensitivity: false, comedogenic: 0, note: '' },
    research: [
      { title: 'Hyaluronic acid: a key molecule in skin aging', journal: 'Dermatoendocrinol', year: 2012, finding: '自身の重量の1000倍の水分を保持' },
    ],
    description: '代表的な保湿成分。1gで6Lの水分を保持する能力。分子量により浸透深度が異なる。',
  },
  {
    id: 'ceramide_np',
    name_ja: 'セラミドNP',
    name_inci: 'Ceramide NP',
    aliases: ['セラミド3', 'セラミド', 'Ceramide 3'],
    categories: ['moisturizing'],
    scores: { brightening: 0, moisturizing: 85, anti_inflammatory: 20, antioxidant: 0, exfoliating: 0, anti_aging: 30 },
    safety: { irritation: 'low', photosensitivity: false, comedogenic: 0, note: '' },
    research: [
      { title: 'The role of ceramides in skin barrier function', journal: 'J Invest Dermatol', year: 2005, finding: '角質層ラメラ構造の維持に必須' },
    ],
    description: '肌のバリア機能の主役。角質細胞間脂質の約50%を占め、水分蒸散を防ぐ。',
  },
  {
    id: 'squalane',
    name_ja: 'スクワラン',
    name_inci: 'Squalane',
    aliases: ['植物性スクワラン'],
    categories: ['moisturizing'],
    scores: { brightening: 0, moisturizing: 70, anti_inflammatory: 5, antioxidant: 10, exfoliating: 0, anti_aging: 15 },
    safety: { irritation: 'low', photosensitivity: false, comedogenic: 1, note: '' },
    research: [],
    description: '皮脂にも含まれる天然のエモリエント成分。べたつかず肌なじみが良い。',
  },

  // ── 抗炎症 ──
  {
    id: 'dipotassium_glycyrrhizate',
    name_ja: 'グリチルリチン酸2K',
    name_inci: 'Dipotassium Glycyrrhizate',
    aliases: ['グリチルリチン酸ジカリウム', 'グリチルリチン酸二カリウム', '甘草由来'],
    categories: ['anti_inflammatory'],
    scores: { brightening: 10, moisturizing: 5, anti_inflammatory: 85, antioxidant: 15, exfoliating: 0, anti_aging: 10 },
    safety: { irritation: 'low', photosensitivity: false, comedogenic: 0, note: '' },
    research: [
      { title: 'Anti-inflammatory activity of glycyrrhizin', journal: 'J Pharm Pharmacol', year: 2003, finding: '複数の炎症経路を抑制' },
    ],
    description: '甘草由来の抗炎症成分。医薬部外品の有効成分として広く使用。肌荒れ防止に。',
  },
  {
    id: 'allantoin',
    name_ja: 'アラントイン',
    name_inci: 'Allantoin',
    aliases: [],
    categories: ['anti_inflammatory', 'moisturizing'],
    scores: { brightening: 5, moisturizing: 30, anti_inflammatory: 70, antioxidant: 0, exfoliating: 5, anti_aging: 10 },
    safety: { irritation: 'low', photosensitivity: false, comedogenic: 0, note: '' },
    research: [],
    description: '抗炎症・細胞増殖促進作用。傷の治癒促進にも使われる。低刺激。',
  },
  {
    id: 'cica',
    name_ja: 'ツボクサエキス',
    name_inci: 'Centella Asiatica Extract',
    aliases: ['CICA', 'シカ', 'センテラアジアチカ', 'マデカッソシド', 'マデカソサイド'],
    categories: ['anti_inflammatory', 'anti_aging'],
    scores: { brightening: 10, moisturizing: 25, anti_inflammatory: 85, antioxidant: 30, exfoliating: 0, anti_aging: 40 },
    safety: { irritation: 'low', photosensitivity: false, comedogenic: 0, note: '' },
    research: [
      { title: 'Centella asiatica in dermatology', journal: 'Indian J Dermatol', year: 2017, finding: 'コラーゲン合成促進・抗炎症・創傷治癒促進の三重効果' },
    ],
    description: '韓国スキンケアで大流行のCICA成分。抗炎症・創傷治癒・コラーゲン促進の多機能。',
  },

  // ── 抗酸化 ──
  {
    id: 'tocopherol',
    name_ja: 'トコフェロール',
    name_inci: 'Tocopherol',
    aliases: ['ビタミンE', 'VE', '酢酸トコフェロール', 'dl-α-トコフェロール'],
    categories: ['antioxidant'],
    scores: { brightening: 10, moisturizing: 15, anti_inflammatory: 20, antioxidant: 80, exfoliating: 0, anti_aging: 40 },
    safety: { irritation: 'low', photosensitivity: false, comedogenic: 2, note: '' },
    research: [
      { title: 'Vitamin E in dermatology', journal: 'Indian Dermatol Online J', year: 2016, finding: '光防御・抗炎症・抗酸化の3つの作用が確認' },
    ],
    description: 'ビタミンE。強力な抗酸化作用で活性酸素を除去。ビタミンCとの相乗効果あり。',
  },

  // ── 角質ケア ──
  {
    id: 'salicylic_acid',
    name_ja: 'サリチル酸',
    name_inci: 'Salicylic Acid',
    aliases: ['BHA', 'βヒドロキシ酸'],
    categories: ['exfoliating', 'anti_inflammatory'],
    scores: { brightening: 30, moisturizing: 0, anti_inflammatory: 50, antioxidant: 0, exfoliating: 90, anti_aging: 25 },
    safety: { irritation: 'medium', photosensitivity: true, comedogenic: 0, note: '妊娠中は高濃度の使用を避ける。日焼け止め必須。' },
    research: [
      { title: 'Salicylic acid as a peeling agent', journal: 'Clin Cosmet Investig Dermatol', year: 2015, finding: '脂溶性のため毛穴に浸透し、ニキビ・角栓に有効' },
    ],
    description: '脂溶性の角質ケア成分（BHA）。毛穴の奥まで浸透してニキビ・黒ずみに効果的。抗炎症作用もあり。',
  },
  {
    id: 'glycolic_acid',
    name_ja: 'グリコール酸',
    name_inci: 'Glycolic Acid',
    aliases: ['AHA', 'αヒドロキシ酸'],
    categories: ['exfoliating', 'brightening'],
    scores: { brightening: 50, moisturizing: 10, anti_inflammatory: 0, antioxidant: 0, exfoliating: 90, anti_aging: 40 },
    safety: { irritation: 'high', photosensitivity: true, comedogenic: 0, note: '濃度と pHにより刺激が大きく異なる。日焼け止め必須。' },
    research: [
      { title: 'Glycolic acid peels', journal: 'Dermatol Surg', year: 2001, finding: '角質層の結合を弱め、ターンオーバーを促進' },
    ],
    description: '最小のAHA。角質剥離・ターンオーバー促進効果が高い。濃度により家庭用〜医療用まで幅広い。',
  },

  // ── 防腐剤 ──
  {
    id: 'phenoxyethanol',
    name_ja: 'フェノキシエタノール',
    name_inci: 'Phenoxyethanol',
    aliases: [],
    categories: [],
    scores: { brightening: 0, moisturizing: 0, anti_inflammatory: 0, antioxidant: 0, exfoliating: 0, anti_aging: 0 },
    safety: { irritation: 'low', photosensitivity: false, comedogenic: 0, note: '一般的な防腐剤。パラベンの代替として広く使用。' },
    research: [],
    description: '広く使われる防腐剤。パラベンフリーを謳う製品で代替として使用されることが多い。',
  },
  {
    id: 'methylparaben',
    name_ja: 'メチルパラベン',
    name_inci: 'Methylparaben',
    aliases: ['パラベン', 'メチルパラヒドロキシベンゾエート'],
    categories: [],
    scores: { brightening: 0, moisturizing: 0, anti_inflammatory: 0, antioxidant: 0, exfoliating: 0, anti_aging: 0 },
    safety: { irritation: 'low', photosensitivity: false, comedogenic: 0, note: '安全性は確立されているが、消費者の忌避感が強い成分。' },
    research: [],
    description: '防腐剤。長年の使用実績があり安全性は高いが、「パラベンフリー」トレンドの影響で避けられがち。',
  },

  // ── 日焼け止め成分 ──
  {
    id: 'ethylhexyl_methoxycinnamate',
    name_ja: 'メトキシケイヒ酸エチルヘキシル',
    name_inci: 'Ethylhexyl Methoxycinnamate',
    aliases: ['オクチノキサート', 'OMC'],
    categories: [],
    scores: { brightening: 0, moisturizing: 0, anti_inflammatory: 0, antioxidant: 0, exfoliating: 0, anti_aging: 0 },
    safety: { irritation: 'low', photosensitivity: false, comedogenic: 0, note: 'UVB吸収剤。環境懸念あり（サンゴ礁への影響）。' },
    research: [],
    description: '最も広く使用されるUVB吸収剤。一部地域ではサンゴ礁保護の観点から規制あり。',
  },

  // ── エタノール ──
  {
    id: 'ethanol',
    name_ja: 'エタノール',
    name_inci: 'Alcohol',
    aliases: ['アルコール', '無水エタノール', 'エチルアルコール'],
    categories: [],
    scores: { brightening: 0, moisturizing: -10, anti_inflammatory: 0, antioxidant: 0, exfoliating: 0, anti_aging: 0 },
    safety: { irritation: 'medium', photosensitivity: false, comedogenic: 0, note: '揮発性で清涼感を与えるが、高濃度では肌を乾燥させる可能性。敏感肌は注意。' },
    research: [],
    description: '溶剤・収れん・清涼感。高配合（上位に記載）だと乾燥の原因になりうる。',
  },

  // ── パンテノール ──
  {
    id: 'panthenol',
    name_ja: 'パンテノール',
    name_inci: 'Panthenol',
    aliases: ['プロビタミンB5', 'D-パンテノール', 'デクスパンテノール'],
    categories: ['moisturizing', 'anti_inflammatory'],
    scores: { brightening: 5, moisturizing: 70, anti_inflammatory: 50, antioxidant: 0, exfoliating: 0, anti_aging: 20 },
    safety: { irritation: 'low', photosensitivity: false, comedogenic: 0, note: '' },
    research: [
      { title: 'Dexpanthenol: an overview of its topical use', journal: 'J Dermatol Treat', year: 2002, finding: '創傷治癒促進・保湿・バリア改善効果を確認' },
    ],
    description: 'ビタミンB5誘導体。保湿・肌荒れ改善・バリア強化。刺激が少なく敏感肌にも向く。',
  },

  // ── ペプチド ──
  {
    id: 'palmitoyl_tripeptide',
    name_ja: 'パルミトイルトリペプチド-1',
    name_inci: 'Palmitoyl Tripeptide-1',
    aliases: ['マトリキシル'],
    categories: ['anti_aging'],
    scores: { brightening: 10, moisturizing: 10, anti_inflammatory: 10, antioxidant: 5, exfoliating: 0, anti_aging: 80 },
    safety: { irritation: 'low', photosensitivity: false, comedogenic: 0, note: '' },
    research: [
      { title: 'Cosmetic peptides', journal: 'Int J Cosmet Sci', year: 2009, finding: 'コラーゲンI, III, IVの合成を促進' },
    ],
    description: 'シグナルペプチド。コラーゲン合成を促進するシグナルを細胞に送る。マトリキシルの成分。',
  },

  // ── アゼライン酸 ──
  {
    id: 'azelaic_acid',
    name_ja: 'アゼライン酸',
    name_inci: 'Azelaic Acid',
    aliases: ['アゼライン酸誘導体'],
    categories: ['brightening', 'anti_inflammatory', 'exfoliating'],
    scores: { brightening: 70, moisturizing: 0, anti_inflammatory: 65, antioxidant: 20, exfoliating: 50, anti_aging: 30 },
    safety: { irritation: 'low', photosensitivity: false, comedogenic: 0, note: '使い始めにピリピリ感を感じることがある。' },
    research: [
      { title: 'Azelaic acid: properties and mode of action', journal: 'Skin Pharmacol Physiol', year: 2014, finding: 'チロシナーゼ阻害・抗菌・角質正常化の多機能' },
    ],
    description: '穀物由来の多機能成分。美白・ニキビ・酒さに効果。妊娠中も使える数少ない美白成分。',
  },

  // ── バクチオール ──
  {
    id: 'bakuchiol',
    name_ja: 'バクチオール',
    name_inci: 'Bakuchiol',
    aliases: ['バクチオール'],
    categories: ['anti_aging', 'antioxidant'],
    scores: { brightening: 25, moisturizing: 10, anti_inflammatory: 30, antioxidant: 50, exfoliating: 20, anti_aging: 75 },
    safety: { irritation: 'low', photosensitivity: false, comedogenic: 0, note: '植物由来のレチノール代替。妊娠中も使用可能とされる。' },
    research: [
      { title: 'Bakuchiol: a retinol-like functional compound', journal: 'Br J Dermatol', year: 2019, finding: 'レチノールと同等の抗シワ・色素沈着改善効果を確認。副作用は有意に少ない。' },
    ],
    description: '植物由来のレチノール代替成分。同等のエイジングケア効果でレチノールより低刺激。',
  },
];
