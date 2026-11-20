// Quiz từ vựng (Q4, plan/quiz/q04-vocab.md): data/vocabulary → câu hỏi kiểu chung, đóng gói theo cấp × loại câu (Q4-1).
// Hàm thuần — trang endpoint pages/vocabulary/quiz/[deck].json.ts gọi lúc build.
//   v-read  先生 → せんせい            nhiễu: 3 lỗi đọc máy sinh (Q4-3), thiếu thì bù cách đọc từ thật
//   v-mean  {先生|せんせい} → nghĩa     nhiễu: nghĩa từ cùng từ loại, bài gần nhất
//   v-word  nghĩa → {先生|せんせい}     nhiễu: từ cùng từ loại; từ đồng nghĩa vào "Cũng đúng"
//   v-hv    学生 → HỌC SINH            nhiễu: âm Hán-Việt từ có chung chữ, cùng số âm tiết
//   v-cloze câu ví dụ có chỗ trống     từ đích giữ nguyên dạng (Q4-2) hoặc đã chia (Q4b: nhiễu = từ khác cùng thể
//                                      + dạng chia sai của chính từ); gợi ý = câu dịch
import { parseRuby } from "../ruby";
import type { VocabEntry, VocabExample } from "../schemas";
import { badForms, type ConjRow, type ConjTable, shownText as conjText } from "./conjugation";
import { misreadings } from "./kana";
import type { QuizItem } from "./types";
import { normalize } from "./core";
import { partNumbers } from "../vocab-parts";
import { type DeckIssue, finalizeDeck, leaks, rubyForms } from "./validate";

export type VocabLevel = "n5" | "n4" | "n3";
export const VOCAB_LEVELS: readonly VocabLevel[] = ["n5", "n4", "n3"];
/** Chữ trên URL / tên file → kind. */
export const VOCAB_KINDS = { doc: "v-read", nghia: "v-mean", tu: "v-word", hv: "v-hv", dien: "v-cloze" } as const;
export type VocabKindSlug = keyof typeof VOCAB_KINDS;
export const VOCAB_KIND_LABEL: Record<VocabKindSlug, string> = { doc: "Đọc", nghia: "Nghĩa", tu: "Từ", hv: "Hán-Việt", dien: "Điền từ" };
/** Khoảng bài mỗi cấp (D6): N5 = Minna 1–25, N4 = Minna 26–50, N3 = sách N3 1–14. */
export const LEVEL_LESSONS: Record<VocabLevel, { from: number; to: number; label: string }> = {
  n5: { from: 1, to: 25, label: "N5" },
  n4: { from: 26, to: 50, label: "N4" },
  n3: { from: 1, to: 14, label: "N3" },
};

/** = NEAR ở core.ts: makeOptions chỉ bốc trong 6 mục đầu pool, lưu thêm chỉ tốn dung lượng. */
const POOL_SIZE = 6;
const JA = /[぀-ヿ㐀-鿿豈-﫿々]/u;
const BLANK = "＿＿＿";

export function levelOf(e: Pick<VocabEntry, "book" | "lesson">): VocabLevel {
  return e.book === "n3" ? "n3" : e.lesson <= 25 ? "n5" : "n4";
}

/** Thẻ từ trong trang bài (WordCard có id = vocab id). */
export function vocabHref(e: Pick<VocabEntry, "book" | "lesson" | "id">): string {
  return `${e.book === "n3" ? "vocabulary/n3" : "vocabulary"}/${e.lesson}/#${e.id}`;
}

/** Chữ hiển thị của từ: kanji nếu thẻ hiện kanji, không thì kana. */
export const shownText = (e: VocabEntry): string => (e.display === "kanji" && e.kanji ? e.kanji : e.kana);
/** Từ có furigana cả cụm: {先生|せんせい}. */
export const shownRuby = (e: VocabEntry): string => (e.display === "kanji" && e.kanji ? `{${e.kanji}|${e.kana}}` : e.kana);

