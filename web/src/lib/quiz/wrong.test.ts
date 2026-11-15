// Câu hay sai (Q10, plan/quiz/q10-wrong-answers.md) — hàm thuần lib/quiz/wrong.ts.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { QuizItem } from "./types.ts";
import { MAX_ITEMS, REMEMBER_STREAK, clearWrong, countWrong, emptyStore, kindOfId, parseStore, recordAnswer, reviewItems, type WrongStore } from "./wrong.ts";

const rec = (s: WrongStore, id: string, ok: boolean, now = 100): WrongStore => recordAnswer(s, id, ok, now).store;
const item = (id: string): QuizItem => ({ id, kind: kindOfId(id), prompt: id, promptLang: "ja", hint: null, explain: null, answer: "a", accepted: [], pool: ["b", "c", "d"], href: "", tags: {} });

describe("ghi câu trả lời", () => {
  test("sai → thêm (w=1, s=0); sai tiếp → w+1", () => {
    let s = rec(emptyStore(), "v-mean:a", false, 10);
    assert.deepEqual(s.items["v-mean:a"], { w: 1, s: 0, t: 10 });
    s = rec(s, "v-mean:a", false, 20);
    assert.deepEqual(s.items["v-mean:a"], { w: 2, s: 0, t: 20 });
  });

  test(`đúng ${REMEMBER_STREAK} lần liên tiếp → xóa (đã nhớ); trước đó vẫn còn`, () => {
    assert.equal(REMEMBER_STREAK, 3);
    let s = rec(emptyStore(), "x:1", false);
    s = rec(s, "x:1", true);
    s = rec(s, "x:1", true);
    assert.equal(s.items["x:1"]?.s, 2);
    const r = recordAnswer(s, "x:1", true, 100);
    assert.equal(r.remembered, true);
    assert.equal(r.store.items["x:1"], undefined);
  });

  test("sai xen giữa → chuỗi đúng về 0", () => {
    let s = rec(emptyStore(), "x:1", false);
    s = rec(rec(s, "x:1", true), "x:1", true);
    s = rec(s, "x:1", false);
    assert.deepEqual(s.items["x:1"], { w: 2, s: 0, t: 100 });
  });

  test("câu chưa từng sai mà đúng → không ghi gì; store cũ không bị sửa", () => {
    const s0 = emptyStore();
    const s = rec(s0, "x:1", true);
    assert.deepEqual(s.items, {});
    rec(s0, "x:2", false);
    assert.deepEqual(s0.items, {});
  });

  test(`tối đa ${MAX_ITEMS} câu: vượt → bỏ câu cập nhật cũ nhất`, () => {
    let s = emptyStore();
    for (let i = 0; i < MAX_ITEMS; i++) s = rec(s, `x:${i}`, false, 1000 + i);
    s = rec(s, "x:new", false, 5000);
    assert.equal(Object.keys(s.items).length, MAX_ITEMS);
    assert.equal(s.items["x:0"], undefined); // cũ nhất
    assert.ok(s.items["x:new"] && s.items["x:1"]);
  });
});

describe("đọc dữ liệu đã lưu", () => {
  test("null / JSON hỏng / sai phiên bản → rỗng; mục hỏng bị bỏ", () => {
    for (const raw of [null, "", "{", "[]", '{"v":2,"items":{}}', '{"v":1}', "null"]) assert.deepEqual(parseStore(raw), emptyStore(), String(raw));
    const s = parseStore('{"v":1,"items":{"a:1":{"w":1,"s":0,"t":5},"a:2":{"w":"x"},"a:3":null}}');
    assert.deepEqual(s.items, { "a:1": { w: 1, s: 0, t: 5 } });
  });

  test("ghi rồi đọc lại → như cũ", () => {
    const s = rec(rec(emptyStore(), "v-mean:a", false), "k-hv:b", false);
    assert.deepEqual(parseStore(JSON.stringify(s)), s);
  });
});

describe("phạm vi trang, xóa, thứ tự ôn", () => {
  const s = ["v-mean:a", "v-read:b", "k-hv:c", "n-num:basic-4"].reduce((acc, id) => rec(acc, id, false), emptyStore());

  test("đếm theo loại câu của trang; rỗng = mọi loại (trang tổng)", () => {
    assert.equal(countWrong(s, ["v-mean", "v-read", "v-word"]), 2);
    assert.equal(countWrong(s, ["k-hv"]), 1);
    assert.equal(countWrong(s, []), 4);
    assert.equal(kindOfId("n-num:basic-4"), "n-num");
  });

  test("xóa chỉ loại câu của trang; rỗng = xóa hết", () => {
    assert.deepEqual(Object.keys(clearWrong(s, ["v-mean", "v-read"]).items).sort(), ["k-hv:c", "n-num:basic-4"]);
    assert.deepEqual(clearWrong(s, []).items, {});
  });

  test("chế độ ôn: chỉ câu đã lưu; sai nhiều trước, rồi sai gần đây", () => {
    let st = rec(rec(rec(emptyStore(), "x:1", false, 10), "x:1", false, 11), "x:2", false, 50);
    st = rec(st, "x:3", false, 40);
    const out = reviewItems(["x:0", "x:1", "x:2", "x:3"].map(item), st, () => 0.5).map((q) => q.id);
    assert.deepEqual(out, ["x:1", "x:2", "x:3"]);
  });
});
