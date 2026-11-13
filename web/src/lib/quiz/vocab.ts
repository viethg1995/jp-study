// Quiz từ vựng (Q4, plan/quiz/q04-vocab.md): data/vocabulary → câu hỏi kiểu chung, đóng gói theo cấp × loại câu (Q4-1).
// Hàm thuần — trang endpoint pages/vocabulary/quiz/[deck].json.ts gọi lúc build.
//   v-read  先生 → せんせい            nhiễu: 3 lỗi đọc máy sinh (Q4-3), thiếu thì bù cách đọc từ thật
//   v-mean  {先生|せんせい} → nghĩa     nhiễu: nghĩa từ cùng từ loại, bài gần nhất
//   v-word  nghĩa → {先生|せんせい}     nhiễu: từ cùng từ loại; từ đồng nghĩa vào "Cũng đúng"
//   v-hv    学生 → HỌC SINH            nhiễu: âm Hán-Việt từ có chung chữ, cùng số âm tiết
//   v-cloze câu ví dụ có chỗ trống     chỉ khi từ đích giữ nguyên dạng (Q4-2); gợi ý = câu dịch
import { parseRuby } from "../ruby";
import type { VocabEntry, VocabExample } from "../schemas";
import { misreadings } from "./kana";
import type { QuizItem } from "./types";
import { type DeckIssue, finalizeDeck, leaks } from "./validate";

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

interface Group {
  first: VocabEntry;
  lessons: number[];
}

/** Gộp câu hỏi giống nhau (từ lặp ở nhiều bài) theo khóa; giữ mục đầu tiên, gom danh sách bài. */
function groupBy(entries: readonly VocabEntry[], key: (e: VocabEntry) => string | null): Group[] {
  const map = new Map<string, Group>();
  for (const e of entries) {
    const k = key(e);
    if (k === null) continue;
    const g = map.get(k);
    if (g) {
      if (!g.lessons.includes(e.lesson)) g.lessons.push(e.lesson);
    } else map.set(k, { first: e, lessons: [e.lesson] });
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
    tags: { level, lesson: g.lessons, pos: e.pos.code },
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
  const forms = new Set([e.kana, e.kanji ?? ""].map((x) => x.replace(/～/g, "")).filter(Boolean));
  return forms.has(text) || forms.has(reading) ? m[1]! : null;
}

function clozeItems(level: VocabLevel, mine: readonly VocabEntry[]): QuizItem[] {
  const out: QuizItem[] = [];
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
        pool: texts.map((t) => rubyOf.get(t)!),
        explain: explainOf(e),
        href: vocabHref(e),
        tags: { level, lesson: [e.lesson], pos: e.pos.code },
      });
    }
  }
  return out;
}

/**
 * Một deck (cấp × loại câu). `all` = toàn bộ từ vựng (Minna + N3) — dùng để biết mọi cách đọc đúng của một chữ;
 * nhiễu chỉ lấy trong cùng cấp. Câu thiếu nhiễu bị bỏ (dropped); lỗi khác → throw (finalizeDeck).
 */
export function buildVocabDeck(all: readonly VocabEntry[], level: VocabLevel, slug: VocabKindSlug): { items: QuizItem[]; dropped: DeckIssue[] } {
  const mine = all.filter((e) => levelOf(e) === level);
  const items =
    slug === "doc"
      ? readItems(all, level, mine)
      : slug === "nghia"
        ? meanItems(level, mine)
        : slug === "tu"
          ? wordItems(level, mine)
          : slug === "hv"
            ? hvItems(level, mine)
            : clozeItems(level, mine);
  // câu tự lộ đáp án (hỏi "đĩa CD" → CD; chỗ trống mà furigana câu chứa cách đọc đáp án) → bỏ trước khi kiểm
  return finalizeDeck(items.filter((it) => !leaks(it)).sort((a, b) => a.id.localeCompare(b.id)));
}
