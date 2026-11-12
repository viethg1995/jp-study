// File câu hỏi quiz từ vựng theo cấp × loại câu (Q4-1): /vocabulary/quiz/<n5|n4|n3>-<doc|nghia|tu|hv|dien>.json
// Sinh lúc build từ data/vocabulary (lib/quiz/vocab.ts); trang /vocabulary/quiz/ tải lười theo bộ lọc.
import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";
import type { Deck } from "../../../lib/quiz/types";
import { VOCAB_KINDS, VOCAB_LEVELS, type VocabKindSlug, type VocabLevel, buildVocabDeck } from "../../../lib/quiz/vocab";

export const getStaticPaths = (() =>
  VOCAB_LEVELS.flatMap((level) =>
    (Object.keys(VOCAB_KINDS) as VocabKindSlug[]).map((slug) => ({ params: { deck: `${level}-${slug}` }, props: { level, slug } })),
  )) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { level, slug } = props as { level: VocabLevel; slug: VocabKindSlug };
  const all = [...(await getCollection("vocabulary")), ...(await getCollection("vocabularyN3"))].flatMap((l) => l.data.entries);
  const { items } = buildVocabDeck(all, level, slug);
  const deck: Deck = { version: 1, name: `${level}-${slug}`, items };
  return new Response(JSON.stringify(deck), { headers: { "Content-Type": "application/json; charset=utf-8" } });
};
