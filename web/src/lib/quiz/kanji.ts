// Quiz Kanji + bộ thủ (Q5, plan/quiz/q05-kanji.md): data/kanji → câu hỏi kiểu chung. Hàm thuần — endpoint
// pages/kanji/quiz/[deck].json.ts và pages/kanji/bo-thu/quiz/[deck].json.ts gọi lúc build.
//   k-hv    学 → HỌC                 nhiễu: âm của chữ giống hình (chung thành phần KanjiVG → cùng bộ → số nét gần)
//   k-mean  学 → học                 nhiễu: nghĩa chữ giống hình; loại nghĩa trùng ý (休/憩 "nghỉ ngơi")
//   k-char  HỌC · học → 学           nhiễu: chữ giống hình; loại chữ cùng âm VÀ cùng nghĩa
//   k-read  [[大]]学 → だいがく        nhiễu: thay âm của chữ bằng âm On/Kun khác của nó (たいがく, おおがく),
//                                     rồi lỗi đọc máy sinh (kana.ts) — Q5-3: ≤ 3 từ/chữ, mỗi từ hỏi 1 lần
//   r-of    問 → 口 · Khẩu           nhiễu: thành phần khác của chữ (門) → bộ có số nét gần (Q5-5)
//   r-name  氵 → Thủy · nước         (trang bộ thủ) nhiễu: bộ có số nét gần
//   r-char  Thủy · nước → 水 氵      (trang bộ thủ) chiều ngược
// Đóng gói: chữ theo [xếp theo × cấp × loại] (Q5-2), bộ thủ theo loại (Q5-1).
import { kunDisplay, n3VocabLessonMap } from "../kanji";
import type { KanjiComponent, KanjiEntry, KanjiExample, Radical, VocabEntry } from "../schemas";
import { misreadings } from "./kana";
import type { QuizItem } from "./types";
import { type DeckIssue, finalizeDeck, leaks } from "./validate";
import { meaningKeys } from "./vocab";

export type KanjiLevel = "n5" | "n4" | "n3";
export const KANJI_LEVELS: readonly KanjiLevel[] = ["n5", "n4", "n3"];
/** Cách xếp bài (Q5-2): gt = giáo trình Kanji của cấp, tv = bài từ vựng có chữ lần đầu. */
export type KanjiView = "gt" | "tv";
export const KANJI_VIEWS: readonly KanjiView[] = ["gt", "tv"];
export const KANJI_VIEW_LABEL: Record<KanjiView, string> = { gt: "Giáo trình Kanji", tv: "Bài từ vựng" };
export const KANJI_KINDS = { hv: "k-hv", nghia: "k-mean", chu: "k-char", doc: "k-read", bo: "r-of" } as const;
export type KanjiKindSlug = keyof typeof KANJI_KINDS;
export const KANJI_KIND_LABEL: Record<KanjiKindSlug, string> = { hv: "Hán-Việt", nghia: "Nghĩa", chu: "Chữ", doc: "Cách đọc", bo: "Bộ thủ" };
export const RADICAL_KINDS = { ten: "r-name", chu: "r-char" } as const;
export type RadicalKindSlug = keyof typeof RADICAL_KINDS;
export const RADICAL_KIND_LABEL: Record<RadicalKindSlug, string> = { ten: "Tên bộ", chu: "Chữ của bộ" };
/** Phạm vi bộ thủ: bộ có trong Kanji tới cấp X (tag `scope`: 1 = N5, 2 = N4, 3 = N3, 4 = không có chữ nào). */
export const RADICAL_SCOPES = { n5: 1, n4: 2, n3: 3, "tat-ca": 4 } as const;
export type RadicalScope = keyof typeof RADICAL_SCOPES;

/** Dữ liệu cần cho mọi deck Kanji. */
export interface KanjiSource {
  kanji: readonly KanjiEntry[];
  radicals: readonly Radical[];
  /** {字: thành phần KanjiVG} (strokes.json). */
  components: ReadonlyMap<string, readonly KanjiComponent[]>;
  /** {字: bài từ vựng N3 đầu tiên có chữ} — lib/kanji.ts n3VocabLessonMap. */
  n3VocabLesson: ReadonlyMap<string, number>;
}

