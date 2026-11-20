// Chia một bài từ vựng thành các phần nhỏ để học từng đợt (chỉ là cách xem — không lưu, không đổi ID).
// Chia liên tiếp theo thứ tự sách (từ cùng chủ đề vốn đứng gần nhau), các phần chênh nhau tối đa 1 từ.

/** Số phần theo số từ của bài: ≤ 20 → 1, 21–35 → 2, > 35 → 3. */
export function partCount(total: number): number {
  if (total <= 20) return 1;
  if (total <= 35) return 2;
  return 3;
}

/** Chia `items` thành `partCount(items.length)` phần liên tiếp; phần đầu nhận từ dư. */
export function splitParts<T>(items: readonly T[]): T[][] {
  const k = partCount(items.length);
  const base = Math.floor(items.length / k);
  const extra = items.length % k;
  const out: T[][] = [];
  let start = 0;
  for (let i = 0; i < k; i++) {
    const size = base + (i < extra ? 1 : 0);
    out.push(items.slice(start, start + size));
    start += size;
  }
  return out;
}

/** Số phần (1-based) của từng phần tử, cùng thứ tự với `items`. */
export function partNumbers<T>(items: readonly T[]): number[] {
  return splitParts(items).flatMap((p, i) => p.map(() => i + 1));
}
