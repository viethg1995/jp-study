// File câu hỏi quiz bộ thủ (Q5): /kanji/bo-thu/quiz/<ten|chu>.json — 214 bộ, lọc phạm vi trên trình duyệt (tag `scope`).
import type { APIRoute, GetStaticPaths } from "astro";
import { RADICAL_KINDS, type RadicalKindSlug, buildRadicalDeck } from "../../../../lib/quiz/kanji";
import type { Deck } from "../../../../lib/quiz/types";
import { loadKanjiSource } from "../../quiz/_source";

export const getStaticPaths = (() =>
  (Object.keys(RADICAL_KINDS) as RadicalKindSlug[]).map((slug) => ({ params: { deck: slug }, props: { slug } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { slug } = props as { slug: RadicalKindSlug };
  const { items } = buildRadicalDeck(await loadKanjiSource(), slug);
  const deck: Deck = { version: 1, name: `radical-${slug}`, items };
  return new Response(JSON.stringify(deck), { headers: { "Content-Type": "application/json; charset=utf-8" } });
};
