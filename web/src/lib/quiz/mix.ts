// Trang tổng /luyen-tap/ (Q8, plan/quiz/q08-luyen-tap.md): trộn câu của nhiều phần theo khoảng bài Minna 1–50.
// Không sinh deck mới: dùng lại đúng file của trang từng phần (nhớ đệm chung, Q8-4), gộp + lọc bài ở đây (hàm thuần).
import { CONJ_GROUPS, CONJ_GROUP_SLUG, CONJ_KINDS, CONJ_KIND_LABEL, type ConjTable, conjItems } from "./conjugation";
import { matches } from "./core";
import { KANJI_KINDS, KANJI_KIND_LABEL } from "./kanji";
import type { Deck, QuizItem } from "./types";
import { LEVEL_LESSONS, VOCAB_KINDS, VOCAB_KIND_LABEL } from "./vocab";

export type MixPart = "tu-vung" | "kanji" | "chia-the" | "dem-so";
export const MIX_PARTS: readonly MixPart[] = ["tu-vung", "kanji", "chia-the", "dem-so"];
export const MIX_PART_LABEL: Record<MixPart, string> = { "tu-vung": "Từ vựng", kanji: "Kanji", "chia-the": "Chia thể", "dem-so": "Đếm số" };

/** Loại câu cố định mỗi phần (Q8-2); muốn loại khác → trang từng phần. */
const VOCAB_SLUGS = ["doc", "nghia", "dien"] as const;
const KANJI_SLUGS = ["hv", "nghia", "doc"] as const;
const CONJ_SLUGS = ["chia", "the"] as const;

/** Minna 1–50 = cấp N5 (1–25) + N4 (26–50) ở cả từ vựng và Kanji xếp theo bài từ vựng. */
export const MIX_LESSONS = { from: 1, to: 50 } as const;
const MINNA_LEVELS = ["n5", "n4"] as const;

export interface MixOptions {
  from: number;
  to: number;
  parts: readonly MixPart[];
}

/** Một file cần tải: phần + đường dẫn tương đối BASE_URL. Thứ tự = thứ tự dữ liệu truyền cho mixItems. */
export interface MixFile {
  part: MixPart;
  path: string;
  /** Chia thể: nhóm từ của bảng chia. */
  group?: (typeof CONJ_GROUPS)[number];
}

const levelsOf = (o: MixOptions): (typeof MINNA_LEVELS)[number][] =>
  MINNA_LEVELS.filter((l) => o.from <= LEVEL_LESSONS[l].to && o.to >= LEVEL_LESSONS[l].from);

/** File cần tải cho bộ lọc — chỉ cấp có bài trong khoảng (bài 1–25 → chỉ file N5). */
export function mixFiles(o: MixOptions): MixFile[] {
  const out: MixFile[] = [];
  const levels = levelsOf(o);
  for (const part of MIX_PARTS) {
    if (!o.parts.includes(part)) continue;
    if (part === "tu-vung") for (const l of levels) for (const s of VOCAB_SLUGS) out.push({ part, path: `vocabulary/quiz/${l}-${s}.json` });
    if (part === "kanji") for (const l of levels) for (const s of KANJI_SLUGS) out.push({ part, path: `kanji/quiz/tv-${l}-${s}.json` });
    if (part === "chia-the") for (const g of CONJ_GROUPS) out.push({ part, group: g, path: `chia-the/quiz/${CONJ_GROUP_SLUG[g]}.json` });
    if (part === "dem-so") out.push({ part, path: "luyen-tap/dem-so.json" });
  }
  return out;
}

/**
 * Gộp câu từ dữ liệu đã tải (cùng thứ tự với mixFiles): từ vựng, Kanji lọc bài trong khoảng; chia thể lấy từ của
 * các bài trong khoảng, thể đã học tới bài "đến"; đếm số không theo bài → nhóm "Cần nhớ" (Q8-1).
 */
export function mixItems(o: MixOptions, files: readonly MixFile[], data: readonly unknown[]): QuizItem[] {
  const lesson = { lesson: { min: o.from, max: o.to } };
  return files.flatMap((f, i) => {
    const d = data[i];
    if (f.part === "chia-the") {
      // info đã có loại từ ("Động từ - copy\nBài 14", conjItems) — trộn động từ + tính từ vẫn biết đang chia loại nào
      return conjItems(d as ConjTable, { book: "minna", from: o.from, upTo: o.to, kinds: CONJ_SLUGS });
    }
    const items = (d as Deck).items;
    if (f.part === "dem-so") return items.filter((it) => it.tags.changed === 1);
    return items.filter((it) => matches(it, lesson));
  });
}

/** Nhãn góc thẻ: "Từ vựng · Đọc", "Kanji · Hán-Việt"… */
export const MIX_KIND_LABELS: Record<string, string> = {
  ...Object.fromEntries(VOCAB_SLUGS.map((s) => [VOCAB_KINDS[s], `Từ vựng · ${VOCAB_KIND_LABEL[s]}`])),
  ...Object.fromEntries(KANJI_SLUGS.map((s) => [KANJI_KINDS[s], `Kanji · ${KANJI_KIND_LABEL[s]}`])),
  ...Object.fromEntries(CONJ_SLUGS.map((s) => [CONJ_KINDS[s], `Chia thể · ${CONJ_KIND_LABEL[s]}`])),
  "n-ctr": "Đếm số",
};
