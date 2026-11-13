// Câu hỏi đếm số cho trang tổng /luyen-tap/ (Q8-4): trang /dem-so/quiz/ nhúng thẳng câu hỏi vào HTML,
// trang tổng cần file tải lười như các phần khác. Cùng hàm sinh (lib/counter-quiz.ts, lib/quiz/numbers.ts) → cùng câu, cùng ID.
// Gồm 2 loại: n-ctr (số + trợ số từ) và n-num (Q7: số đếm).
import type { APIRoute } from "astro";
import { getCollection, getEntry } from "astro:content";
import { buildQuizItems, toQuizItems } from "../../lib/counter-quiz";
import { numberItems } from "../../lib/quiz/numbers";
import type { Deck } from "../../lib/quiz/types";

export const GET: APIRoute = async () => {
  const counters = (await getCollection("counterItems")).map((c) => c.data).sort((a, b) => a.order - b.order);
  const numbers = (await getEntry("numbers", "numbers"))?.data;
  if (!numbers) throw new Error("thiếu numbers trong data/counters.json");
  const items = [...toQuizItems(buildQuizItems(counters)).map((it) => ({ ...it, question: "Đọc thế nào?" })), ...numberItems(numbers)];
  const deck: Deck = { version: 1, name: "dem-so", items };
  return new Response(JSON.stringify(deck), { headers: { "Content-Type": "application/json; charset=utf-8" } });
};
