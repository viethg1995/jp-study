// Sinh "lỗi đọc hay gặp" từ một cách đọc kana — làm đáp án nhiễu cho câu hỏi đọc (Q4-3, kiểu bẫy JLPT 漢字読み):
//   trường âm (せんせい → せんせ / せんせいい→…), っ (がっこう → がこう, じしょ → じっしょ),
//   âm nhỏ ゃゅょ (きょう → きよう), dấu đục (たいがく ← だいがく).
// Hàm thuần; nơi gọi tự loại mọi dạng trùng cách đọc đúng (validReadings).

const VOWEL: Record<string, "a" | "i" | "u" | "e" | "o"> = {};
const ROWS: [string, "a" | "i" | "u" | "e" | "o"][] = [
  ["あかさたなはまやらわがざだばぱゃ", "a"],
  ["いきしちにひみりぎじぢびぴ", "i"],
  ["うくすつぬふむゆるぐずづぶぷゅ", "u"],
  ["えけせてねへめれげぜでべぺ", "e"],
  ["おこそとのほもよろをごぞどぼぽょ", "o"],
];
for (const [chars, v] of ROWS) for (const ch of chars) VOWEL[ch] = v;

// Đục / bán đục: mỗi chữ → các dạng đổi được
const VOICE_PAIRS: [string, string][] = [
  ["かきくけこ", "がぎぐげご"],
  ["さしすせそ", "ざじずぜぞ"],
  ["たちつてと", "だぢづでど"],
  ["はひふへほ", "ばびぶべぼ"],
  ["はひふへほ", "ぱぴぷぺぽ"],
  ["ばびぶべぼ", "ぱぴぷぺぽ"],
];
const VOICE: Record<string, string[]> = {};
for (const [a, b] of VOICE_PAIRS) {
  [...a].forEach((x, i) => {
    const y = b[i]!;
    (VOICE[x] ??= []).push(y);
    (VOICE[y] ??= []).push(x);
  });
}
const SMALL_TO_BIG: Record<string, string> = { ゃ: "や", ゅ: "ゆ", ょ: "よ" };
const BIG_TO_SMALL: Record<string, string> = { や: "ゃ", ゆ: "ゅ", よ: "ょ" };
const SOKUON_BEFORE = /[かきくけこさしすせそたちつてとぱぴぷぺぽ]/;
const SMALL = /[ゃゅょぁぃぅぇぉっ]/;

const at = (s: string[], i: number): string => s[i] ?? "";
const join = (s: string[]): string => s.join("");

/** Bỏ trường âm: こう→こ, ゆう→ゆ, せい→せ, ああ/いい/うう… → một âm. */
function shorten(s: string[]): string[] {
  const out: string[] = [];
  for (let i = 1; i < s.length; i++) {
    const v = VOWEL[at(s, i - 1)];
    const c = at(s, i);
    const long =
      (c === "う" && (v === "o" || v === "u")) ||
      (c === "い" && v === "e") ||
      (c === "あ" && v === "a") ||
      (c === "い" && v === "i") ||
      (c === "え" && v === "e") ||
      (c === "お" && v === "o") ||
      c === "ー";
    if (long) out.push(join([...s.slice(0, i), ...s.slice(i + 1)]));
  }
  return out;
}

const PURE_VOWEL = /[あいうえお]/;
const EXTENDER = { a: "あ", i: "い", u: "う", e: "い", o: "う" } as const;

/**
 * Thêm trường âm: o/u +う, e +い; a +あ, i +い chỉ trước さん (おばさん → おばあさん, おじさん → おじいさん).
 * Chỉ ở âm có phụ âm, không ở 2 âm cuối, không trước ん/っ/nguyên âm (tránh dạng vô lý せいんせい, いえい, よせいる).
 */
