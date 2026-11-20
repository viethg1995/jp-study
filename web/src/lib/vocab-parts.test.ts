import { test } from "node:test";
import assert from "node:assert/strict";
import type { VocabEntry } from "../content.config";
import { loadVocab } from "../test/data.ts";
import { partCount, partNumbers, splitParts } from "./vocab-parts.ts";

test("partCount: ngưỡng 20 / 35", () => {
  assert.deepEqual([1, 9, 20, 21, 35, 36, 57].map(partCount), [1, 1, 1, 2, 2, 3, 3]);
});

test("splitParts: liên tiếp, đủ, chênh tối đa 1, phần đầu nhận dư", () => {
  const a = Array.from({ length: 44 }, (_, i) => i);
  const parts = splitParts(a);
  assert.deepEqual(parts.map((p) => p.length), [15, 15, 14]);
  assert.deepEqual(parts.flat(), a);
  assert.deepEqual(splitParts([]), [[]]);
  assert.deepEqual(partNumbers(["a", "b", "c"]), [1, 1, 1]);
});

test("dữ liệu thật: mọi bài chia đủ từ, không trùng, mỗi phần 9–19 từ", () => {
  const lessons = new Map<string, VocabEntry[]>();
  for (const e of loadVocab()) {
    const key = `${e.book}-${e.lesson}`;
    lessons.set(key, [...(lessons.get(key) ?? []), e]);
  }
  assert.ok(lessons.size >= 64, `chỉ có ${lessons.size} bài`);
  for (const [key, entries] of lessons) {
    const parts = splitParts(entries);
    assert.deepEqual(parts.flat().map((e) => e.id), entries.map((e) => e.id), key);
    assert.equal(parts.length, partCount(entries.length), key);
    for (const p of parts) {
      // bài ngắn (< 9 từ, vd Minna bài 25) giữ nguyên 1 phần
      if (parts.length > 1) assert.ok(p.length >= 9 && p.length <= 19, `${key}: phần ${p.length} từ`);
    }
  }
});
