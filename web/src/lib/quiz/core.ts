// Lõi quiz dùng chung: tạo lựa chọn, chấm, lọc, hàng đợi câu hỏi. Hàm thuần, không đụng DOM.
import { type Rng, sample, shuffle } from "./random";
import type { Filter, Options, QuizItem, TagRule, TagValue } from "./types";

/** Số đáp án nhiễu "gần đúng nhất" đầu pool được bốc ngẫu nhiên (đã chốt: 3 trong 6). */
export const NEAR = 6;
export const OPTION_COUNT = 4;

/**
 * 4 lựa chọn: đáp án đúng + (count − 1) nhiễu bốc ngẫu nhiên trong `near` mục đầu pool, trộn vị trí.
 * Không lấy cố định 3 mục đầu để người học không nhớ "mặt" đáp án.
 */
export function makeOptions(item: Pick<QuizItem, "answer" | "pool">, rng: Rng, count = OPTION_COUNT, near = NEAR): Options {
  const wrong = sample(item.pool.slice(0, Math.max(near, count - 1)), count - 1, rng);
  const options = shuffle([item.answer, ...wrong], rng);
  return { options, correct: options.indexOf(item.answer) };
}

/**
 * Chuẩn hóa để so đáp án: NFKC (chữ/kana nửa độ rộng → chuẩn), bỏ mọi khoảng trắng,
 * katakana → hiragana (テレビ = てれび; đã chốt), chữ Latin thường.
 */
export function normalize(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/\s+/gu, "")
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .toLowerCase();
}

/** Đúng nếu khớp answer hoặc một mục accepted (sau chuẩn hóa). */
export function isCorrect(item: Pick<QuizItem, "answer" | "accepted">, choice: string): boolean {
  const c = normalize(choice);
  return [item.answer, ...item.accepted].some((a) => normalize(a) === c);
}

function tagOf(item: QuizItem, tag: string): TagValue | TagValue[] | undefined {
  return tag === "kind" ? item.kind : item.tags[tag];
}

function ruleMatches(value: TagValue | TagValue[] | undefined, rule: TagRule): boolean {
  if (value === undefined) return false;
  // tag nhiều giá trị (vd từ có ở bài 5 và 30): khớp nếu một giá trị khớp
  if (Array.isArray(value)) return value.some((v) => ruleMatches(v, rule));
  if (Array.isArray(rule)) return rule.includes(value);
  const { min, max } = rule as { min?: number; max?: number };
  if (typeof value !== "number") return false;
  return (min === undefined || value >= min) && (max === undefined || value <= max);
}

/** Câu khớp mọi luật trong filter (thiếu tag mà có luật → không khớp; tag mảng → khớp nếu một giá trị khớp). */
export function matches(item: QuizItem, filter: Filter): boolean {
  return Object.entries(filter).every(([tag, rule]) => ruleMatches(tagOf(item, tag), rule));
}

export function filterItems(items: readonly QuizItem[], filter: Filter): QuizItem[] {
  return items.filter((it) => matches(it, filter));
}

export interface Queue<T> {
  /** Câu tiếp theo; null khi đã đủ `limit` hoặc deck rỗng. */
  next(): T | null;
  /** Số câu đã bốc. */
  readonly asked: number;
  readonly limit: number | null;
}

/**
 * Hàng đợi câu hỏi: bốc không lặp đến hết deck, hết thì trộn lại vòng mới
 * (câu đầu vòng mới ≠ câu cuối vòng cũ). `limit` = số câu một lượt; null = không giới hạn.
 * "Làm lại câu sai" = createQueue(câu sai, …).
 *
 * `groupOf` (trộn đều): bốc lần lượt từng nhóm (vd loại câu), thứ tự nhóm trộn lại mỗi lượt quay —
 * 20 câu / 5 nhóm → mỗi nhóm 4 câu, không phụ thuộc nhóm nào nhiều câu hơn. Nhóm hết câu trong vòng
 * thì tạm nghỉ đến khi mọi nhóm hết (vòng mới), nên không lặp câu trong nhóm nhỏ.
 */
export function createQueue<T extends { id: string }>(
  items: readonly T[],
  rng: Rng,
  limit: number | null = null,
  groupOf?: (item: T) => string,
): Queue<T> {
  const groups = new Map<string, T[]>();
  for (const it of items) {
    const k = groupOf ? groupOf(it) : "";
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(it);
  }
  const bags = new Map<string, T[]>();
  let turn: string[] = [];
  let last: T | null = null;
  let asked = 0;

  /** Trộn lại túi của một nhóm; tránh câu sắp bốc (cuối túi) trùng câu vừa hỏi. */
  const refill = (k: string): void => {
    const bag = shuffle(groups.get(k)!, rng);
    if (bag.length > 1 && last !== null && bag[bag.length - 1]!.id === last.id) {
      [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1]!, bag[0]!];
    }
    bags.set(k, bag);
  };
  const withItems = (): string[] => [...groups.keys()].filter((k) => (bags.get(k)?.length ?? 0) > 0);

  return {
    next() {
      if (items.length === 0 || (limit !== null && asked >= limit)) return null;
      turn = turn.filter((k) => (bags.get(k)?.length ?? 0) > 0);
      if (turn.length === 0) {
        if (withItems().length === 0) for (const k of groups.keys()) refill(k); // vòng mới
        turn = shuffle(withItems(), rng);
        // nhóm sắp bốc (cuối turn) sẽ ra đúng câu vừa hỏi (nhóm 1 câu qua vòng) → đổi với nhóm khác
        const top = (k: string): string | undefined => bags.get(k)!.at(-1)?.id;
        if (turn.length > 1 && last !== null && top(turn[turn.length - 1]!) === last.id) {
          [turn[0], turn[turn.length - 1]] = [turn[turn.length - 1]!, turn[0]!];
        }
      }
      const k = turn.pop()!;
      last = bags.get(k)!.pop()!;
      asked++;
      return last;
    },
    get asked() {
      return asked;
    },
    limit,
  };
}
