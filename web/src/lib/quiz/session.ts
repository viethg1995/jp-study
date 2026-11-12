// Trạng thái một lượt quiz — hàm thuần (không DOM) để test được; lib/quiz/runner.ts chỉ vẽ theo trạng thái này.
import { createQueue, makeOptions } from "./core";
import type { Rng } from "./random";
import type { QuizItem } from "./types";

export interface Question {
  item: QuizItem;
  options: string[];
  correct: number;
}

export interface AnswerResult {
  item: QuizItem;
  choice: string;
  ok: boolean;
}

export interface Session {
  /** Câu đang hỏi; null khi deck rỗng hoặc lượt đã xong. */
  readonly current: Question | null;
  /** Câu hiện tại đã trả lời chưa. */
  readonly answered: boolean;
  readonly right: number;
  readonly total: number;
  /** Số câu một lượt (null = không giới hạn). */
  readonly limit: number | null;
  /** Lượt đã kết thúc (hết số câu hoặc người học bấm Kết thúc). */
  readonly done: boolean;
  /** Trả lời câu hiện tại bằng vị trí lựa chọn; null nếu không hợp lệ (đã trả lời, vị trí sai, không có câu). */
  answer(index: number): AnswerResult | null;
  /** Sang câu tiếp; trả về câu mới hoặc null nếu lượt xong. */
  next(): Question | null;
  /** Kết thúc lượt sớm (chế độ không giới hạn). */
  finish(): void;
  /** Câu trả lời sai trong lượt, mỗi câu một lần, theo thứ tự gặp. */
  wrong(): QuizItem[];
}

/**
 * Lượt mới: hỏi ngay câu đầu. limit = null → không giới hạn (hỏi vòng lại đến khi finish()).
 * groupOf: trộn đều theo nhóm (vd q => q.kind — mỗi loại câu số câu ngang nhau), xem createQueue.
 * "Làm lại câu sai" = createSession(session.wrong(), rng, wrong.length).
 */
export function createSession(
  items: readonly QuizItem[],
  rng: Rng,
  limit: number | null,
  groupOf?: (item: QuizItem) => string,
): Session {
  const queue = createQueue(items, rng, limit, groupOf);
  let current: Question | null = null;
  let answered = false;
  let right = 0;
  let total = 0;
  let done = false;
  const wrongIds = new Map<string, QuizItem>();

  const ask = (): Question | null => {
    const item = done ? null : queue.next();
    answered = false;
    if (!item) {
      current = null;
      // deck rỗng: không phải "xong" mà là "không có câu" (runner hiện thông báo bộ lọc)
      done = items.length > 0;
      return null;
    }
    current = { item, ...makeOptions(item, rng) };
    return current;
  };

  const session: Session = {
    get current() {
      return current;
    },
    get answered() {
      return answered;
    },
    get right() {
      return right;
    },
    get total() {
      return total;
    },
    limit,
    get done() {
      return done;
    },
    answer(index) {
      if (!current || answered || index < 0 || index >= current.options.length) return null;
      answered = true;
      total++;
      const ok = index === current.correct;
      if (ok) right++;
      else if (!wrongIds.has(current.item.id)) wrongIds.set(current.item.id, current.item);
      return { item: current.item, choice: current.options[index]!, ok };
    },
    next() {
      return ask();
    },
    finish() {
      done = true;
      current = null;
      answered = false;
    },
    wrong() {
      return [...wrongIds.values()];
    },
  };
  ask();
  return session;
}
