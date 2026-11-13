// Trạng thái một lượt quiz — hàm thuần (không DOM) để test được; lib/quiz/runner.ts chỉ vẽ theo trạng thái này.
import { createQueue, makeOptions } from "./core";
import type { Rng } from "./random";
import type { QuizItem } from "./types";
import { toKana } from "./romaji";
import { typedCorrect, typedKey } from "./typing";

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
  /**
   * Trả lời bằng chữ gõ (Q9: romaji hoặc kana). `choice` = chữ đã chuyển kana. null nếu không hợp lệ hoặc ô trống
   * (không chấm — tránh Enter nhầm). `giveUp` = "Không biết": tính sai, không cần chữ.
   */
  answerTyped(input: string, giveUp?: boolean): AnswerResult | null;
  /** Sang câu tiếp; trả về câu mới hoặc null nếu lượt xong. */
  next(): Question | null;
  /** Kết thúc lượt sớm (chế độ không giới hạn). */
  finish(): void;
  /** Câu trả lời sai trong lượt, mỗi câu một lần, theo thứ tự gặp. */
  wrong(): QuizItem[];
}

/**
 * Lượt mới: hỏi ngay câu đầu. limit = null → không giới hạn (hỏi vòng lại đến khi finish()).
 * groupOf / subOf: trộn đều theo nhóm (vd q => q.kind — mỗi loại câu số câu ngang nhau) / nhóm con, xem createQueue.
 * "Làm lại câu sai" = createSession(session.wrong(), rng, wrong.length).
 */
export function createSession(
  items: readonly QuizItem[],
  rng: Rng,
  limit: number | null,
  groupOf?: (item: QuizItem) => string,
  subOf?: (item: QuizItem) => string,
): Session {
  const queue = createQueue(items, rng, limit, groupOf, subOf);
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

  const grade = (ok: boolean, choice: string): AnswerResult => {
    const item = current!.item;
    answered = true;
    total++;
    if (ok) right++;
    else if (!wrongIds.has(item.id)) wrongIds.set(item.id, item);
    return { item, choice, ok };
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
      return grade(index === current.correct, current.options[index]!);
    },
    answerTyped(input, giveUp = false) {
      if (!current || answered || (!giveUp && typedKey(input) === null)) return null;
      return grade(!giveUp && typedCorrect(current.item, input), giveUp ? "" : toKana(input, true));
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
