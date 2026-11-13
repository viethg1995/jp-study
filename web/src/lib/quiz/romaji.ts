// Gõ kana (Q9, plan/quiz/q09-kana-input.md): chuyển romaji → hiragana ngay khi gõ. Hàm thuần, không DOM.
//   Hepburn + Kunrei + kiểu gõ máy: shi/si, chi/ti, tsu/tu, fu/hu, ji/zi, sha/sya, cha/tya/cya, ja/jya/zya, di/du
//   っ = phụ âm đôi (kitte, matcha) · ん = nn / n' / n trước phụ âm (konnichiha → こんにちは) · n cuối: ん khi `final`
//   âm nhỏ xa/la, xtu/ltu · wo → を · "-" → ー · kana / ký tự khác giữ nguyên · phần chưa đủ âm giữ nguyên (sh, ky)
//   Chữ hoa cũng ra hiragana (chấm đã coi katakana = hiragana).

const ROWS: Record<string, string> = {
  a: "あ", i: "い", u: "う", e: "え", o: "お",
  ka: "か", ki: "き", ku: "く", ke: "け", ko: "こ", ga: "が", gi: "ぎ", gu: "ぐ", ge: "げ", go: "ご",
  sa: "さ", si: "し", shi: "し", su: "す", se: "せ", so: "そ", za: "ざ", zi: "じ", ji: "じ", zu: "ず", ze: "ぜ", zo: "ぞ",
  ta: "た", ti: "ち", chi: "ち", tu: "つ", tsu: "つ", te: "て", to: "と", da: "だ", di: "ぢ", du: "づ", de: "で", do: "ど",
  na: "な", ni: "に", nu: "ぬ", ne: "ね", no: "の",
  ha: "は", hi: "ひ", hu: "ふ", fu: "ふ", he: "へ", ho: "ほ", ba: "ば", bi: "び", bu: "ぶ", be: "べ", bo: "ぼ",
  pa: "ぱ", pi: "ぴ", pu: "ぷ", pe: "ぺ", po: "ぽ",
  ma: "ま", mi: "み", mu: "む", me: "め", mo: "も", ya: "や", yu: "ゆ", yo: "よ",
  ra: "ら", ri: "り", ru: "る", re: "れ", ro: "ろ", wa: "わ", wo: "を",
  fa: "ふぁ", fi: "ふぃ", fe: "ふぇ", fo: "ふぉ", she: "しぇ", je: "じぇ", che: "ちぇ",
  // âm nhỏ gõ riêng
  xa: "ぁ", xi: "ぃ", xu: "ぅ", xe: "ぇ", xo: "ぉ", la: "ぁ", li: "ぃ", lu: "ぅ", le: "ぇ", lo: "ぉ",
  xya: "ゃ", xyu: "ゅ", xyo: "ょ", lya: "ゃ", lyu: "ゅ", lyo: "ょ", xtu: "っ", ltu: "っ", xtsu: "っ", ltsu: "っ", xwa: "ゎ", lwa: "ゎ",
};
// âm ghép ゃゅょ: kya, sha/sya, cha/tya/cya, ja/jya/zya…
const YOON: [string, string][] = [
  ["ky", "き"], ["gy", "ぎ"], ["sy", "し"], ["sh", "し"], ["zy", "じ"], ["jy", "じ"], ["j", "じ"], ["ty", "ち"], ["cy", "ち"], ["ch", "ち"],
  ["chy", "ち"], ["shy", "し"], ["dy", "ぢ"], ["ny", "に"], ["hy", "ひ"], ["by", "び"], ["py", "ぴ"], ["my", "み"], ["ry", "り"],
];
for (const [head, kana] of YOON) {
  for (const [v, small] of [["a", "ゃ"], ["u", "ゅ"], ["o", "ょ"]] as const) ROWS[head + v] ??= kana + small;
}

const KEYS = Object.keys(ROWS);
const MAX_KEY = Math.max(...KEYS.map((k) => k.length));
const PREFIXES = new Set(KEYS.flatMap((k) => [...k].map((_, i) => k.slice(0, i + 1))));
const VOWEL = /[aiueo]/;
const LETTER = /[a-z]/;

/**
 * Romaji → hiragana. `final` = đang chấm: "n" cuối thành ん, phần dở dang giữ nguyên.
 * Không final (đang gõ): "n" cuối và phần chưa đủ âm (k, sh, ky) giữ nguyên để gõ tiếp.
 */
export function toKana(input: string, final = false): string {
  const s = input.toLowerCase();
  let out = "";
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (c === "-") {
      out += "ー";
      i++;
      continue;
    }
    if (!LETTER.test(c) && c !== "'") {
      out += input[i]; // kana gõ thẳng, số, dấu… giữ nguyên
      i++;
      continue;
    }
    const next = s[i + 1] ?? "";
    // ん: n' · nn (+ phụ âm / cuối) · n + phụ âm khác y · n cuối khi chấm
    if (c === "n") {
      if (next === "'") {
        out += "ん";
        i += 2;
        continue;
      }
      if (next === "n") {
        const after = s[i + 2] ?? "";
        out += "ん";
        // konnichiha: n thứ hai mở âm に; kann / honn + phụ âm: nn = ん
        i += VOWEL.test(after) || after === "y" ? 1 : 2;
        continue;
      }
      if (next !== "" && !VOWEL.test(next) && next !== "y" && LETTER.test(next)) {
        out += "ん";
        i++;
        continue;
      }
      if (next === "" || !LETTER.test(next)) {
        if (final || next !== "") {
          out += "ん";
          i++;
          continue;
        }
        out += "n"; // đang gõ: chờ chữ sau (na, nya, nn)
        i++;
        continue;
      }
    }
    // っ: phụ âm đôi (kk, tt, ss, pp…; không áp cho n) và tch (matcha)
    if (c !== "n" && !VOWEL.test(c) && c === next) {
      out += "っ";
      i++;
      continue;
    }
    if (c === "t" && next === "c" && s[i + 2] === "h") {
      out += "っ";
      i++;
      continue;
    }
    // âm dài nhất khớp bảng
    let hit = "";
    for (let len = Math.min(MAX_KEY, s.length - i); len > 0; len--) {
      const k = s.slice(i, i + len);
      if (ROWS[k]) {
        hit = k;
        break;
      }
    }
    if (hit) {
      out += ROWS[hit];
      i += hit.length;
      continue;
    }
    // chưa đủ âm ở cuối (k, sh, ky…) → giữ để gõ tiếp; ký tự không thuộc âm nào → giữ nguyên
    const rest = s.slice(i);
    if (PREFIXES.has(rest)) {
      out += input.slice(i);
      break;
    }
    out += input[i];
    i++;
  }
  return out;
}

/** Còn chữ Latin chưa chuyển (gõ dở / gõ sai) — runner dùng để báo trước khi chấm. */
export const hasLatin = (s: string): boolean => /[a-z]/i.test(s);
