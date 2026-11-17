// File câu hỏi quiz Kanji theo cách xếp × cấp × loại × nhóm bài (Q5, chia chunk Q12):
// /kanji/quiz/<gt|tv>-<n5|n4|n3>-<hv|nghia|chu|doc|bo>-<bài đầu>.json (lib/quiz/chunks.ts: N3 3 bài, còn lại 5 bài/file).
// Sinh lúc build (lib/quiz/kanji.ts); trang /kanji/quiz/ tải lười chunk của khoảng bài đang chọn.
import type { APIRoute, GetStaticPaths } from "astro";
import { chunkFile, chunkStarts, splitByChunk } from "../../../lib/quiz/chunks";
import { KANJI_KINDS, KANJI_LEVELS, KANJI_VIEWS, type KanjiKindSlug, type KanjiLevel, type KanjiView, buildKanjiDeck, kanjiLessonRanges } from "../../../lib/quiz/kanji";
import type { Deck, QuizItem } from "../../../lib/quiz/types";
import { loadKanjiSource } from "./_source";

export const getStaticPaths = (async () => {
  const ranges = kanjiLessonRanges(await loadKanjiSource());
  return KANJI_VIEWS.flatMap((view) =>
    KANJI_LEVELS.flatMap((level) =>
      (Object.keys(KANJI_KINDS) as KanjiKindSlug[]).flatMap((slug) =>
        chunkStarts(level, ranges[view][level]).map((start) => ({
          params: { deck: chunkFile(`${view}-${level}-${slug}`, start).replace(/\.json$/, "") },
          props: { view, level, slug, start },
        })),
      ),
    ),
  );
}) satisfies GetStaticPaths;

// Dựng deck đầy đủ một lần cho mỗi cách xếp × cấp × loại rồi chia — các chunk cùng deck dùng chung.
const built = new Map<string, Promise<Map<number, QuizItem[]>>>();
async function chunksOf(view: KanjiView, level: KanjiLevel, slug: KanjiKindSlug): Promise<Map<number, QuizItem[]>> {
  const src = await loadKanjiSource();
  return splitByChunk(buildKanjiDeck(src, view, level, slug).items, level, kanjiLessonRanges(src)[view][level]);
}

export const GET: APIRoute = async ({ props }) => {
  const { view, level, slug, start } = props as { view: KanjiView; level: KanjiLevel; slug: KanjiKindSlug; start: number };
  const key = `${view}-${level}-${slug}`;
  let p = built.get(key);
  if (!p) built.set(key, (p = chunksOf(view, level, slug)));
  const deck: Deck = { version: 1, name: chunkFile(key, start).replace(/\.json$/, ""), items: (await p).get(start) ?? [] };
  return new Response(JSON.stringify(deck), { headers: { "Content-Type": "application/json; charset=utf-8" } });
};
