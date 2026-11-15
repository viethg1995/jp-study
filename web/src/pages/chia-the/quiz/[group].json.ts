// Bảng chia gọn cho quiz chia thể (Q6-1): /chia-the/quiz/<dong-tu|tinh-tu-i|tinh-tu-na>.json — trang tải 1 file theo
// nhóm từ rồi sinh câu hỏi trên trình duyệt (lib/quiz/conjugation.ts conjItems).
import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";
import { CONJ_GROUPS, CONJ_GROUP_SLUG, type ConjGroupId, buildConjTable } from "../../../lib/quiz/conjugation";

export const getStaticPaths = (() => CONJ_GROUPS.map((g) => ({ params: { group: CONJ_GROUP_SLUG[g] }, props: { group: g } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { group } = props as { group: ConjGroupId };
  const forms = (await getCollection("conjForms")).map((f) => f.data).sort((a, b) => a.order - b.order);
  const entries = (await getCollection("conjEntries")).map((e) => e.data).sort((a, b) => a.order - b.order);
  return new Response(JSON.stringify(buildConjTable(group, entries, forms)), { headers: { "Content-Type": "application/json; charset=utf-8" } });
};
