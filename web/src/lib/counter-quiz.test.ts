// Bất biến của quiz đếm số trên dữ liệu thật data/counters.json (plan/quiz.md §3).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { loadCounters } from "../test/data.ts";
import { buildQuizItems, distractors } from "./counter-quiz.ts";

const counters = loadCounters();
const items = buildQuizItems(counters);
const byId = new Map(items.map((q) => [q.id, q]));

describe("quiz đếm số — bất biến", () => {
  test("id duy nhất", () => {
    assert.equal(byId.size, items.length);
  });

  test("đáp án đúng (kana + alt) không bao giờ nằm trong đáp án nhiễu", () => {
    const bad = items.filter((q) => [q.answer, ...q.alt].some((a) => q.pool.includes(a)));
    assert.deepEqual(bad.map((q) => q.id), []);
  });

  test("mỗi câu có ≥ 3 đáp án nhiễu khác nhau", () => {
    const bad = items.filter((q) => new Set(q.pool).size < 3 || new Set(q.pool).size !== q.pool.length);
    assert.deepEqual(bad.map((q) => `${q.id}: ${q.pool.join(",")}`), []);
  });
});

describe("quiz đếm số — trường hợp đã biết", () => {
  test("3本: đúng さんぼん, nhiễu có さんほん và さんぽん", () => {
    const q = byId.get("c-hon-3")!;
    assert.equal(q.answer, "さんぼん");
    assert.ok(q.pool.includes("さんほん"));
    assert.ok(q.pool.includes("さんぽん"));
    assert.ok(q.changed);
  });

  test("8本: はっぽん và はちほん đều đúng → không có trong nhiễu", () => {
    const q = byId.get("c-hon-8")!;
    assert.equal(q.answer, "はっぽん");
    assert.deepEqual(q.alt, ["はちほん"]);
    assert.ok(!q.pool.includes("はちほん"));
  });

  test("distractors() không trả về cách đọc đúng của bất kỳ ô nào trong cùng ô", () => {
    for (const c of counters) {
      for (const r of c.readings) {
        const pool = distractors(c, r);
        assert.ok(!pool.includes(r.kana), `${c.id}-${r.n}`);
      }
    }
  });

  // Mốc hồi quy cho Q3 (chuyển sang engine chung không được đổi số câu). Dữ liệu đếm số đổi → cập nhật số ở đây.
  test("số câu: tất cả 366, cần nhớ 149", () => {
    assert.equal(items.length, 366);
    assert.equal(items.filter((q) => q.changed).length, 149);
  });
});
