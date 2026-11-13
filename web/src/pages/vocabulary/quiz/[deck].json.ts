// File câu hỏi quiz từ vựng theo cấp × loại câu (Q4-1): /vocabulary/quiz/<n5|n4|n3>-<doc|nghia|tu|hv|dien>.json
// Sinh lúc build từ data/vocabulary (lib/quiz/vocab.ts); trang /vocabulary/quiz/ tải lười theo bộ lọc.
// "Điền từ" đọc thêm bảng chia (data/conjugation) để hỏi cả câu có từ đích đã chia (Q4b) — chỉ lúc build.
import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";
import { CONJ_GROUPS, buildConjTable } from "../../../lib/quiz/conjugation";
import type { Deck } from "../../../lib/quiz/types";
import { VOCAB_KINDS, VOCAB_LEVELS, type VocabKindSlug, type VocabLevel, buildVocabDeck } from "../../../lib/quiz/vocab";

export const getStaticPaths = (() =>
  VOCAB_LEVELS.flatMap((level) =>
    (Object.keys(VOCAB_KINDS) as VocabKindSlug[]).map((slug) => ({ params: { deck: `${level}-${slug}` }, props: { level, slug } })),
  )) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { level, slug } = props as { level: VocabLevel; slug: VocabKindSlug };
  const all = [...(await getCollection("vocabulary")), ...(await getCollection("vocabularyN3"))].flatMap((l) => l.data.entries);
  let conj: ReturnType<typeof buildConjTable>[] = [];
  if (slug === "dien") {
    const forms = (await getCollection("conjForms")).map((f) => f.data).sort((a, b) => a.order - b.order);
    const entries = (await getCollection("conjEntries")).map((e) => e.data).sort((a, b) => a.order - b.order);
    conj = CONJ_GROUPS.map((g) => buildConjTable(g, entries, forms));
  }
  const { items } = buildVocabDeck(all, level, slug, conj);
  const deck: Deck = { version: 1, name: `${level}-${slug}`, items };
  return new Response(JSON.stringify(deck), { headers: { "Content-Type": "application/json; charset=utf-8" } });
};
