import { normalizeOcrText } from '../normalizeOcrText';

// ── 仕様必須ケース ───────────────────────────────────────────────────────────

describe('仕様必須ケース（スペース分断）', () => {
  test('プロパンジオー ル → プロパンジオール', () => {
    expect(normalizeOcrText('プロパンジオー ル')).toBe('プロパンジオール');
  });

  test('トコフェロー ル → トコフェロール', () => {
    expect(normalizeOcrText('トコフェロー ル')).toBe('トコフェロール');
  });

  test('エチルヘキシ ル → エチルヘキシル', () => {
    expect(normalizeOcrText('エチルヘキシ ル')).toBe('エチルヘキシル');
  });
});

// ── 改行による分断（\n）────────────────────────────────────────────────────

describe('改行（\\n）による分断', () => {
  test('カタカナ+\\n+1文字カタカナ → 連結', () => {
    expect(normalizeOcrText('プロパンジオー\nル')).toBe('プロパンジオール');
  });

  test('ハイフン+改行 → 除去して連結', () => {
    expect(normalizeOcrText('メチルパラベ-\nン')).toBe('メチルパラベン');
  });

  test('カタカナ+\\n+5文字カタカナ → 連結しない（別成分）', () => {
    // グリセリン = 5文字 > MAX_SUFFIX_RUN(3) → 保持
    expect(normalizeOcrText('プロパンジオール\nグリセリン')).toBe('プロパンジオール\nグリセリン');
  });
});

// ── 過剰連結の防止 ───────────────────────────────────────────────────────────

describe('過剰連結の防止', () => {
  test('カタカナ+スペース+5文字カタカナ → 連結しない', () => {
    expect(normalizeOcrText('プロパンジオール グリセリン')).toBe('プロパンジオール グリセリン');
  });

  test('読点の後のスペース → 保持', () => {
    // 、の直前はカタカナではないので isSplitSeparator が false になる
    expect(normalizeOcrText('アロエベラ、 グリセリン')).toBe('アロエベラ、 グリセリン');
  });

  test('カタカナ+スペース+漢字 → 保持（漢字はカタカナでない）', () => {
    expect(normalizeOcrText('ヒアルロン 酸')).toBe('ヒアルロン 酸');
  });

  test('ASCII+スペース+カタカナ → 保持（異種）', () => {
    expect(normalizeOcrText('BHA ポリグリセリル')).toBe('BHA ポリグリセリル');
  });
});

// ── リスト全体 ───────────────────────────────────────────────────────────────

describe('リスト全体の処理', () => {
  test('複数の分断を一括修正', () => {
    const input = 'プロパンジオー ル、トコフェロー ル、エチルヘキシ ル';
    expect(normalizeOcrText(input)).toBe('プロパンジオール、トコフェロール、エチルヘキシル');
  });

  test('改行区切り成分リストを正しく処理', () => {
    const input = 'フェノキシエタノー\nル\nグリセリン\n水';
    // フェノキシエタノール はル(1文字)なので連結、グリセリン(5文字)とはしない
    expect(normalizeOcrText(input)).toBe('フェノキシエタノール\nグリセリン\n水');
  });

  test('きれいなテキストは変更なし', () => {
    expect(normalizeOcrText('グリセリン、水、エタノール')).toBe('グリセリン、水、エタノール');
  });
});

// ── Stage 1 正規化 ───────────────────────────────────────────────────────────

describe('Stage 1 正規化', () => {
  test('全角スペース → 半角スペース', () => {
    // 全角スペースは連続スペース圧縮で 1つの半角スペースに
    expect(normalizeOcrText('グリセリン\u3000水')).toBe('グリセリン 水');
  });

  test('連続スペース → 1つに圧縮（水は漢字なので連結はしない）', () => {
    // Stage 1 で連続スペースは1つに圧縮される。水は漢字なので Stage 2 は触れない。
    expect(normalizeOcrText('グリセリン  水')).toBe('グリセリン 水');
  });
});

// ── デバッグモード ───────────────────────────────────────────────────────────

describe('デバッグモード', () => {
  test('debug:true で changes が返る', () => {
    const result = normalizeOcrText('プロパンジオー ル', true);
    expect(result.text).toBe('プロパンジオール');
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].context).toContain('ジオー ル');
  });

  test('変更なしの場合 changes は空配列', () => {
    const result = normalizeOcrText('グリセリン、水', true);
    expect(result.text).toBe('グリセリン、水');
    expect(result.changes).toHaveLength(0);
  });

  test('複数の分断で changes が複数返る', () => {
    const result = normalizeOcrText('トコフェロー ル エチルヘキシ ル', true);
    expect(result.text).toBe('トコフェロール エチルヘキシル');
    expect(result.changes.length).toBeGreaterThanOrEqual(2);
  });
});
