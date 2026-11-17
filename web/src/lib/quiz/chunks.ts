// Chia file deck theo nhóm bài (Q12, plan/quiz/q12-deck-chunking.md bước 3) — hàm thuần, endpoint lúc build và trang
// (từng phần + trang tổng) cùng dùng → đổi tên/cách chia chỉ sửa ở đây.
//   vocabulary/quiz/n5-dien-01.json = câu có bài 1–5; n4-dien-26 = 26–30; n3-dien-04 = N3 bài 4–6.
// Cửa sổ bài cố định theo số bài tuyệt đối (không theo vị trí trong cấp). Câu gắn nhiều bài nằm ở mọi chunk chứa một
// trong các bài đó (bộ lọc bài khớp nếu một bài khớp — core.ts matches) → khi gộp nhiều chunk phải bỏ trùng theo ID.
import type { QuizItem } from "./types";

/** Số bài mỗi chunk: N3 mỗi bài ~50 từ (gấp đôi Minna) → 3 bài; còn lại 5 bài. */
export function chunkSize(level: string): number {
  return level === "n3" ? 3 : 5;
}

/** Bài đầu của chunk chứa bài `lesson`. */
export function chunkStart(level: string, lesson: number): number {
  const n = chunkSize(level);
  return Math.floor((lesson - 1) / n) * n + 1;
}

/** Bài đầu của mọi chunk giao với [from, to] (mặc định cả khoảng `range` của cấp) — chỉ chunk nằm trong `range`. */
export function chunkStarts(level: string, range: { from: number; to: number }, from = range.from, to = range.to): number[] {
  const lo = Math.max(from, range.from), hi = Math.min(to, range.to);
  const out: number[] = [];
  if (lo > hi) return out;
  const n = chunkSize(level);
  for (let s = chunkStart(level, lo); s <= hi; s += n) out.push(s);
  return out;
}

/** Tên file chunk: `n5-dien` + bài đầu 2 chữ số → `n5-dien-01.json`. */
export function chunkFile(deck: string, start: number): string {
  return `${deck}-${String(start).padStart(2, "0")}.json`;
}

/** Bài của câu (tag `lesson`: số hoặc mảng số). */
function lessonsOf(it: QuizItem): number[] {
  const l = it.tags.lesson;
  return (Array.isArray(l) ? l : [l]).filter((x): x is number => typeof x === "number");
}

/**
 * Chia câu của một deck đầy đủ vào các chunk của `range`: mỗi câu vào mọi chunk chứa một bài của nó trong `range`.
 * Câu không có bài nào trong `range` là lỗi sinh dữ liệu → throw (sẽ không bao giờ được tải).
 */
export function splitByChunk(items: readonly QuizItem[], level: string, range: { from: number; to: number }): Map<number, QuizItem[]> {
  const out = new Map<number, QuizItem[]>(chunkStarts(level, range).map((s) => [s, []]));
  for (const it of items) {
    const starts = new Set(lessonsOf(it).filter((l) => l >= range.from && l <= range.to).map((l) => chunkStart(level, l)));
    if (starts.size === 0) throw new Error(`${it.id}: bài ${JSON.stringify(it.tags.lesson)} ngoài khoảng ${range.from}–${range.to} của ${level}`);
    for (const s of starts) out.get(s)!.push(it);
  }
  return out;
}

/** Gộp câu của nhiều chunk, bỏ câu trùng ID (câu gắn nhiều bài), giữ thứ tự xuất hiện đầu tiên. */
export function uniqueById(items: Iterable<QuizItem>): QuizItem[] {
  const seen = new Set<string>();
  const out: QuizItem[] = [];
  for (const it of items) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
}

/** Đường dẫn (tương đối BASE_URL) các chunk cần tải cho khoảng bài [from, to] của deck `dir/deck`. */
export function chunkPaths(dir: string, deck: string, level: string, range: { from: number; to: number }, from?: number, to?: number): string[] {
  return chunkStarts(level, range, from, to).map((s) => `${dir}/${chunkFile(deck, s)}`);
}

/** Bảng chia gọn của quiz chia thể tách theo sách (câu chỉ lấy hàng của sách đang chọn — conjugation.ts rowsOf). */
export function conjPath(groupSlug: string, book: "minna" | "n3"): string {
  return `chia-the/quiz/${groupSlug}-${book}.json`;
}