/** Ghép KanjiSource từ dữ liệu thô (trang build và test dùng chung). */
export function kanjiSource(
  kanji: readonly KanjiEntry[],
  radicals: readonly Radical[],
  strokes: readonly { char: string; components: readonly KanjiComponent[] }[],
  vocabN3: readonly Pick<VocabEntry, "id" | "lesson">[],
): KanjiSource {
  const byLesson = new Map<number, { id: string }[]>();
  for (const e of vocabN3) (byLesson.get(e.lesson) ?? byLesson.set(e.lesson, []).get(e.lesson)!).push({ id: e.id });
  const lessons = [...byLesson.entries()].map(([lesson, entries]) => ({ lesson, entries }));
  return {
    kanji,
    radicals,
    components: new Map(strokes.map((s) => [s.char, s.components])),
    n3VocabLesson: n3VocabLessonMap([...kanji], lessons),
  };
}

const POOL_SIZE = 6;
const JA = /[぀-ヿ㐀-鿿豈-﫿々]/u;

/** Bài của chữ theo cách xếp + cấp (rỗng = chữ không thuộc nhóm này). Giống lib/kanji.ts groupByCurriculum/groupByVocab. */
export function lessonsOf(k: KanjiEntry, view: KanjiView, level: KanjiLevel, n3VocabLesson: ReadonlyMap<string, number>): number[] {
  if (view === "gt") {
    if (level === "n5") return k.n5_lesson === null ? [] : [k.n5_lesson];
    if (level === "n4") return k.n4_lesson === null ? [] : [k.n4_lesson];
    return [...new Set(k.n3_lessons.map((r) => r.lesson))].sort((a, b) => a - b);
  }
  const f = k.first_lesson;
  if (level === "n5") return f !== null && f <= 25 ? [f] : [];
  if (level === "n4") return f !== null && f > 25 ? [f] : [];
  const n = f === null ? n3VocabLesson.get(k.char) : undefined;
  return n === undefined ? [] : [n];
}

/** Khoảng bài thực có trong dữ liệu cho từng cách xếp × cấp (trang dựng ô chọn bài). */
export function kanjiLessonRanges(src: KanjiSource): Record<KanjiView, Record<KanjiLevel, { from: number; to: number }>> {
  const out = {} as Record<KanjiView, Record<KanjiLevel, { from: number; to: number }>>;
  for (const v of KANJI_VIEWS) {
    out[v] = {} as Record<KanjiLevel, { from: number; to: number }>;
    for (const l of KANJI_LEVELS) {
      const ls = src.kanji.flatMap((k) => lessonsOf(k, v, l, src.n3VocabLesson));
      out[v][l] = { from: Math.min(...ls), to: Math.max(...ls) };
    }
  }
  return out;
}

/**
 * Nghĩa dùng trong câu hỏi (Q5-4): bỏ chữ Nhật trong ngoặc — "quả táo (林檎)" → "quả táo",
 * "(挨拶 chào hỏi)" → "chào hỏi", "nhà, quán (田舎 quê)" → "nhà, quán (quê)". Nghĩa đầy đủ hiện ở phần giải thích.
 */
const meaningCache = new Map<string, string>();
export function kanjiMeaning(m: string | null): string {
  if (!m) return "";
  let out = meaningCache.get(m);
  if (out === undefined) meaningCache.set(m, (out = cleanKanjiMeaning(m)));
  return out;
}

