// Quiz số đếm n-num (Q7, plan/quiz/q07-numbers.md) — chạy trên dữ liệu thật data/counters.json.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { loadNumbers } from "../../test/data.ts";
import { numberItems } from "./numbers.ts";
import { checkDeck } from "./validate.ts";

const items = numberItems(loadNumbers());
const byPrompt = (p: string) => {
  const q = items.find((x) => x.prompt === p);
  assert.ok(q, `thiếu câu ${p}`);
  return q;
};
const near = (p: string): string[] => byPrompt(p).pool.slice(0, 6); // = NEAR: makeOptions bốc trong 6 mục đầu

describe("n-num (số đếm)", () => {
  test("đủ 86 số của trang Số đếm, ID duy nhất, checkDeck 0 lỗi, mỗi câu ≥ 3 nhiễu", () => {
    assert.equal(items.length, 86);
    assert.equal(new Set(items.map((q) => q.id)).size, items.length);
    assert.deepEqual(checkDeck(items).slice(0, 5), []);
    for (const q of items) assert.ok(q.pool.length >= 3, q.id);
  });

  test("không cách đọc đúng nào (kana + alt) lọt vào nhiễu", () => {
    for (const q of items) for (const p of q.pool) assert.ok(p !== q.answer && !q.accepted.includes(p), `${q.id}: ${p}`);
  });

  test("4/7/9: cách đọc khác cũng đúng (し, しち, く), không làm nhiễu", () => {
    for (const [n, alt] of [["4", "し"], ["7", "しち"], ["9", "く"]] as const) {
      const q = byPrompt(n);
      assert.ok(q.accepted.includes(alt), n);
      assert.ok(!q.pool.includes(alt), n);
    }
  });

  test("nhiễu lỗi hay gặp: biến âm sai/thiếu, bỏ/thêm いち, phân số đảo, thập phân đọc liền", () => {
    const cases: [string, string][] = [
      ["300", "さんひゃく"],
      ["600", "ろくひゃく"],
      ["800", "はちひゃく"],
      ["3,000", "さんせん"],
      ["6,000", "ろっせん"],
      ["500", "ごびゃく"],
      ["10,000", "まん"],
      ["100,000,000", "おく"],
      ["10", "いちじゅう"],
      ["100", "いちひゃく"],
      ["1/3", "いちぶんのさん"],
      ["3.14", "さんてんじゅうよん"],
    ];
    for (const [p, slip] of cases) assert.ok(near(p).includes(slip), `${p}: ${near(p).join(" / ")}`);
  });

  test("thông tin ⓘ: cách viết chữ Hán (nếu khác đề) + tên nhóm; link tới đúng tab trang Số đếm", () => {
    const q = byPrompt("3,800");
    assert.equal(q.info, "三千八百\nTrăm · nghìn");
    assert.equal(q.href, "dem-so/so-dem/#hundreds");
    assert.equal(q.question, "Đọc thế nào?");
    assert.equal(byPrompt("第1").info, "Số khác"); // viết như đề → chỉ tên nhóm
  });
});