/** Bỏ ngoặc chứa chữ Nhật ("người (nước) ～ (ví dụ: アメリカじん…)" → "người (nước) ～") — tránh lộ đáp án. */
export function cleanMeaning(m: string): string {
  return m
    .replace(/\s*[(（][^()（）]*[぀-ヿ㐀-鿿][^()（）]*[)）]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Các ý nghĩa tách theo , ; / để so đồng nghĩa ("ô tô, xe hơi" ∩ "xe hơi" ≠ ∅). */
export function meaningKeys(m: string): Set<string> {
  return new Set(
    cleanMeaning(m)
      .replace(/[(（[][^()（）[\]]*[)）\]]/g, "")
      .toLowerCase()
      .split(/[,;/、]/)
      .map((x) => x.replace(/～/g, "").replace(/\s+/g, " ").trim())
      .filter((x) => x.length > 0),
  );
}

const overlap = (a: Set<string>, b: Set<string>): boolean => [...a].some((x) => b.has(x));
const sameWord = (a: VocabEntry, b: VocabEntry): boolean =>
  (a.kanji ?? "") === (b.kanji ?? "") && a.kana === b.kana;
const posGroup = (e: VocabEntry): string => (/^V[123]$/.test(e.pos.code) ? "V" : e.pos.code);
const syllables = (hv: string): number => hv.trim().split(/\s+/).length;

// so đồng nghĩa chạy O(n²) lúc build → nhớ kết quả tách nghĩa theo mục
const keysCache = new WeakMap<VocabEntry, Set<string>>();
function keysOf(e: VocabEntry): Set<string> {
  let k = keysCache.get(e);
  if (!k) keysCache.set(e, (k = meaningKeys(e.meaning_vi)));
  return k;
}

/**
 * Tiêu chí CHẶT — đưa vào "Cũng đúng": cùng từ, liên kết same_word, hoặc nghĩa (đã làm sạch) trùng hoàn toàn
 * (砂糖 / 道 đều "đường", 車 / 自動車 đều "ô tô, xe hơi").
 */
function equivalent(a: VocabEntry, b: VocabEntry): boolean {
  return (
    sameWord(a, b) ||
    a.same_word.includes(b.id) ||
    b.same_word.includes(a.id) ||
    cleanMeaning(a.meaning_vi).toLowerCase() === cleanMeaning(b.meaning_vi).toLowerCase()
  );
}

/**
 * Tiêu chí RỘNG — loại khỏi đáp án nhiễu: equivalent, hoặc có chung một ý nghĩa ("anh/ chị" ∩ "Anh" (nước)).
 * Rộng để chắc chắn không bao giờ chấm sai một đáp án đúng; không dùng cho "Cũng đúng" (sẽ liệt kê nhầm イギリス).
 */
function synonymous(a: VocabEntry, b: VocabEntry): boolean {
  return sameWord(a, b) || a.same_word.includes(b.id) || b.same_word.includes(a.id) || overlap(keysOf(a), keysOf(b));
}

function lessonLabel(level: VocabLevel, lessons: number[]): string {
  return `${level === "n3" ? "N3 · " : ""}Bài ${lessons.join(", ")}`;
}

function explainOf(e: VocabEntry): string {
  const word = e.kanji && e.display === "kanji" ? `${e.kanji}（${e.kana}）` : e.kana;
  return `${word} — ${cleanMeaning(e.meaning_vi)}${e.han_viet ? ` · ${e.han_viet}` : ""}`;
}

/** Số thứ tự trong danh sách từ của bài (mn-11-033 → 33, n3-001 → 1). */
const positionOf = (e: VocabEntry): number => Number(/(\d+)$/.exec(e.id)?.[1] ?? 0);

/**
 * Ứng viên nhiễu: cùng từ loại trước, rồi gần bài; duy nhất theo `value`, bỏ theo `skip`.
 * `thematic` (câu nghĩa): cùng bài thì từ đứng gần trong danh sách trước — sách xếp từ theo chủ đề (お兄さん cạnh
 * お姉さん, 弟さん), thay vì luôn là các từ đầu bài theo ID (bài 11: ひとつ…とお → "hai cái / ba cái" cho mọi danh từ).
 * Không dùng cho câu điền từ: nhiễu cùng chủ đề dễ cũng hợp câu (お兄さん/お姉さんは何歳ですか).
 */
function nearest(
  target: VocabEntry,
  pool: readonly VocabEntry[],
  value: (e: VocabEntry) => string | null,
  skip: (e: VocabEntry) => boolean,
  banned: Set<string>,
  n = POOL_SIZE,
  thematic = false,
): string[] {
  const g = posGroup(target);
  const at = positionOf(target);
  const ranked = pool
    .filter((e) => e !== target && !skip(e))
    .map((e) => ({
      e,
      score: (posGroup(e) === g ? 0 : 1e6) + Math.abs(e.lesson - target.lesson) * 1000 + (thematic ? Math.abs(positionOf(e) - at) : 0),
    }))
    .sort((a, b) => a.score - b.score || a.e.id.localeCompare(b.e.id));
  const out: string[] = [];
  const seen = new Set(banned);
  for (const { e } of ranked) {
    const v = value(e);
    if (v === null || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length >= n) break;
  }
  return out;
}

// Học theo phần (lib/vocab-parts.ts): tag `part` = "<bài>-<phần>" của từ, tính trên CẢ bài theo thứ tự data
// (giống trang bài) — trang quiz lọc ?tu=N&den=N&phan=P bằng part = ["N-P"]. Khóa theo object entry.
const PART = new WeakMap<VocabEntry, string>();
function indexParts(mine: readonly VocabEntry[]): void {
  const byLesson = new Map<number, VocabEntry[]>();
  for (const e of mine) (byLesson.get(e.lesson) ?? byLesson.set(e.lesson, []).get(e.lesson)!).push(e);
  for (const [lesson, entries] of byLesson) {
    const parts = partNumbers(entries);
    entries.forEach((e, i) => PART.set(e, `${lesson}-${parts[i]}`));
  }
}
function partOf(e: VocabEntry): string {
  const p = PART.get(e);
  if (p === undefined) throw new Error(`${e.id}: chưa tính phần (indexParts)`);
  return p;
}

interface Group {
  first: VocabEntry;
  lessons: number[];
  parts: string[];
}

/** Gộp câu hỏi giống nhau (từ lặp ở nhiều bài) theo khóa; giữ mục đầu tiên, gom danh sách bài + phần. */
function groupBy(entries: readonly VocabEntry[], key: (e: VocabEntry) => string | null): Group[] {
  const map = new Map<string, Group>();
  for (const e of entries) {
    const k = key(e);
    if (k === null) continue;
    const g = map.get(k);
    if (g) {
      if (!g.lessons.includes(e.lesson)) g.lessons.push(e.lesson);
      if (!g.parts.includes(partOf(e))) g.parts.push(partOf(e));
    } else map.set(k, { first: e, lessons: [e.lesson], parts: [partOf(e)] });
  }
  for (const g of map.values()) g.lessons.sort((a, b) => a - b);
  return [...map.values()];
}

function baseItem(kind: string, g: Group, level: VocabLevel): Omit<QuizItem, "prompt" | "promptLang" | "answer" | "accepted" | "pool"> {
  const e = g.first;
  return {
    id: `${kind}:${e.id}`,
    kind,
    hint: null,
    info: lessonLabel(level, g.lessons),
    explain: explainOf(e),
    href: vocabHref(e),
    tags: { level, lesson: g.lessons, part: g.parts, pos: e.pos.code },
  };
}

function readItems(all: readonly VocabEntry[], level: VocabLevel, mine: readonly VocabEntry[]): QuizItem[] {
  const byKanji = new Map<string, VocabEntry[]>();
  for (const e of all) if (e.kanji) (byKanji.get(e.kanji) ?? byKanji.set(e.kanji, []).get(e.kanji)!).push(e);
  const eligible = mine.filter((e) => e.kanji && e.display === "kanji");
  return groupBy(eligible, (e) => `${e.kanji}|${e.kana}`).map((g) => {
    const e = g.first;
    const others = (byKanji.get(e.kanji!) ?? []).filter((x) => x.kana !== e.kana);
    // cùng chữ, khác cách đọc (降ります ふります/おります, 開きます あきます/ひらきます): chỉ nhìn chữ thì cách nào
    // cũng đúng → nhận hết, và gợi ý hiện nghĩa để người học biết đáp án chính là từ nào
    const accepted = [...new Set(others.map((x) => x.kana))];
    const homograph = accepted.length > 0;
    const valid = new Set([e.kana, ...accepted]);
    const machine = misreadings(e.kana, valid, 6);
    const pool =
      machine.length >= 3
        ? machine
        : [
            ...machine,
            ...nearest(
              e,
              mine.filter((x) => Math.abs([...x.kana].length - [...e.kana].length) <= 1),
              (x) => x.kana,
              (x) => valid.has(x.kana),
              new Set([...valid, ...machine]),
              3 - machine.length,
            ),
          ];
    const base = baseItem("v-read", g, level);
    return {
      ...base,
      prompt: e.kanji!,
      promptLang: "ja",
      question: "Đọc thế nào?",
      hint: homograph ? `nghĩa: ${cleanMeaning(e.meaning_vi)}` : null,
      answer: e.kana,
      accepted,
      pool,
    };
  });
}

const meaningOk = (e: VocabEntry): boolean => {
  const m = cleanMeaning(e.meaning_vi);
  return m.length > 0 && !JA.test(m);
};

function meanItems(level: VocabLevel, mine: readonly VocabEntry[]): QuizItem[] {
  const eligible = mine.filter(meaningOk);
  return groupBy(eligible, (e) => `${shownText(e)}|${cleanMeaning(e.meaning_vi)}`).map((g) => {
    const e = g.first;
    const answer = cleanMeaning(e.meaning_vi);
    return {
      ...baseItem("v-mean", g, level),
      prompt: shownRuby(e),
      promptLang: "ja",
      question: "Nghĩa là gì?",
      answer,
      accepted: [],
      pool: nearest(e, eligible, (x) => cleanMeaning(x.meaning_vi), (x) => synonymous(e, x), new Set([answer]), POOL_SIZE, true),
    };
  });
}

function wordItems(level: VocabLevel, mine: readonly VocabEntry[]): QuizItem[] {
  const eligible = mine.filter(meaningOk);
  return groupBy(eligible, (e) => `${cleanMeaning(e.meaning_vi)}|${shownText(e)}`).map((g) => {
    const e = g.first;
    const syn = eligible.filter((x) => x !== e && equivalent(e, x) && shownText(x) !== shownText(e));
    const accepted = [...new Map(syn.map((x) => [shownText(x), shownRuby(x)])).values()];
    const banned = new Set([shownText(e), ...syn.map(shownText)]);
    // so theo chữ hiển thị (checkDeck so phần chữ, bỏ furigana) rồi mới đổi sang ruby
    const texts = nearest(e, eligible, shownText, (x) => synonymous(e, x), banned, POOL_SIZE, true);
    const rubyOf = new Map(eligible.map((x) => [shownText(x), shownRuby(x)]));
    return {
      ...baseItem("v-word", g, level),
      prompt: cleanMeaning(e.meaning_vi),
      promptLang: "vi",
      question: "Từ nào có nghĩa này?",
      answer: shownRuby(e),
      accepted,
      pool: texts.map((t) => rubyOf.get(t)!),
    };
  });
}

function hvItems(level: VocabLevel, mine: readonly VocabEntry[]): QuizItem[] {
  const eligible = mine.filter((e) => e.kanji && e.display === "kanji" && e.han_viet);
  return groupBy(eligible, (e) => `${e.kanji}|${e.han_viet}`).map((g) => {
    const e = g.first;
    const answer = e.han_viet!;
    const refs = new Set(e.kanji_refs);
    const n = syllables(answer);
    // ưu tiên âm của từ có chung chữ, cùng số âm tiết; rồi cùng số âm tiết; rồi bất kỳ
    const ranked = eligible
      .filter((x) => x !== e && x.han_viet!.toUpperCase() !== answer.toUpperCase() && x.kanji !== e.kanji)
      .map((x) => ({
        x,
        score: (x.kanji_refs.some((r) => refs.has(r)) ? 0 : 100) + (syllables(x.han_viet!) === n ? 0 : 1000) + Math.abs(x.lesson - e.lesson),
      }))
      .sort((a, b) => a.score - b.score || a.x.id.localeCompare(b.x.id));
    const pool = [...new Set(ranked.map((r) => r.x.han_viet!))].slice(0, POOL_SIZE);
    return {
      ...baseItem("v-hv", g, level),
      prompt: e.kanji!,
      promptLang: "ja",
      question: "Âm Hán-Việt là gì?",
      answer,
      accepted: [],
      pool,
    };
  });
}

/** Từ đích [[…]] của câu ví dụ có giữ nguyên dạng của từ không (Q4-2). */
export function clozeTarget(e: VocabEntry, ex: VocabExample): string | null {
  const m = /\[\[(.*?)\]\]/u.exec(ex.ruby);
  if (!m) return null;
  const segs = parseRuby(m[1]!);
  const text = segs.map((s) => s.text).join("");
  const reading = segs.map((s) => s.reading ?? s.text).join("");
  // trường ghi nhiều cách viết "夫 /主人", "おじいさん／ おじいちゃん" → mỗi cách viết là một dạng hợp lệ
  const forms = new Set([e.kana, e.kanji ?? ""].flatMap(splitWritings).map((x) => x.replace(/～/g, "")).filter(Boolean));
  return forms.has(text) || forms.has(reading) ? m[1]! : null;
}

/** "夫 /主人" → ["夫", "主人"]; dấu "/" nằm ngoài ngoặc ruby (cũng tách được chuỗi ruby {夫|おっと} /{主人|しゅじん}). */
function splitWritings(s: string): string[] {
  return s.split(/\s*[/／]\s*/u).map((x) => x.trim()).filter(Boolean);
}

function clozeItems(level: VocabLevel, mine: readonly VocabEntry[], conj: readonly ConjTable[]): QuizItem[] {
  const out: QuizItem[] = inflectedClozeItems(level, mine, conj);
  const rubyOf = new Map(mine.map((x) => [shownText(x), shownRuby(x)]));
  // danh từ riêng: câu dịch giữ nguyên tên (新神戸 → "ga Shin-Kobe") → lộ đáp án
  for (const e of mine.filter((x) => x.pos.code !== "PN")) {
    for (const ex of e.examples) {
      const target = clozeTarget(e, ex);
      if (target === null) continue;
      const prompt = ex.ruby.replace(/\[\[.*?\]\]/u, BLANK);
      const answerText = parseRuby(target).map((s) => s.text).join("");
      const banned = new Set([answerText, shownText(e)]);
      const texts = nearest(e, mine, shownText, (x) => synonymous(e, x) || x.lesson > Math.max(ex.max_lesson, e.lesson), banned);
      out.push({
        id: `v-cloze:${ex.id}`,
        kind: "v-cloze",
        prompt,
        promptLang: "ja",
        question: "Điền từ thích hợp",
        hint: ex.vi,
        info: lessonLabel(level, [e.lesson]),
        answer: target,
        accepted: [],
        // từ ghi nhiều cách viết làm nhiễu → chỉ hiện cách viết đầu (おじいさん, không phải "おじいさん／ おじいちゃん");
        // bỏ ～ (～から, {～語|～ご}): trong câu điền từ ～ vô nghĩa và lộ đáp án (đáp án と không có ～)
        pool: [...new Set(texts.map((t) => splitWritings(rubyOf.get(t)!)[0]!.replace(/～/gu, "")))].filter(
          (p) => p !== "" && conjText(p) !== conjText(target),
        ),
        explain: explainOf(e),
        href: vocabHref(e),
        tags: { level, lesson: [e.lesson], part: [partOf(e)], pos: e.pos.code },
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------- Q4b: điền từ cho từ đích đã chia

/** Số dạng chia sai tối đa trong pool (Q4b-4); còn lại là từ khác cùng thể. */
const BAD_FORMS = 2;
const KANA_TAIL = /^[\u3041-\u309f]+$/u;

interface ConjRef {
  row: ConjRow;
  table: ConjTable;
}

/**
 * Hàng bảng chia của từ: theo ID; không có (từ lặp ở bài sau: 休みます bài 11) → từ cùng chữ (`same_word`), rồi
 * `aliases` của bảng chia (từ N3 trùng Minna: n3-101 倒れる → hàng mn-39-002), rồi cùng dạng gốc.
 * `same_word` đứng trước `aliases`: alias gộp theo kana nên có thể trỏ sang từ khác nghĩa (mn-22-004 掛けます
 * "đeo kính" là alias của mn-07-009 かけます "gọi điện"), còn `same_word` theo đúng chữ.
 */
function conjIndex(conj: readonly ConjTable[]): (e: VocabEntry) => ConjRef | undefined {
  const byId = new Map<string, ConjRef>();
  const byAlias = new Map<string, ConjRef>();
  const byBase = new Map<string, ConjRef>();
  for (const table of conj)
    for (const row of table.rows) {
      byId.set(row.id, { row, table });
      for (const a of row.aliases ?? []) if (!byAlias.has(a)) byAlias.set(a, { row, table });
      const k = `${row.book}|${conjText(row.base)}`;
      if (!byBase.has(k)) byBase.set(k, { row, table });
    }
  return (e) =>
    byId.get(e.id) ??
    e.same_word.map((id) => byId.get(id)).find((x) => x !== undefined) ??
    byAlias.get(e.id) ??
    byBase.get(`${e.book}|${conjText(shownRuby(e))}`) ??
    byBase.get(`${e.book}|${conjText(e.kana)}`);
}

/**
 * Thể phái sinh (bước 2.1, plan/quiz/q04b-cloze-inflected.md): sinh từ ô bảng chia có sẵn bằng cắt đuôi `cut` + nối
 * `add` — không thêm thể vào data/conjugation.json (trang /chia-the/ và quiz chia thể giữ 20 thể).
 *   褒められる (passive) − る + ました = 褒められました · 払わない (nai) − い + ければなりません · 切れます (masu) − ます = 切れ
 * `lesson` = bài học cấu trúc đó (lấy max với bài của thể gốc). Thể có sẵn luôn được thử trước (câu cũ không đổi).
 */
interface DerivedForm {
  id: string;
  name: string;
  lesson: number | null;
  base: string;
  cut: string;
  add: string;
}
const ICHIDAN_POLITE: [string, string][] = [["ます", "ます"], ["ました", "ました"], ["ません", "ません"], ["ませんでした", "ませんでした"], ["て", "て"]];
const DERIVED: Partial<Record<ConjTable["group"], DerivedForm[]>> = {
  verb: [
    // thể bị động / sai khiến / khả năng là động từ nhóm II → chia tiếp như 食べる
    ...([["passive", "Thể bị động", 37], ["causative", "Thể sai khiến", 48], ["potential", "Thể khả năng", 27]] as const).flatMap(
      ([base, name, lesson]) => ICHIDAN_POLITE.map(([add, label]) => ({ id: `${base}+${add}`, name: `${name} → ${label}`, lesson, base, cut: "る", add })),
    ),
    { id: "nai+nakereba-narimasen", name: "Thể ない → なければなりません", lesson: 17, base: "nai", cut: "い", add: "ければなりません" },
    { id: "nai+nakereba-naranai", name: "Thể ない → なければならない", lesson: 17, base: "nai", cut: "い", add: "ければならない" },
    { id: "nai+nakutemo", name: "Thể ない → なくても", lesson: 17, base: "nai", cut: "い", add: "くても" },
    { id: "nai+nakute", name: "Thể ない → なくて", lesson: 39, base: "nai", cut: "い", add: "くて" },
    { id: "nai+nakereba", name: "Thể ない → なければ", lesson: 35, base: "nai", cut: "い", add: "ければ" },
    { id: "masu-stem", name: "Thân ます", lesson: 13, base: "masu", cut: "ます", add: "" },
  ],
  // gốc tính từ い trước そう / すぎる (美味しそう, 濃すぎる); いい → よさ: không sinh (kiểm theo thể phủ định)
  "adj-i": [{ id: "stem", name: "Gốc tính từ (bỏ い)", lesson: 43, base: "plain", cut: "い", add: "" }],
};

type AnyForm = { id: string; name: string; lesson: number | null };

/** Ô chia (ruby) của `row` ở thể có sẵn hoặc thể phái sinh; không sinh được → null. */
function cellOf(row: ConjRow, group: ConjTable["group"], formId: string): string | null {
  const own = row.forms[formId];
  if (own) return own[0];
  const d = (DERIVED[group] ?? []).find((x) => x.id === formId);
  const base = d ? row.forms[d.base]?.[0] : undefined;
  if (!d || !base?.endsWith(d.cut)) return null;
  const head = base.slice(0, base.length - d.cut.length);
  if (group === "adj-i" && !(row.forms.neg?.[0] ?? "").startsWith(head)) return null; // いい: thể phủ định よくない
  return head + d.add;
}

/** Biến một dạng (đúng hoặc sai) của thể gốc thành thể phái sinh; thể có sẵn → giữ nguyên. */
function deriveFrom(group: ConjTable["group"], formId: string, ruby: string): string | null {
  const d = (DERIVED[group] ?? []).find((x) => x.id === formId);
  if (!d) return ruby;
  return ruby.endsWith(d.cut) ? ruby.slice(0, ruby.length - d.cut.length) + d.add : null;
}

const allForms = (table: ConjTable): AnyForm[] => [...table.forms, ...(DERIVED[table.group] ?? [])];
const baseFormId = (group: ConjTable["group"], formId: string): string => (DERIVED[group] ?? []).find((x) => x.id === formId)?.base ?? formId;
/** Bài học của thể (phái sinh: max với bài thể gốc). */
function formLesson(table: ConjTable, form: AnyForm): number | null {
  const d = (DERIVED[table.group] ?? []).find((x) => x.id === form.id);
  if (!d) return form.lesson;
  const base = table.forms.find((f) => f.id === d.base)?.lesson ?? null;
  return base === null || d.lesson === null ? null : Math.max(base, d.lesson);
}

type FormHit = { form: AnyForm; tail: string };

/** Thân ます / gốc tính từ chỉ nối với đuôi có nghĩa (切れそう, 与えすぎないで, 食べながら, 迎えに) — không nhận đuôi bất kỳ
 * (足りなかったら không phải thân 足り + なかったら). */
const STEM_FORMS = new Set(["masu-stem", "stem"]);
const STEM_TAIL = /^(そう|すぎ|ながら|に)/u;

/**
 * Khớp chuỗi `t` với ô bảng chia (đã đưa về cùng dạng bằng `key`): đúng một thể, hoặc thể + đuôi kana ngắn nhất.
 * Thể có sẵn trước, thể phái sinh sau (khớp đúng ở thể có sẵn thắng; đuôi ngắn hơn thắng).
 */
function matchBy(ref: ConjRef, t: string, key: (ruby: string) => string): FormHit | null {
  let best: FormHit | null = null;
  for (const form of allForms(ref.table)) {
    const cell = cellOf(ref.row, ref.table.group, form.id);
    if (!cell) continue;
    const f = key(cell);
    if (f === t) return { form, tail: "" };
    const tail = t.slice(f.length);
    if (STEM_FORMS.has(form.id) && !STEM_TAIL.test(tail)) continue;
    if (t.startsWith(f) && KANA_TAIL.test(tail) && (best === null || tail.length < best.tail.length)) best = { form, tail };
  }
  return best;
}

const readingOf = (ruby: string): string => normalize(rubyForms(ruby).reading);

/**
 * Thể của cụm đích: khớp đúng một thể (行きました = mashita), hoặc thể + đuôi kana cố định (忘れないで = nai + で,
 * 掃除したり = ta + り). Nhiều thể trùng chữ (V2 khả năng = bị động) → thể học trước. Không khớp mặt chữ → khớp theo
 * cách đọc (`byReading`): câu ví dụ luôn viết kanji (rule vocab-examples) còn bảng chia theo `display` của từ
 * (点けて ↔ つけて), hoặc chữ khác cùng âm (診て ↔ 見て, 量って ↔ 測って). Không khớp → null (bỏ qua).
 */
function matchForm(ref: ConjRef, target: string): (FormHit & { byReading: boolean }) | null {
  const surface = matchBy(ref, conjText(target), conjText);
  if (surface) return { ...surface, byReading: false };
  const reading = matchBy(ref, readingOf(target), readingOf);
  return reading ? { ...reading, byReading: true } : null;
}

/**
 * Viết dạng chia sai theo đúng chữ của câu ví dụ (khi khớp theo cách đọc): phần đầu của cụm đích tới chữ Hán cuối
 * ({点|つ}けて → {点|つ}) thay cho phần đọc tương ứng của dạng sai (つけって → {点|つ}けって) — để đáp án và dạng sai
 * cùng kiểu chữ, không lộ đáp án. Dạng sai không bắt đầu bằng phần đọc đó → null (bỏ).
 */
function inTargetScript(target: string, wrong: string): string | null {
  const i = target.lastIndexOf("}");
  if (i < 0) return wrong;
  const head = target.slice(0, i + 1);
  const r = rubyForms(head).reading;
  const w = rubyForms(wrong).reading;
  return w.startsWith(r) && KANA_TAIL.test(w.slice(r.length)) ? head + w.slice(r.length) : null;
}

function inflectedClozeItems(level: VocabLevel, mine: readonly VocabEntry[], conj: readonly ConjTable[]): QuizItem[] {
  if (conj.length === 0) return [];
  const refOf = conjIndex(conj);
  const entryOf = new Map(mine.map((x) => [x.id, x]));
  const out: QuizItem[] = [];
  for (const e of mine.filter((x) => x.pos.code !== "PN")) {
    const ref = refOf(e);
    if (!ref) continue;
    for (const ex of e.examples) {
      const m = /\[\[(.*?)\]\]/u.exec(ex.ruby);
      if (!m || clozeTarget(e, ex) !== null) continue;
      const target = m[1]!;
      const hit = matchForm(ref, target);
      if (!hit) continue;
      const { form, tail, byReading } = hit;
      const group = ref.table.group;
      const upTo = Math.max(ex.max_lesson, e.lesson);
      const lesson = formLesson(ref.table, form);
      // thể chưa học tới bài của câu → bỏ (N3: thể theo bài Minna, người học N3 đã học hết)
      if (e.book === "minna" && (lesson === null || lesson > upTo)) continue;
      const answerText = conjText(target);
      const seen = new Set([answerText]);
      const pool: string[] = [];
      const push = (ruby: string): boolean => {
        const k = conjText(ruby);
        if (seen.has(k)) return false;
        seen.add(k);
        pool.push(ruby);
        return true;
      };
      // dạng chia sai của chính từ (行きて) — không bao giờ đúng
      let bad = 0;
      // mọi dạng đúng của chính từ (thể có sẵn + phái sinh) — dạng sai không được trùng
      const rightReadings = new Set(
        allForms(ref.table)
          .map((f) => cellOf(ref.row, group, f.id))
          .filter((c): c is string => c !== null)
          .map(readingOf),
      );
      for (const b of badForms(ref.row, baseFormId(group, form.id))) {
        if (bad >= BAD_FORMS) break;
        const c = deriveFrom(group, form.id, b);
        if (c === null) continue;
        const w = byReading ? inTargetScript(target, c + tail) : c + tail;
        if (w !== null && !rightReadings.has(readingOf(w)) && push(w)) bad++;
      }
      // từ khác cùng nhóm (động từ / tính từ い / な), cùng thể + cùng đuôi; đã học tới bài của câu; gần bài trước
      const others = ref.table.rows
        // N3: người học đã học hết Minna → từ Minna cũng là nhiễu hợp lệ (hàng của từ N3 trùng Minna mang book "minna")
        .filter((r) => r !== ref.row && (r.book === e.book ? r.lesson <= upTo : e.book === "n3") && cellOf(r, group, form.id) !== null)
        .filter((r) => {
          const x = entryOf.get(r.id);
          return !x || !synonymous(e, x);
        })
        .sort(
          (a, b) =>
            Number(a.book !== e.book) - Number(b.book !== e.book) ||
            Math.abs(a.lesson - e.lesson) - Math.abs(b.lesson - e.lesson) ||
            a.id.localeCompare(b.id),
        );
      for (const r of others) {
        if (pool.length >= POOL_SIZE) break;
        if (conjText(r.base) === conjText(ref.row.base)) continue;
        const w = cellOf(r, group, form.id)! + tail;
        // đồng âm cùng thể (付いて ↔ ついて của つきます "đèn sáng") = cùng cách đọc với đáp án → chọn vẫn là đúng
        if (readingOf(w) === readingOf(target)) continue;
        push(w);
      }
      out.push({
        id: `v-cloze:${ex.id}`,
        kind: "v-cloze",
        prompt: ex.ruby.replace(/\[\[.*?\]\]/u, BLANK),
        promptLang: "ja",
        question: "Điền từ thích hợp",
        hint: ex.vi,
        info: lessonLabel(level, [e.lesson]),
        answer: target,
        accepted: [],
        pool,
        explain: `${parseRuby(target).map((s) => s.text).join("")} = ${form.name}${tail ? ` + ${tail}` : ""} · ${explainOf(e)}`,
        href: vocabHref(e),
        tags: { level, lesson: [e.lesson], part: [partOf(e)], pos: e.pos.code },
      });
    }
  }
  return out;
}

/**
 * Một deck (cấp × loại câu). `all` = toàn bộ từ vựng (Minna + N3) — dùng để biết mọi cách đọc đúng của một chữ;
 * nhiễu chỉ lấy trong cùng cấp. Câu thiếu nhiễu bị bỏ (dropped); lỗi khác → throw (finalizeDeck).
 */
export function buildVocabDeck(
  all: readonly VocabEntry[],
  level: VocabLevel,
  slug: VocabKindSlug,
  conj: readonly ConjTable[] = [],
): { items: QuizItem[]; dropped: DeckIssue[] } {
  const mine = all.filter((e) => levelOf(e) === level);
  indexParts(mine);
  const items =
    slug === "doc"
      ? readItems(all, level, mine)
      : slug === "nghia"
        ? meanItems(level, mine)
        : slug === "tu"
          ? wordItems(level, mine)
          : slug === "hv"
            ? hvItems(level, mine)
            : clozeItems(level, mine, conj);
  // câu tự lộ đáp án (hỏi "đĩa CD" → CD; chỗ trống mà furigana câu chứa cách đọc đáp án) → bỏ trước khi kiểm
  return finalizeDeck(items.filter((it) => !leaks(it)).sort((a, b) => a.id.localeCompare(b.id)));
}