function cleanKanjiMeaning(m: string): string {
  return m
    .replace(/\s*[(（]([^()（）]*)[)）]/gu, (all: string, inner: string, offset: number, whole: string) => {
      if (!JA.test(inner)) return all;
      const rest = inner.replace(/[぀-ヿ㐀-鿿豈-﫿々～]+/gu, " ").replace(/\s+/g, " ").trim();
      if (!rest) return "";
      // ngoặc đứng đầu một ý ("(挨拶 chào hỏi)", "…; (風呂 bồn tắm)") → bỏ ngoặc; giữa ý → giữ ngoặc
      const startsItem = /(^|[;,])\s*$/.test(whole.slice(0, offset));
      return startsItem ? ` ${rest}` : ` (${rest})`;
    })
    .replace(/\s+/g, " ")
    .replace(/\s+([;,)])/g, "$1")
    .replace(/[;,]\s*$/, "")
    .trim();
}

/** "まか.せる" → "まか", "-おお.いに" → "おお", "なま-" → "なま"; katakana On → hiragana. */
function readingStem(r: string): string {
  const stem = (r.split(".")[0] ?? r).replace(/-/g, "");
  return [...stem].map((c) => (c >= "ァ" && c <= "ヶ" ? String.fromCharCode(c.charCodeAt(0) - 0x60) : c)).join("");
}

const cap = (s: string): string => s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());

export function kanjiHref(char: string): string {
  return `kanji/${char}/`;
}

function lessonLabel(view: KanjiView, level: KanjiLevel, lessons: number[]): string {
  const where = view === "gt" ? `Kanji ${level.toUpperCase()}` : level === "n3" ? "Từ vựng N3" : "Từ vựng";
  return `${where} · Bài ${lessons.join(", ")}`;
}

function explainOf(k: KanjiEntry): string {
  const parts = [k.char];
  if (k.han_viet.length) parts.push(k.han_viet.join(", "));
  if (k.meaning_vi) parts.push(k.meaning_vi);
  const read = [k.on.length ? `On: ${k.on.join("、")}` : "", k.kun.length ? `Kun: ${[...new Set(k.kun.map((x) => kunDisplay(x.replace(/-/g, ""))))].slice(0, 4).join("、")}` : ""].filter(Boolean);
  // mỗi ý một dòng (QuizRunner hiện explain với whitespace-pre-line)
  return [parts.join(" · "), ...read].join("\n");
}

interface Ctx {
  src: KanjiSource;
  view: KanjiView;
  level: KanjiLevel;
  /** Chữ thuộc deck (có bài theo cách xếp + cấp) và bài của nó. */
  mine: KanjiEntry[];
  lessons: Map<string, number[]>;
  radicalOf: Map<number, Radical>;
  /** Chữ bộ thủ hoặc biến thể (亻, 氵) → bộ. */
  radicalByChar: Map<string, Radical>;
  /** Nhớ đệm compSet — so giống hình chạy O(n²) lúc build. */
  comps: Map<string, Set<string>>;
}

/** Thành phần (chữ gốc của biến thể: 亻 → 人) để so "giống hình". */
function compSet(ctx: Ctx, char: string): Set<string> {
  let s = ctx.comps.get(char);
  if (!s) ctx.comps.set(char, (s = new Set((ctx.src.components.get(char) ?? []).map((c) => c.original ?? c.char))));
  return s;
}

/** Ứng viên nhiễu: chữ giống hình trước (chung thành phần, cùng bộ, số nét gần), rồi bài gần. */
function nearest(
  ctx: Ctx,
  target: KanjiEntry,
  value: (k: KanjiEntry) => string | null,
  skip: (k: KanjiEntry) => boolean,
  banned: Set<string>,
): string[] {
  const comps = compSet(ctx, target.char);
  const lesson = ctx.lessons.get(target.char)![0]!;
  const ranked = ctx.mine
    .filter((k) => k !== target && !skip(k))
    .map((k) => {
      const shared = [...compSet(ctx, k.char)].some((c) => comps.has(c));
      const score =
        (shared ? 0 : 100) +
        (k.radical !== null && k.radical === target.radical ? 0 : 40) +
        Math.min(Math.abs((k.strokes ?? 0) - (target.strokes ?? 0)), 10) * 3 +
        Math.min(Math.abs(ctx.lessons.get(k.char)![0]! - lesson), 20);
      return { k, score };
    })
    .sort((a, b) => a.score - b.score || (a.k.char < b.k.char ? -1 : 1));
  const out: string[] = [];
  const seen = new Set(banned);
  for (const { k } of ranked) {
    const v = value(k);
    if (v === null || v === "" || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length >= POOL_SIZE) break;
  }
  return out;
}

