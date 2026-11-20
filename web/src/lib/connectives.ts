// Từ nối (STATUS mục 8, plan/quiz/q11-conjunctions.md) — hàm thuần cho trang /tu-noi/ (và quiz Q11 sau này).
import type { Connective, ConnectiveFunctionDef } from "../content.config";

export const TYPE_LABEL: Record<Connective["type"], string> = { sentence: "Nối câu", clause: "Nối mệnh đề" };
export const TYPE_HINT: Record<Connective["type"], string> = {
  sentence: "Đứng đầu câu sau, nối hai câu: ～。そして、～。",
  clause: "Gắn sau động từ / tính từ / danh từ, nối hai vế trong một câu: ～のに、～。",
};

/** Neo của từ nối trên trang /tu-noi/ (quiz trỏ về đây). */
export function connectiveHref(id: string): string {
  return `tu-noi/#${id}`;
}

/** "Minna bài 28" · "N3 bài 14" · "Ngoài giáo trình". */
export function sourceLabel(c: Pick<Connective, "book" | "lesson">): string {
  if (c.book === null || c.lesson === null) return "Ngoài giáo trình";
  return c.book === "n3" ? `N3 bài ${c.lesson}` : `Minna bài ${c.lesson}`;
}

/** Bài của mục ngữ pháp g-LL-N → "Ngữ pháp bài LL". */
export function grammarLabel(ref: string): string {
  const m = /^g-(\d{2})-(\d+)$/.exec(ref);
  return m ? `Ngữ pháp bài ${Number(m[1])}` : ref;
}

/** Link thẻ từ vựng: Minna mn-LL-NNN → vocabulary/LL/#id; N3 cần bài (tra từ dữ liệu) → vocabulary/n3/L/#id. */
export function vocabHref(id: string, n3Lesson: ReadonlyMap<string, number>): string | null {
  if (id.startsWith("mn-")) return `vocabulary/${Number(id.slice(3, 5))}/#${id}`;
  const l = n3Lesson.get(id);
  return l === undefined ? null : `vocabulary/n3/${l}/#${id}`;
}

/** Nhóm theo chức năng (thứ tự của `functions`), trong nhóm: nối câu trước, rồi theo cấp N5 → N3, rồi thứ tự file. */
export function groupByFunction<T extends Pick<Connective, "function" | "type" | "level">>(
  functions: readonly ConnectiveFunctionDef[],
  items: readonly T[],
): { fn: ConnectiveFunctionDef; items: T[] }[] {
  const lv = { n5: 0, n4: 1, n3: 2 } as const;
  const rank = (c: T): number => (c.type === "sentence" ? 0 : 10) + lv[c.level];
  return functions
    .map((fn) => ({
      fn,
      items: items
        .map((c, i) => ({ c, i }))
        .filter(({ c }) => c.function === fn.id)
        .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)
        .map(({ c }) => c),
    }))
    .filter((g) => g.items.length > 0);
}
