/**
 * normalizeOcrText.ts
 *
 * 化粧品成分表OCR後処理：改行起因の分断空白を連結する
 *
 * Stage 1 – 改行・空白の正規化
 *   - 全角スペース → 半角スペース
 *   - ハイフン + LF（OCR ソフトハイフン改行）→ 除去
 *   - 連続空白 → 1つに圧縮
 *   ※ \n は Stage 2 と共通ルールで処理するため Stage 1 では残す
 *
 * Stage 2 – 分断空白（スペースまたは \n）の除去
 *   以下を「すべて満たす」場合のみ除去（過剰推測を避けるため保守的に）：
 *     1. 直前の文字がカタカナ（ーU+30FC 含む）
 *     2. 直後の文字がカタカナ
 *     3. 直後のカタカナ連続長が MAX_SUFFIX_RUN（3）文字以下
 *        （1〜3文字 = 分断された語尾、4文字以上 = 別成分名と判断）
 *
 * 例：「プロパンジオー ル」→「プロパンジオール」
 *     「トコフェロー ル」→「トコフェロール」
 *     「エチルヘキシ ル」→「エチルヘキシル」
 *     「プロパンジオール グリセリン」→ 変更なし（グリセリン = 5文字）
 */

/** デバッグモードで返される変更ログ 1件分 */
export interface NormalizeChange {
  /** 除去された文字の前後 ±6 文字のコンテキスト（Stage 1 後のテキスト基準） */
  context: string;
  /** Stage 1 後テキスト内での位置 */
  index: number;
}

// ── ヘルパー ────────────────────────────────────────────────────────────────

const RE_KATAKANA = /[\u30A0-\u30FF]/; // カタカナブロック（ーU+30FC 含む）

/** idx から始まるカタカナの連続長を返す */
function katakanaRunLength(text: string, idx: number): number {
  let len = 0;
  while (idx + len < text.length && RE_KATAKANA.test(text[idx + len])) len++;
  return len;
}

/** 直後カタカナ連続長の上限（1〜3文字 = 語尾の分断と判定） */
const MAX_SUFFIX_RUN = 3;

/**
 * テキスト `text` の位置 `idx` にある空白文字（' ' または '\n'）が
 * 改行起因の分断であれば true を返す。
 */
function isSplitSeparator(text: string, idx: number): boolean {
  if (idx === 0 || idx >= text.length - 1) return false;
  const before = text[idx - 1];
  const after = text[idx + 1];
  if (!RE_KATAKANA.test(before) || !RE_KATAKANA.test(after)) return false;
  return katakanaRunLength(text, idx + 1) <= MAX_SUFFIX_RUN;
}

// ── 公開 API ────────────────────────────────────────────────────────────────

export function normalizeOcrText(input: string, debug?: false): string;
export function normalizeOcrText(
  input: string,
  debug: true,
): { text: string; changes: NormalizeChange[] };
export function normalizeOcrText(
  input: string,
  debug?: boolean,
): string | { text: string; changes: NormalizeChange[] } {
  // ── Stage 1 ──────────────────────────────────────────────────────────────
  let s = input;
  s = s.replace(/\u3000/g, ' ');   // 全角スペース → 半角
  s = s.replace(/-\n/g, '');       // ハイフン改行 → 除去
  s = s.replace(/[ \t]{2,}/g, ' '); // 連続スペース → 1つ
  // (\n はここでは変換しない。isSplitSeparator で ' ' と同列に扱う)

  // ── Stage 2 ──────────────────────────────────────────────────────────────
  const changes: NormalizeChange[] = [];
  let result = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if ((ch === ' ' || ch === '\n') && isSplitSeparator(s, i)) {
      if (debug) {
        changes.push({
          context: s.slice(Math.max(0, i - 6), Math.min(s.length, i + 7)),
          index: i,
        });
      }
      continue; // 分断空白を除去 → 文字を連結
    }
    result += ch;
  }

  return debug ? { text: result, changes } : result;
}
