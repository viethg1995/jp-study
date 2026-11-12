// Ngẫu nhiên có seed — test cố định seed để kết quả lặp lại; trên web dùng randomSeed().

/** Hàm trả số thực trong [0, 1). */
export type Rng = () => number;

/** mulberry32: nhanh, đủ đều cho việc trộn câu hỏi (không dùng cho bảo mật). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;
}

/** Bản sao đã trộn (Fisher–Yates), không sửa mảng gốc. */
export function shuffle<T>(xs: readonly T[], rng: Rng): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** n phần tử khác vị trí, thứ tự ngẫu nhiên (n > độ dài → lấy hết). */
export function sample<T>(xs: readonly T[], n: number, rng: Rng): T[] {
  return shuffle(xs, rng).slice(0, Math.max(0, n));
}
