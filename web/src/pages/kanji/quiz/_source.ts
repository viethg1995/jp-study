// Nạp dữ liệu cho quiz Kanji + bộ thủ (file "_" không thành route). Chỉ pages/ gọi getCollection.
import { getCollection } from "astro:content";
import { type KanjiSource, kanjiSource } from "../../../lib/quiz/kanji";

let cached: Promise<KanjiSource> | null = null;

/** Một lần mỗi lượt build — 30 + 2 file Deck và 2 trang dùng chung. */
export function loadKanjiSource(): Promise<KanjiSource> {
  cached ??= (async () =>
    kanjiSource(
      (await getCollection("kanji")).map((k) => k.data),
      (await getCollection("radicals")).map((r) => r.data),
      (await getCollection("strokes")).map((s) => s.data),
      (await getCollection("vocabularyN3")).flatMap((l) => l.data.entries),
    ))();
  return cached;
}
