// Câu hỏi đếm số cho trang tổng /luyen-tap/ (Q8-4): trang /dem-so/quiz/ nhúng thẳng câu hỏi vào HTML,
// trang tổng cần file tải lười như các phần khác. Cùng hàm sinh (lib/counter-quiz.ts) → cùng câu, cùng ID.
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { buildQuizItems, toQuizItems } from "../../lib/counter-quiz";
import type { Deck } from "../../lib/quiz/types";

export const GET: APIRoute = async () => {
  const counters = (await getCollection("counterItems")).map((c) => c.data).sort((a, b) => a.order - b.order);
  const items = toQuizItems(buildQuizItems(counters)).map((it) => ({ ...it, question: "Đọc thế nào?" }));
  const deck: Deck = { version: 1, name: "dem-so", items };
  return new Response(JSON.stringify(deck), { headers: { "Content-Type": "application/json; charset=utf-8" } });
};
