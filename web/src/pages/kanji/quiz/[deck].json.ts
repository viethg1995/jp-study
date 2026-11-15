// File câu hỏi quiz Kanji theo cách xếp × cấp × loại (Q5): /kanji/quiz/<gt|tv>-<n5|n4|n3>-<hv|nghia|chu|doc|bo>.json
// Sinh lúc build (lib/quiz/kanji.ts); trang /kanji/quiz/ tải lười theo bộ lọc.
import type { APIRoute, GetStaticPaths } from "astro";
import { KANJI_KINDS, KANJI_LEVELS, KANJI_VIEWS, type KanjiKindSlug, type KanjiLevel, type KanjiView, buildKanjiDeck } from "../../../lib/quiz/kanji";
import type { Deck } from "../../../lib/quiz/types";
import { loadKanjiSource } from "./_source";

export const getStaticPaths = (() =>
  KANJI_VIEWS.flatMap((view) =>
    KANJI_LEVELS.flatMap((level) =>
      (Object.keys(KANJI_KINDS) as KanjiKindSlug[]).map((slug) => ({ params: { deck: `${view}-${level}-${slug}` }, props: { view, level, slug } })),
    ),
  )) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { view, level, slug } = props as { view: KanjiView; level: KanjiLevel; slug: KanjiKindSlug };
  const { items } = buildKanjiDeck(await loadKanjiSource(), view, level, slug);
  const deck: Deck = { version: 1, name: `${view}-${level}-${slug}`, items };
  return new Response(JSON.stringify(deck), { headers: { "Content-Type": "application/json; charset=utf-8" } });
};