function base(ctx: Ctx, kind: string, k: KanjiEntry): Omit<QuizItem, "prompt" | "promptLang" | "answer" | "accepted" | "pool"> {
  const lessons = ctx.lessons.get(k.char)!;
  return {
    id: `${kind}:${k.id}`,
    kind,
    hint: null,
    info: lessonLabel(ctx.view, ctx.level, lessons),
    explain: explainOf(k),
    href: kanjiHref(k.char),
    tags: { level: ctx.level, lesson: lessons },
  };
}

const hvCache = new WeakMap<readonly string[], Set<string>>();
function upperSet(xs: readonly string[]): Set<string> {
  let s = hvCache.get(xs);
  if (!s) hvCache.set(xs, (s = new Set(xs.map((x) => x.toUpperCase()))));
  return s;
}
const overlap = (a: Set<string>, b: Set<string>): boolean => [...a].some((x) => b.has(x));
const keysCache = new WeakMap<KanjiEntry, Set<string>>();
function keysOf(k: KanjiEntry): Set<string> {
  let s = keysCache.get(k);
  if (!s) keysCache.set(k, (s = meaningKeys(kanjiMeaning(k.meaning_vi))));
  return s;
}
const meaningOk = (k: KanjiEntry): boolean => {
  const m = kanjiMeaning(k.meaning_vi);
  return m.length > 0 && !JA.test(m);
};

function hvItems(ctx: Ctx): QuizItem[] {
  return ctx.mine
    .filter((k) => k.han_viet.length > 0)
    .map((k) => {
      const mine = upperSet(k.han_viet);
      return {
        ...base(ctx, "k-hv", k),
        prompt: k.char,
        promptLang: "ja",
        question: "Âm Hán-Việt là gì?",
        answer: k.han_viet[0]!,
        accepted: k.han_viet.slice(1),
        pool: nearest(ctx, k, (x) => x.han_viet[0] ?? null, (x) => overlap(upperSet(x.han_viet), mine), mine),
      };
    });
}

function meanItems(ctx: Ctx): QuizItem[] {
  return ctx.mine.filter(meaningOk).map((k) => {
    const answer = kanjiMeaning(k.meaning_vi);
    const keys = keysOf(k);
    return {
      ...base(ctx, "k-mean", k),
      prompt: k.char,
      promptLang: "ja",
      question: "Nghĩa là gì?",
      answer,
      accepted: [],
      pool: nearest(ctx, k, (x) => (meaningOk(x) ? kanjiMeaning(x.meaning_vi) : null), (x) => overlap(keysOf(x), keys), new Set([answer])),
    };
  });
}

function charItems(ctx: Ctx): QuizItem[] {
  return ctx.mine
    .filter((k) => k.han_viet.length > 0 && meaningOk(k))
    .map((k) => {
      const hv = upperSet(k.han_viet);
      const keys = keysOf(k);
      // cùng âm VÀ cùng ý nghĩa → đề không phân biệt được: không làm nhiễu; nghĩa trùng hệt → cũng đúng
      const twin = (x: KanjiEntry): boolean => overlap(upperSet(x.han_viet), hv) && overlap(keysOf(x), keys);
      const accepted = ctx.mine
        .filter((x) => x !== k && overlap(upperSet(x.han_viet), hv) && kanjiMeaning(x.meaning_vi) === kanjiMeaning(k.meaning_vi))
        .map((x) => x.char);
      return {
        ...base(ctx, "k-char", k),
        prompt: `${k.han_viet.join(", ")} · ${kanjiMeaning(k.meaning_vi)}`,
        promptLang: "vi",
        question: "Chữ nào?",
        answer: k.char,
        accepted,
        pool: nearest(ctx, k, (x) => x.char, twin, new Set([k.char, ...accepted])),
      };
    });
}

