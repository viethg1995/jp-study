// File câu hỏi quiz từ vựng theo cấp × loại câu × nhóm bài (Q4-1, chia chunk Q12):
// /vocabulary/quiz/<n5|n4|n3>-<doc|nghia|tu|hv|dien>-<bài đầu>.json (lib/quiz/chunks.ts: Minna 5 bài, N3 3 bài/file).
// Sinh lúc build từ data/vocabulary (lib/quiz/vocab.ts); trang /vocabulary/quiz/ tải lười chunk của khoảng bài đang chọn.
// "Điền từ" đọc thêm bảng chia (data/conjugation) để hỏi cả câu có từ đích đã chia (Q4b) — chỉ lúc build.
import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";
import { chunkFile, chunkStarts, splitByChunk } from "../../../lib/quiz/chunks";
import { CONJ_GROUPS, buildConjTable } from "../../../lib/quiz/conjugation";
import type { Deck, QuizItem } from "../../../lib/quiz/types";
import { LEVEL_LESSONS, VOCAB_KINDS, VOCAB_LEVELS, type VocabKindSlug, type VocabLevel, buildVocabDeck } from "../../../lib/quiz/vocab";

export const getStaticPaths = (() =>
  VOCAB_LEVELS.flatMap((level) =>
    (Object.keys(VOCAB_KINDS) as VocabKindSlug[]).flatMap((slug) =>
      chunkStarts(level, LEVEL_LESSONS[level]).map((start) => ({
        params: { deck: chunkFile(`${level}-${slug}`, start).replace(/\.json$/, "") },
        props: { level, slug, start },
      })),
    ),
  )) satisfies GetStaticPaths;

// Dựng deck đầy đủ một lần cho mỗi cấp × loại rồi chia — các chunk cùng deck dùng chung (cùng tiến trình build).
const built = new Map<string, Promise<Map<number, QuizItem[]>>>();
async function chunksOf(level: VocabLevel, slug: VocabKindSlug): Promise<Map<number, QuizItem[]>> {
  const all = [...(await getCollection("vocabulary")), ...(await getCollection("vocabularyN3"))].flatMap((l) => l.data.entries);
  let conj: ReturnType<typeof buildConjTable>[] = [];
  if (slug === "dien") {
    const forms = (await getCollection("conjForms")).map((f) => f.data).sort((a, b) => a.order - b.order);
    const entries = (await getCollection("conjEntries")).map((e) => e.data).sort((a, b) => a.order - b.order);
    conj = CONJ_GROUPS.map((g) => buildConjTable(g, entries, forms));
  }
  return splitByChunk(buildVocabDeck(all, level, slug, conj).items, level, LEVEL_LESSONS[level]);
}

export const GET: APIRoute = async ({ props }) => {
  const { level, slug, start } = props as { level: VocabLevel; slug: VocabKindSlug; start: number };
  const key = `${level}-${slug}`;
  let p = built.get(key);
  if (!p) built.set(key, (p = chunksOf(level, slug)));
  const deck: Deck = { version: 1, name: chunkFile(key, start).replace(/\.json$/, ""), items: (await p).get(start) ?? [] };
  return new Response(JSON.stringify(deck), { headers: { "Content-Type": "application/json; charset=utf-8" } });
};
