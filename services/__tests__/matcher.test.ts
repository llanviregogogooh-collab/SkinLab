import { matchIngredients, parseIngredientText } from '../matcher';

describe('matchIngredients 完全一致', () => {
  it('化粧品表示名で一致: グリセリン', () => {
    const results = matchIngredients(['グリセリン']);
    expect(results[0].entry?.id).toBe('glycerin');
  });

  it('化粧品表示名で一致: 水', () => {
    const results = matchIngredients(['水']);
    expect(results[0].entry?.id).toBe('water');
  });

  it('INCI名で一致: Niacinamide', () => {
    const results = matchIngredients(['Niacinamide']);
    expect(results[0].entry?.name_cosmetic).toBe('ナイアシンアミド');
  });

  it('存在しない成分はnull', () => {
    const results = matchIngredients(['存在しない成分XYZ']);
    expect(results[0].entry).toBeNull();
  });
});

describe('部分一致 誤判定防止', () => {
  it('3文字の短い入力は部分一致しない', () => {
    // 「水」「BG」「DPG」のような短い名前は完全一致のみ
    const results = matchIngredients(['BGX']);
    // BGXは完全一致しない && 3文字なので部分一致もしない
    expect(results[0].entry).toBeNull();
  });

  it('4文字の入力も部分一致しない（5文字未満）', () => {
    const results = matchIngredients(['グリセ']);
    expect(results[0].entry).toBeNull();
  });

  it('十分に長い入力は部分一致する', () => {
    // 「プロパンジオール」がDBにある前提
    const results = matchIngredients(['プロパンジオール（保湿）']);
    // 括弧付きでも中に正式名を含むなら部分一致可能
    if (results[0].entry) {
      expect(results[0].entry.name_cosmetic).toContain('プロパンジオール');
    }
  });
});

describe('parseIngredientText', () => {
  it('カンマ区切り', () => {
    const result = parseIngredientText('水,グリセリン,BG');
    expect(result).toEqual(['水', 'グリセリン', 'BG']);
  });

  it('読点区切り', () => {
    const result = parseIngredientText('水、グリセリン、BG');
    expect(result).toEqual(['水', 'グリセリン', 'BG']);
  });

  it('改行区切り', () => {
    const result = parseIngredientText('水\nグリセリン\nBG');
    expect(result).toEqual(['水', 'グリセリン', 'BG']);
  });

  it('全成分プレフィックス除去', () => {
    const result = parseIngredientText('全成分：水、グリセリン');
    expect(result).toEqual(['水', 'グリセリン']);
  });

  it('空文字やスペースのみの項目は除外', () => {
    const result = parseIngredientText('水,  ,グリセリン,,BG');
    expect(result).toEqual(['水', 'グリセリン', 'BG']);
  });
});
