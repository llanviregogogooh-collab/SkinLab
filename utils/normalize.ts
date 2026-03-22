// utils/normalize.ts

/**
 * 全角英数記号を半角に変換する
 * 全角スペースは半角スペースに変換
 */
export function toHalfWidth(text: string): string {
  return text
    .replace(/[\uff01-\uff5e]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
    )
    .replace(/\u3000/g, ' ');
}
