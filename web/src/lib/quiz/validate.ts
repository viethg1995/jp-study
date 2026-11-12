// Kiểm deck (plan/quiz.md §3, 5 quy tắc). Test của mọi deck gọi checkDeck; hàm sinh câu hỏi gọi finalizeDeck.
import { parseRuby } from "../ruby";
import { normalize } from "./core";
import type { QuizItem } from "./types";

export type DeckRule = "duplicate-id" | "answer-in-pool" | "pool-too-small" | "bad-ruby" | "leak";

export interface DeckIssue {
  id: string;
  rule: DeckRule;
  detail: string;
}

/** Số đáp án nhiễu tối thiểu để có 4 lựa chọn. */
export const MIN_POOL = 3;

// Toàn chuỗi phải là dãy token ruby hợp lệ — parseRuby bỏ qua ký tự lạ ({ lẻ, | ngoài ngoặc) nên không tự báo lỗi.
const RUBY_FULL = /^(?:\[\[|\]\]|\{[^{}|[\]]+\|[^{}|[\]]+\}|[^[\]{}|])*$/u;

/** Chuỗi ruby hợp lệ: token đúng cú pháp và [[ ]] đóng mở đúng cặp, không lồng. */
export function isValidRuby(s: string): boolean {
  if (!RUBY_FULL.test(s)) return false;
  let open = false;
  for (const m of s.matchAll(/\[\[|\]\]/g)) {
    if ((m[0] === "[[") === open) return false;
    open = !open;
  }
  return !open;
}

/** Chữ hiển thị (bỏ furigana) và cách đọc (furigana thay cho chữ có ruby). */
export function rubyForms(s: string): { text: string; reading: string } {
  const segs = parseRuby(s);
  return { text: segs.map((x) => x.text).join(""), reading: segs.map((x) => x.reading ?? x.text).join("") };
}

export function checkDeck(items: readonly QuizItem[]): DeckIssue[] {
  const issues: DeckIssue[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const add = (rule: DeckRule, detail: string): void => {
      issues.push({ id: it.id, rule, detail });
    };
    // 3. id duy nhất
    if (seen.has(it.id)) add("duplicate-id", it.id);
    seen.add(it.id);

    // 4. ruby parse trọn vẹn
    for (const s of [it.prompt, it.answer, ...it.accepted, ...it.pool]) {
      if (!isValidRuby(s)) add("bad-ruby", s);
    }

    // 1. đáp án đúng không lọt vào nhiễu (so sau chuẩn hóa + bỏ ruby, vì người học thấy chữ hiển thị)
    const shown = (s: string): string => normalize(rubyForms(s).text);
    const correct = new Set([it.answer, ...it.accepted].map(shown));
    for (const p of it.pool) if (correct.has(shown(p))) add("answer-in-pool", p);

    // 2. đủ nhiễu khác nhau, không trùng
    const distinct = new Set(it.pool.map(shown));
    if (distinct.size !== it.pool.length) add("pool-too-small", `pool có mục trùng: ${it.pool.join(", ")}`);
    else if (distinct.size < MIN_POOL) add("pool-too-small", `chỉ ${distinct.size} đáp án nhiễu`);

    // 5. câu hỏi không lộ đáp án (cả chữ hiển thị lẫn furigana của prompt)
    const p = rubyForms(it.prompt), a = rubyForms(it.answer);
    const hay = [normalize(p.text), normalize(p.reading)];
    const needles = [...new Set([normalize(a.text), normalize(a.reading)])].filter((n) => n.length > 0);
    if (needles.some((n) => hay.some((h) => h.includes(n)))) add("leak", `"${it.answer}" lộ trong "${it.prompt}"`);
  }
  return issues;
}

/**
 * Dùng ở cuối hàm sinh câu hỏi: câu thiếu nhiễu (chỉ vi phạm pool-too-small) bị bỏ và ghi lý do;
 * mọi lỗi khác là lỗi sinh dữ liệu → throw (như pipeline: sai thì fail, không lặng lẽ bỏ qua).
 */
export function finalizeDeck(items: readonly QuizItem[]): { items: QuizItem[]; dropped: DeckIssue[] } {
  const issues = checkDeck(items);
  const fatal = issues.filter((x) => x.rule !== "pool-too-small");
  if (fatal.length > 0) {
    const head = fatal.slice(0, 5).map((x) => `${x.id} [${x.rule}] ${x.detail}`).join("\n");
    throw new Error(`Deck lỗi ${fatal.length} mục:\n${head}`);
  }
  const drop = new Set(issues.map((x) => x.id));
  return { items: items.filter((x) => !drop.has(x.id)), dropped: issues };
}
