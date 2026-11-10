// Tiện ích hiển thị Kanji (TypeScript thuần, không phụ thuộc Astro).
import type { KanjiEntry } from "./schemas";

/** Âm Kun dạng KANJIDIC 'まか.せる' → 'まか(せる)' (phần trong ngoặc là okurigana); '-り' giữ nguyên. */
export function kunDisplay(kun: string): string {
  const [stem, okuri] = kun.split(".");
  return okuri ? `${stem}(${okuri})` : (stem ?? kun);
}

export interface KanjiLessonGroup {
  lesson: number;
  label: string;
  items: KanjiEntry[];
}
export interface KanjiGroup {
  id: string; // neo trên trang danh sách
  title: string;
  subtitle: string;
  lessons: KanjiLessonGroup[];
}

function byLesson(
  items: KanjiEntry[],
  key: (k: KanjiEntry) => number | null,
  order?: (k: KanjiEntry) => number | null,
): KanjiLessonGroup[] {
  const m = new Map<number, KanjiEntry[]>();
  for (const k of items) {
    const n = key(k);
    if (n !== null) m.set(n, [...(m.get(n) ?? []), k]);
  }
  const rank = (k: KanjiEntry): number => order?.(k) ?? 0;
  return [...m.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([lesson, items]) => ({ lesson, label: `Bài ${lesson}`, items: [...items].sort((x, y) => rank(x) - rank(y)) }));
}

const count = (g: KanjiGroup): number => g.lessons.reduce((n, l) => n + l.items.length, 0);
const nonEmpty = (gs: KanjiGroup[]): KanjiGroup[] => gs.filter((g) => count(g) > 0);

/** Cách xem 1 — theo GIÁO TRÌNH KANJI của từng cấp (thứ tự bài như sách). Một chữ có thể ở nhiều cấp. */
export function groupByCurriculum(all: KanjiEntry[]): KanjiGroup[] {
  return nonEmpty([
    { id: "gt-n5", title: "N5", subtitle: "Ebook Kanji N5", lessons: byLesson(all, (k) => k.n5_lesson, (k) => k.n5_order) },
    { id: "gt-n4", title: "N4", subtitle: "Ebook Kanji N4", lessons: byLesson(all, (k) => k.n4_lesson, (k) => k.n4_order) },
    { id: "gt-n3", title: "N3", subtitle: "Sách Kanji N3", lessons: byLesson(all, (k) => k.n3_lesson) },
  ]);
}

/** Cách xem 2 — theo BÀI TỪ VỰNG có chữ lần đầu: Minna 1–25 (N5), 26–50 (N4), từ vựng N3 theo bài.
 *  n3VocabLesson: {字: bài từ vựng N3 đầu tiên có chữ} (trang tính từ vocab_refs). */
export function groupByVocab(all: KanjiEntry[], n3VocabLesson: Map<string, number>): KanjiGroup[] {
  const minna = all.filter((k) => k.first_lesson !== null);
  return nonEmpty([
    {
      id: "tv-n5",
      title: "N5",
      subtitle: "Từ vựng Minna bài 1–25",
      lessons: byLesson(minna.filter((k) => (k.first_lesson ?? 0) <= 25), (k) => k.first_lesson),
    },
    {
      id: "tv-n4",
      title: "N4",
      subtitle: "Từ vựng Minna bài 26–50",
      lessons: byLesson(minna.filter((k) => (k.first_lesson ?? 0) > 25), (k) => k.first_lesson),
    },
    {
      id: "tv-n3",
      title: "N3",
      subtitle: "Từ vựng N3 (chữ chưa gặp ở Minna)",
      lessons: byLesson(all.filter((k) => k.first_lesson === null), (k) => n3VocabLesson.get(k.char) ?? null),
    },
  ]);
}

export function groupSize(g: KanjiGroup): number {
  return count(g);
}
