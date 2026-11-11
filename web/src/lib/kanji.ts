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

/** Như byLesson nhưng một chữ có thể thuộc nhiều bài (Kanji N3: 個 ở bài 1 và 21) — mỗi bài kèm thứ tự. */
function byLessonRefs(
  items: KanjiEntry[],
  refs: (k: KanjiEntry) => { lesson: number; order: number }[],
): KanjiLessonGroup[] {
  const m = new Map<number, { k: KanjiEntry; order: number }[]>();
  for (const k of items) {
    for (const r of refs(k)) m.set(r.lesson, [...(m.get(r.lesson) ?? []), { k, order: r.order }]);
  }
  return [...m.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([lesson, xs]) => ({
      lesson,
      label: `Bài ${lesson}`,
      items: [...xs].sort((x, y) => x.order - y.order).map((x) => x.k),
    }));
}

const count = (g: KanjiGroup): number => g.lessons.reduce((n, l) => n + l.items.length, 0);
const nonEmpty = (gs: KanjiGroup[]): KanjiGroup[] => gs.filter((g) => count(g) > 0);

/** Cách xem 1 — theo GIÁO TRÌNH KANJI của từng cấp (thứ tự bài như sách). Một chữ có thể ở nhiều cấp. */
export function groupByCurriculum(all: KanjiEntry[]): KanjiGroup[] {
  return nonEmpty([
    { id: "gt-n5", title: "N5", subtitle: "Ebook Kanji N5", lessons: byLesson(all, (k) => k.n5_lesson, (k) => k.n5_order) },
    { id: "gt-n4", title: "N4", subtitle: "Ebook Kanji N4", lessons: byLesson(all, (k) => k.n4_lesson, (k) => k.n4_order) },
    { id: "gt-n3", title: "N3", subtitle: "Sách Kanji N3", lessons: byLessonRefs(all, (k) => k.n3_lessons) },
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

/** {字: bài từ vựng N3 đầu tiên có chữ} — tính từ vocab_refs của Kanji và danh sách bài từ vựng N3. */
export function n3VocabLessonMap(
  all: KanjiEntry[],
  n3Lessons: { lesson: number; entries: { id: string }[] }[],
): Map<string, number> {
  const lessonOf = new Map<string, number>();
  for (const l of n3Lessons) for (const e of l.entries) lessonOf.set(e.id, l.lesson);
  const out = new Map<string, number>();
  for (const k of all) {
    const ls = k.vocab_refs.map((id) => lessonOf.get(id)).filter((x): x is number => x !== undefined);
    if (ls.length) out.set(k.char, Math.min(...ls));
  }
  return out;
}

/** Nhóm của một cấp cho trang /kanji/<cấp>/: theo giáo trình Kanji và theo bài từ vựng (null nếu trống). */
export function levelGroups(
  all: KanjiEntry[],
  n3VocabLesson: Map<string, number>,
  level: "n5" | "n4" | "n3",
): { book: KanjiGroup | null; vocab: KanjiGroup | null } {
  return {
    book: groupByCurriculum(all).find((g) => g.id === `gt-${level}`) ?? null,
    vocab: groupByVocab(all, n3VocabLesson).find((g) => g.id === `tv-${level}`) ?? null,
  };
}

/** Điều hướng trước/sau trên trang chi tiết, theo đúng danh sách người học đang xem.
 *  key = `<id nhóm>.<bài>` (vd "gt-n5.1", "tv-n4.27") — truyền qua `?ds=` từ trang danh sách. */
export interface KanjiNavLink {
  char: string;
  key: string;
}
export interface KanjiNav {
  key: string;
  label: string; // vd "Kanji N5 · Bài 1", "Từ vựng N5 · Bài 11"
  listHref: string; // tương đối với BASE_URL, vd "kanji/n5/#gt-n5-1"
  prev: KanjiNavLink | null;
  next: KanjiNavLink | null;
}

/** {字: các ngữ cảnh danh sách chứa chữ} — thứ tự: giáo trình N5 → N4 → N3 rồi bài từ vựng; phần tử đầu là mặc định. */
export function kanjiNavs(all: KanjiEntry[], n3VocabLesson: Map<string, number>): Map<string, KanjiNav[]> {
  const out = new Map<string, KanjiNav[]>();
  const groups = [...groupByCurriculum(all), ...groupByVocab(all, n3VocabLesson)];
  for (const g of groups) {
    const book = g.id.startsWith("gt-");
    const level = g.id.slice(3);
    const seq = g.lessons.flatMap((l) => l.items.map((k) => ({ char: k.char, lesson: l.lesson })));
    const link = (p: { char: string; lesson: number } | undefined): KanjiNavLink | null =>
      p ? { char: p.char, key: `${g.id}.${p.lesson}` } : null;
    seq.forEach((p, i) => {
      const nav: KanjiNav = {
        key: `${g.id}.${p.lesson}`,
        label: `${book ? "Kanji" : "Từ vựng"} ${g.title} · Bài ${p.lesson}`,
        listHref: `kanji/${level}/#${g.id}-${p.lesson}`,
        prev: link(seq[i - 1]),
        next: link(seq[i + 1]),
      };
      out.set(p.char, [...(out.get(p.char) ?? []), nav]);
    });
  }
  return out;
}