/**
 * Q5-3: ≤ 3 từ mỗi chữ — từ giáo trình trước; có 1 từ On và 1 từ Kun nếu chữ có.
 * Bỏ từ chỉ gồm đúng chữ đó (何): đứng riêng thì âm nào của chữ cũng có thể đúng (なに / なん) → không chấm chắc được.
 */
export function pickExamples(k: KanjiEntry, max = 3): KanjiExample[] {
  const ranked = k.examples.filter((e) => e.word !== k.char).sort((a, b) => (a.source === "vocab" ? 0 : 1) - (b.source === "vocab" ? 0 : 1));
  const out: KanjiExample[] = [];
  for (const t of ["on", "kun"] as const) {
    const e = ranked.find((x) => x.reading_type === t);
    if (e) out.push(e);
  }
  for (const e of ranked) {
    if (out.length >= max) break;
    if (!out.includes(e)) out.push(e);
  }
  return out.slice(0, max);
}

/** Đổi âm của chữ trong cách đọc cả từ bằng âm On/Kun khác của chính chữ (だいがく → たいがく, おおがく). */
export function swapReadings(k: KanjiEntry, ex: KanjiExample): string[] {
  const r = ex.reading;
  if (!r || ex.kana.split(r).length !== 2) return [];
  // âm dài/ngắn hơn quá 1 kana (ろ → せぼね: おふせぼね) lộ là sai → bỏ
  const alts = [...new Set([...k.on, ...k.kun].map(readingStem))].filter((x) => x && x !== r && Math.abs(x.length - r.length) <= 1);
  return alts.map((a) => ex.kana.replace(r, a));
}


function readItems(ctx: Ctx): QuizItem[] {
  // mọi cách đọc đúng của một từ (今日: きょう / こんにち) — gom từ mọi chữ, không chỉ deck này
  const valid = new Map<string, Set<string>>();
  for (const k of ctx.src.kanji) for (const e of k.examples) (valid.get(e.word) ?? valid.set(e.word, new Set()).get(e.word)!).add(e.kana);
  // mỗi từ hỏi 1 lần, gắn vào chữ có bài muộn nhất (học tới bài đó thì đã gặp đủ chữ trong deck)
  const chosen = new Map<string, { k: KanjiEntry; ex: KanjiExample }>();
  const late = (k: KanjiEntry): number => ctx.lessons.get(k.char)![0]!;
  for (const k of ctx.mine) {
    for (const ex of pickExamples(k)) {
      const cur = chosen.get(ex.word);
      if (!cur || late(k) > late(cur.k)) chosen.set(ex.word, { k, ex });
    }
  }
  const out: QuizItem[] = [];
  for (const { k, ex } of chosen.values()) {
    const ok = valid.get(ex.word)!;
    const swaps = swapReadings(k, ex).filter((x) => !ok.has(x));
    const machine = misreadings(ex.kana, new Set([...ok, ...swaps]), 6);
    const others = [...new Set(k.examples.map((e) => e.kana))].filter((x) => !ok.has(x) && Math.abs(x.length - ex.kana.length) <= 1);
    const pool = [...new Set([...swaps.slice(0, 4), ...machine, ...others])].filter((x) => !ok.has(x)).slice(0, POOL_SIZE);
    const i = ex.word.indexOf(k.char);
    const prompt = `${ex.word.slice(0, i)}[[${k.char}]]${ex.word.slice(i + 1)}`;
    const meaning = ex.meaning_vi ?? ex.meaning_en;
    const type = ex.reading_type === "on" ? "âm On" : ex.reading_type === "kun" ? "âm Kun" : "cách đọc đặc biệt";
    const b = base(ctx, "k-read", k);
    out.push({
      ...b,
      id: `k-read:${k.id}:${ex.word}`,
      prompt,
      promptLang: "ja",
      question: "Đọc thế nào?",
      hint: meaning ? `nghĩa: ${kanjiMeaning(meaning)}` : null,
      answer: ex.kana,
      accepted: [...ok].filter((x) => x !== ex.kana),
      pool,
      // nghĩa đã ở gợi ý — giải thích chỉ nói chữ đọc thế nào (deck này lớn nhất, ~1.300 câu)
      explain: `${k.char} đọc ${ex.reading ?? "—"} (${type})`,
    });
  }
  return out;
}

