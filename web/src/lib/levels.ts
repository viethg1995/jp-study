// Cấp độ JLPT dùng để tách trang danh sách Từ vựng / Kanji: mỗi cấp một trang riêng (/vocabulary/n5/, /kanji/n5/…).
export const LEVELS = ["n5", "n4", "n3"] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_LABEL: Record<Level, string> = { n5: "N5", n4: "N4", n3: "N3" };

/** Tab N5 · N4 · N3 cho LevelTabs. route: vd "vocabulary" → `${base}/vocabulary/n5/`. */
export function levelTabs(
  base: string,
  route: string,
  current: Level | null,
): { label: string; href: string; active: boolean }[] {
  return LEVELS.map((l) => ({ label: LEVEL_LABEL[l], href: `${base}/${route}/${l}/`, active: l === current }));
}
