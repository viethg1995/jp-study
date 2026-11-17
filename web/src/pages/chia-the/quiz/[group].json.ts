// Bảng chia gọn cho quiz chia thể (Q6-1): /chia-the/quiz/<dong-tu|tinh-tu-i|tinh-tu-na>-<minna|n3>.json — trang tải
// 1 file theo nhóm từ × sách rồi sinh câu hỏi trên trình duyệt (lib/quiz/conjugation.ts conjItems). Tách theo sách
// (Q12, lib/quiz/chunks.ts conjPath): câu chỉ dùng hàng của sách đang chọn (rowsOf) nên tách không đổi câu nào.
import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";
import { conjPath } from "../../../lib/quiz/chunks";
import { CONJ_GROUPS, CONJ_GROUP_SLUG, type ConjGroupId, buildConjTable } from "../../../lib/quiz/conjugation";

const BOOKS = ["minna", "n3"] as const;

export const getStaticPaths = (() =>
  CONJ_GROUPS.flatMap((g) =>
    BOOKS.map((book) => ({ params: { group: conjPath(CONJ_GROUP_SLUG[g], book).replace(/^chia-the\/quiz\/|\.json$/g, "") }, props: { group: g, book } })),
  )) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { group, book } = props as { group: ConjGroupId; book: (typeof BOOKS)[number] };
  const forms = (await getCollection("conjForms")).map((f) => f.data).sort((a, b) => a.order - b.order);
  const entries = (await getCollection("conjEntries")).map((e) => e.data).sort((a, b) => a.order - b.order);
  const table = buildConjTable(group, entries, forms);
  return new Response(JSON.stringify({ ...table, rows: table.rows.filter((r) => r.book === book) }), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};
