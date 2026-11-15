import assert from "node:assert/strict";
import { test } from "node:test";
import { mulberry32, sample, shuffle } from "./random.ts";

test("cùng seed → cùng dãy, khác seed → khác dãy", () => {
  const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
  const xa = Array.from({ length: 10 }, a), xb = Array.from({ length: 10 }, b), xc = Array.from({ length: 10 }, c);
  assert.deepEqual(xa, xb);
  assert.notDeepEqual(xa, xc);
  assert.ok(xa.every((x) => x >= 0 && x < 1));
});

test("shuffle giữ đủ phần tử, không sửa mảng gốc", () => {
  const src = [1, 2, 3, 4, 5, 6, 7, 8];
  const out = shuffle(src, mulberry32(1));
  assert.deepEqual([...out].sort((x, y) => x - y), src);
  assert.deepEqual(src, [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("shuffle phân bố đều: mỗi phần tử đứng đầu ~25% (4 phần tử, 4.000 lần)", () => {
  const rng = mulberry32(7);
  const first = new Map<string, number>();
  for (let i = 0; i < 4000; i++) {
    const k = shuffle(["a", "b", "c", "d"], rng)[0]!;
    first.set(k, (first.get(k) ?? 0) + 1);
  }
  for (const n of first.values()) assert.ok(n > 800 && n < 1200, `lệch: ${[...first]}`);
});

test("sample không trùng, n > độ dài → lấy hết, n ≤ 0 → rỗng", () => {
  const rng = mulberry32(3);
  const s = sample(["a", "b", "c", "d", "e"], 3, rng);
  assert.equal(new Set(s).size, 3);
  assert.equal(sample(["a", "b"], 5, rng).length, 2);
  assert.deepEqual(sample(["a"], 0, rng), []);
  assert.deepEqual(sample(["a"], -1, rng), []);
});