const radLabel = (r: Radical, shown = r.char): string => `${shown} · ${r.name_vi}`;

function ofItems(ctx: Ctx): QuizItem[] {
  const used = new Set(ctx.src.kanji.map((k) => k.radical));
  const out: QuizItem[] = [];
  for (const k of ctx.mine) {
    const rad = k.radical === null ? undefined : ctx.radicalOf.get(k.radical);
    if (!rad) continue;
    // chữ chính là bộ thủ (口, 木, 人) → câu hỏi tự trả lời
    if (ctx.radicalByChar.get(k.char) === rad) continue;
    const comps = ctx.src.components.get(k.char) ?? [];
    const isRad = (c: KanjiComponent): boolean => ctx.radicalByChar.get(c.char) === rad || ctx.radicalByChar.get(c.original ?? "") === rad;
    // hiện dạng trong chữ (亻 của 何) — trừ khi dạng đó là một bộ KHÁC (書: KanjiVG ghi 日, gốc 曰 → hiện 曰, không thì nhầm bộ Nhật)
    const form = comps.find(isRad)?.char;
    const shown = form && (ctx.radicalByChar.get(form) ?? rad) === rad ? form : rad.char;
    const answer = radLabel(rad, shown);
    const others: string[] = [];
    const otherChars: string[] = [];
    for (const c of comps) {
      if (isRad(c)) continue;
      const r = ctx.radicalByChar.get(c.char) ?? ctx.radicalByChar.get(c.original ?? "");
      const label = r ? radLabel(r, c.char) : c.name_vi ? `${c.char} · ${cap(c.name_vi)}` : null;
      if (label) {
        others.push(label);
        otherChars.push(c.char);
      }
    }
    const near = ctx.src.radicals
      .filter((r) => r !== rad)
      .map((r) => ({ r, score: Math.abs(r.strokes - rad.strokes) * 10 + (used.has(r.number) ? 0 : 5) + r.number / 1000 }))
      .sort((a, b) => a.score - b.score)
      .map((x) => radLabel(x.r));
    const seen = new Set([answer]);
    const pool: string[] = [];
    for (const v of [...others, ...near]) {
      const ch = v.split(" · ")[0]!;
      if (seen.has(v) || ctx.radicalByChar.get(ch) === rad || [...seen].some((s) => s.split(" · ")[0] === ch)) continue;
      seen.add(v);
      pool.push(v);
      if (pool.length >= POOL_SIZE) break;
    }
    const b = base(ctx, "r-of", k);
    out.push({
      ...b,
      prompt: k.char,
      promptLang: "ja",
      question: "Thuộc bộ thủ nào?",
      answer,
      accepted: [],
      pool,
      explain:
        `${k.char}${k.han_viet.length ? ` (${k.han_viet.join(", ")})` : ""}: bộ ${rad.name_vi.toUpperCase()} ${rad.char}` +
        `${shown !== rad.char ? ` (dạng ${shown})` : ""}, bộ số ${rad.number}` +
        `${otherChars.length ? ` · ${otherChars.join(", ")} chỉ là thành phần` : ""}`,
    });
  }
  return out;
}

function ctxOf(src: KanjiSource, view: KanjiView, level: KanjiLevel): Ctx {
  const lessons = new Map<string, number[]>();
  for (const k of src.kanji) {
    const ls = lessonsOf(k, view, level, src.n3VocabLesson);
    if (ls.length) lessons.set(k.char, ls);
  }
  const radicalByChar = new Map<string, Radical>();
  for (const r of src.radicals) for (const c of [r.char, ...r.variants]) if (!radicalByChar.has(c)) radicalByChar.set(c, r);
  return {
    src,
    view,
    level,
    mine: src.kanji.filter((k) => lessons.has(k.char)),
    lessons,
    radicalOf: new Map(src.radicals.map((r) => [r.number, r])),
    radicalByChar,
    comps: new Map(),
  };
}