function lengthen(s: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length - 2; i++) {
    const c = at(s, i);
    const v = VOWEL[c];
    const next = at(s, i + 1);
    if (!v || PURE_VOWEL.test(c) || SMALL.test(next) || next === "ん" || next === "っ" || PURE_VOWEL.test(next)) continue;
    // a/i kéo dài chỉ hay nhầm ở cặp おばさん/おばあさん, おじさん/おじいさん → chỉ ngay trước さん
    if ((v === "a" || v === "i") && !(next === "さ" && at(s, i + 2) === "ん")) continue;
    out.push(join([...s.slice(0, i + 1), EXTENDER[v], ...s.slice(i + 1)]));
  }
  return out;
}

/** Bỏ っ / thêm っ trước âm k, s, t, p (không đứng đầu, không sau ん/っ/nguyên âm; từ đã có っ thì không thêm). */
function sokuon(s: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) if (at(s, i) === "っ") out.push(join([...s.slice(0, i), ...s.slice(i + 1)]));
  if (s.includes("っ")) return out;
  for (let i = 1; i < s.length; i++) {
    const prev = at(s, i - 1);
    if (!SOKUON_BEFORE.test(at(s, i)) || prev === "ん" || !VOWEL[prev] || PURE_VOWEL.test(prev)) continue;
    out.push(join([...s.slice(0, i), "っ", ...s.slice(i)]));
  }
  return out;
}

/** Âm ghép: きょ → きよ, và ngược lại きよ → きょ (sau âm hàng i). */
function yoon(s: string[]): string[] {
  const out: string[] = [];
  for (let i = 1; i < s.length; i++) {
    const c = at(s, i);
    const big = SMALL_TO_BIG[c];
    if (big) out.push(join([...s.slice(0, i), big, ...s.slice(i + 1)]));
    const small = BIG_TO_SMALL[c];
    if (small && VOWEL[at(s, i - 1)] === "i" && at(s, i - 1) !== "い") out.push(join([...s.slice(0, i), small, ...s.slice(i + 1)]));
  }
  return out;
}

/** Đổi đục / trong ở từng vị trí. */
function voicing(s: string[]): string[] {
  const out: string[] = [];
  s.forEach((c, i) => {
    for (const v of VOICE[c] ?? []) out.push(join([...s.slice(0, i), v, ...s.slice(i + 1)]));
  });
  return out;
}

const GENERATORS = [shorten, lengthen, sokuon, yoon, voicing];

/** Dạng kana hợp lệ về mặt chữ viết (không bắt đầu bằng chữ nhỏ/ん, không kết thúc bằng っ). */
function wellFormed(s: string): boolean {
  return s.length > 0 && !SMALL.test(s[0]!) && s[0] !== "ん" && !s.endsWith("っ");
}

/** Đuôi ngữ pháp giữ nguyên (lỗi ở たべまっす, いじょうでいす là vô lý — người học chỉ nhầm phần thân). */
const SUFFIXES = ["ませんでした", "ました", "ません", "ます", "です。", "です"];

/**
 * Các cách đọc sai hay gặp của `reading`, xen kẽ từng loại lỗi (để 3 nhiễu thường khác loại nhau),
 * đã loại mọi dạng có trong `valid` (gồm chính reading). Giữ tiền tố "～" (～じん → ～しん) và đuôi ます.
 */
export function misreadings(reading: string, valid: Iterable<string> = [], max = 8): string[] {
  const prefix = reading.startsWith("～") ? "～" : "";
  const body = reading.slice(prefix.length);
  const suffix = SUFFIXES.find((x) => body.endsWith(x) && body.length > x.length) ?? "";
  const core = [...body.slice(0, body.length - suffix.length)];
  const banned = new Set([reading, ...valid]);
  const lists = GENERATORS.map((g) => g(core).map((x) => prefix + x + suffix));
  const out: string[] = [];
  const seen = new Set<string>();
  for (let round = 0; out.length < max; round++) {
    let any = false;
    for (const list of lists) {
      const x = list[round];
      if (x === undefined) continue;
      any = true;
      if (seen.has(x) || banned.has(x) || !wellFormed(x.slice(prefix.length, x.length - suffix.length))) continue;
      seen.add(x);
      out.push(x);
      if (out.length >= max) break;
    }
    if (!any) break;
  }
  return out;
}
