// Bộ thủ → chữ Hán theo giáo trình Kanji (Ebook N5/N4, sách Kanji N3).
// Liên kết bộ ↔ chữ đã tính sẵn trong pipeline (`radical` = bộ chính KANJIDIC2, `radical_parts` = mọi bộ
// có trong cây KanjiVG); ở đây chỉ chia nhóm để hiển thị.
import type { KanjiEntry } from "./schemas";

export type CurriculumLevel = "n5" | "n4" | "n3";
export const CURRICULUM_LEVELS: CurriculumLevel[] = ["n5", "n4", "n3"];

/** Cấp thấp nhất mà giáo trình Kanji dạy chữ này; null = chỉ có trong từ vựng. */
export function curriculumLevel(k: KanjiEntry): CurriculumLevel | null {
  if (k.n5_lesson !== null) return "n5";
  if (k.n4_lesson !== null) return "n4";
  if (k.n3_lesson !== null) return "n3";
  return null;
}

/** Khóa sắp xếp theo thứ tự dạy trong cấp: [bài, thứ tự trong bài]. */
function lessonKey(k: KanjiEntry, level: CurriculumLevel): [number, number] {
  if (level === "n5") return [k.n5_lesson ?? 99, k.n5_order ?? 99];
  if (level === "n4") return [k.n4_lesson ?? 99, k.n4_order ?? 99];
  return [k.n3_lesson ?? 99, k.n3_lessons[0]?.order ?? 99];
}

export interface LevelGroup {
  level: CurriculumLevel;
  items: KanjiEntry[];
}

export interface RadicalKanji {
  /** Chữ giáo trình có bộ này là bộ chính, theo cấp. */
  primary: LevelGroup[];
  /** Chữ giáo trình có chứa bộ này (không phải bộ chính), theo cấp. */
  parts: LevelGroup[];
  /** Chữ chỉ có trong từ vựng, bộ chính là bộ này. */
  other: KanjiEntry[];
  /** Số chữ giáo trình (primary + parts). */
  total: number;
}

function byLevel(items: KanjiEntry[]): LevelGroup[] {
  return CURRICULUM_LEVELS.map((level) => ({
    level,
    items: items
      .filter((k) => curriculumLevel(k) === level)
      .sort((a, b) => {
        const [la, oa] = lessonKey(a, level);
        const [lb, ob] = lessonKey(b, level);
        return la - lb || oa - ob || a.char.localeCompare(b.char);
      }),
  })).filter((g) => g.items.length > 0);
}

export function radicalKanji(number: number, kanji: KanjiEntry[]): RadicalKanji {
  const inCurr = kanji.filter((k) => curriculumLevel(k) !== null);
  const primary = inCurr.filter((k) => k.radical === number);
  const parts = inCurr.filter((k) => k.radical !== number && k.radical_parts.includes(number));
  const other = kanji.filter((k) => curriculumLevel(k) === null && k.radical === number);
  return { primary: byLevel(primary), parts: byLevel(parts), other, total: primary.length + parts.length };
}

export const LEVEL_LABEL: Record<CurriculumLevel, string> = { n5: "N5", n4: "N4", n3: "N3" };

/** Bộ có trang /kanji/bo-thu/<số>/ khi có chữ giáo trình hoặc chữ chỉ có trong từ vựng. */
export function hasRadicalPage(d: RadicalKanji): boolean {
  return d.total > 0 || d.other.length > 0;
}

export interface RadicalNeighbors {
  prev: number | null;
  next: number | null;
}

/** Bộ trước / sau theo số bộ, chỉ trong các bộ có trang (`pageNumbers`, thứ tự bất kỳ). */
export function radicalNeighbors(number: number, pageNumbers: readonly number[]): RadicalNeighbors {
  const sorted = [...pageNumbers].sort((a, b) => a - b);
  const i = sorted.indexOf(number);
  if (i < 0) return { prev: null, next: null };
  return { prev: sorted[i - 1] ?? null, next: sorted[i + 1] ?? null };
}

/** Link quiz bộ thủ cho một nhóm số nét — phạm vi cả 214 bộ (mặc định của trang quiz chỉ là Kanji N5). */
export function radicalQuizHref(strokes: number): string {
  return `kanji/bo-thu/quiz/?pham-vi=tat-ca&net-tu=${strokes}&net-den=${strokes}`;
}