/** Một deck chữ (cách xếp × cấp × loại). Câu thiếu nhiễu bị bỏ (dropped); lỗi khác → throw (finalizeDeck). */
export function buildKanjiDeck(src: KanjiSource, view: KanjiView, level: KanjiLevel, slug: KanjiKindSlug): { items: QuizItem[]; dropped: DeckIssue[] } {
  const ctx = ctxOf(src, view, level);
  const items =
    slug === "hv" ? hvItems(ctx) : slug === "nghia" ? meanItems(ctx) : slug === "chu" ? charItems(ctx) : slug === "doc" ? readItems(ctx) : ofItems(ctx);
  return finalizeDeck(items.filter((it) => !leaks(it)).sort((a, b) => a.id.localeCompare(b.id)));
}

// ---------------------------------------------------------------- Bộ thủ (/kanji/bo-thu/quiz/)

/** Phạm vi nhỏ nhất (1 = N5 … 3 = N3, 4 = không chữ nào) có chữ thuộc bộ — chữ thuộc cấp theo cả 2 cách xếp. */
export function radicalScopes(src: KanjiSource): Map<number, number> {
  const out = new Map<number, number>();
  KANJI_LEVELS.forEach((level, i) => {
    for (const k of src.kanji) {
      if (k.radical === null || out.has(k.radical)) continue;
      if (KANJI_VIEWS.some((v) => lessonsOf(k, v, level, src.n3VocabLesson).length > 0)) out.set(k.radical, i + 1);
    }
  });
  return out;
}

const radName = (r: Radical): string => (r.meaning_vi ? `${r.name_vi} · ${r.meaning_vi.charAt(0).toLowerCase()}${r.meaning_vi.slice(1)}` : r.name_vi);
const radChars = (r: Radical): string => [r.char, ...r.variants].join(" ");

export function radicalHref(r: Radical, hasKanji: boolean): string {
  return hasKanji ? `kanji/bo-thu/${r.number}/` : `kanji/bo-thu/#net-${r.strokes}`;
}

export function buildRadicalDeck(src: KanjiSource, slug: RadicalKindSlug): { items: QuizItem[]; dropped: DeckIssue[] } {
  const scopes = radicalScopes(src);
  const kind = RADICAL_KINDS[slug];
  const items: QuizItem[] = src.radicals.map((r) => {
    const near = src.radicals
      .filter((x) => x !== r && x.name_vi.toLowerCase() !== r.name_vi.toLowerCase())
      .map((x) => ({ x, score: Math.abs(x.strokes - r.strokes) * 10 + (scopes.has(x.number) ? 0 : 5) + x.number / 1000 }))
      .sort((a, b) => a.score - b.score)
      .slice(0, POOL_SIZE)
      .map(({ x }) => x);
    const name = radName(r);
    return {
      id: `${kind}:${r.number}`,
      kind,
      prompt: slug === "ten" ? radChars(r) : name,
      promptLang: slug === "ten" ? "ja" : "vi",
      question: slug === "ten" ? "Tên bộ thủ này là gì?" : "Bộ thủ nào?",
      hint: null,
      info: `${r.strokes} nét`,
      answer: slug === "ten" ? name : radChars(r),
      accepted: [],
      pool: near.map((x) => (slug === "ten" ? radName(x) : radChars(x))),
      explain: `${radChars(r)} — bộ ${r.name_vi.toUpperCase()}${r.meaning_vi ? ` (${r.meaning_vi})` : ""}, bộ số ${r.number}, ${r.strokes} nét`,
      href: radicalHref(r, scopes.has(r.number)),
      tags: { strokes: r.strokes, scope: scopes.get(r.number) ?? 4 },
    };
  });
  return finalizeDeck(items.filter((it) => !leaks(it)).sort((a, b) => a.id.localeCompare(b.id)));
}
