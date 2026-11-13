// Gõ kana (Q9, plan/quiz/q09-kana-input.md): loại câu gõ được + chấm câu gõ. Hàm thuần.
import { parseRuby } from "../ruby";
import { normalize } from "./core";
import { toKana } from "./romaji";
import type { QuizItem } from "./types";

/** Loại câu có đáp án là cách đọc tiếng Nhật → gõ được (user chốt 2026-11-13; Điền từ chưa — nhiều từ cũng hợp câu). */
export const TYPABLE_KINDS: readonly string[] = ["v-read", "k-read", "c-to", "n-ctr", "n-num"];


/** Phần đọc của đáp án: ruby {行|い}って → いって; chuỗi thường giữ nguyên. */
export function readingOf(s: string): string {
  return parseRuby(s)
    .map((x) => x.reading ?? x.text)
    .join("")
    .replace(/\[\[|\]\]/g, "");
}

/** Dạng so sánh: chuẩn hóa + bỏ ký hiệu không gõ (～じん, お先にどうぞ。, ・). */
export const typingForm = (s: string): string => normalize(s).replace(/[～〜~。、.,!?！？・…「」]/gu, "");

/** Chuỗi gõ (romaji / kana) → dạng so sánh; null nếu trống. */
export function typedKey(input: string): string | null {
  const k = typingForm(toKana(input, true));
  return k === "" ? null : k;
}

/** Đúng nếu khớp phần đọc của answer hoặc một mục accepted (katakana = hiragana, bỏ khoảng trắng). */
export function typedCorrect(item: Pick<QuizItem, "answer" | "accepted">, input: string): boolean {
  const k = typedKey(input);
  return k !== null && [item.answer, ...item.accepted].some((a) => typingForm(readingOf(a)) === k);
}

const TYPABLE_FORM = /^[\u3041-\u309fー0-9]+$/u; // số gõ được (110ばん, ２，３にち → 23にち)

/**
 * Câu gõ được: loại câu trong TYPABLE_KINDS và phần đọc của đáp án (+ accepted) chỉ gồm kana / chữ số sau khi bỏ ký hiệu.
 * Dữ liệu lỗi (vd mn-09-033 おっと/しゅじん) → vẫn trắc nghiệm trong chế độ gõ.
 */
export function isTypable(it: Pick<QuizItem, "kind" | "answer" | "accepted">): boolean {
  return TYPABLE_KINDS.includes(it.kind) && [it.answer, ...it.accepted].every((a) => TYPABLE_FORM.test(typingForm(readingOf(a))));
}
