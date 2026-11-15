import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { mulberry32 } from "./random.ts";
import { createSession } from "./session.ts";
import type { QuizItem } from "./types.ts";

const deck: QuizItem[] = ["a", "b", "c", "d", "e"].map((id) => ({
  id,
  kind: "t",
  prompt: id,
  promptLang: "ja",
  hint: null,
  answer: `ans-${id}`,
  accepted: [],
  pool: ["x1", "x2", "x3", "x4"],
  explain: null,
  href: "",
  tags: {},
}));

const wrongIndex = (s: ReturnType<typeof createSession>): number => (s.current!.correct + 1) % 4;

describe("session", () => {
  test("bắt đầu với câu đầu, 4 lựa chọn, chưa trả lời", () => {
    const s = createSession(deck, mulberry32(1), 10);
    assert.ok(s.current);
    assert.equal(s.current.options.length, 4);
    assert.equal(s.current.options[s.current.correct], s.current.item.answer);
    assert.equal(s.answered, false);
    assert.equal(s.done, false);
  });

  test("chấm đúng/sai, đếm điểm; không trả lời 2 lần một câu", () => {
    const s = createSession(deck, mulberry32(2), 10);
    const r1 = s.answer(s.current!.correct)!;
    assert.equal(r1.ok, true);
    assert.equal(s.answer(0), null);
    s.next();
    const r2 = s.answer(wrongIndex(s))!;
    assert.equal(r2.ok, false);
    assert.equal(s.right, 1);
    assert.equal(s.total, 2);
  });

  test("vị trí ngoài khoảng → null, không tính điểm", () => {
    const s = createSession(deck, mulberry32(3), 10);
    assert.equal(s.answer(-1), null);
    assert.equal(s.answer(4), null);
    assert.equal(s.total, 0);
  });

  test("lượt 3 câu: hết câu thứ 3 → done, current null", () => {
    const s = createSession(deck, mulberry32(4), 3);
    for (let i = 0; i < 3; i++) {
      assert.ok(s.current);
      s.answer(0);
      s.next();
    }
    assert.equal(s.done, true);
    assert.equal(s.current, null);
    assert.equal(s.total, 3);
  });

  test("wrong(): mỗi câu sai một lần, theo thứ tự gặp; làm lại câu sai hỏi đúng các câu đó", () => {
    const s = createSession(deck, mulberry32(5), 5);
    const missed: string[] = [];
    for (let i = 0; i < 5; i++) {
      if (i % 2 === 0) {
        missed.push(s.current!.item.id);
        s.answer(wrongIndex(s));
      } else s.answer(s.current!.correct);
      s.next();
    }
    assert.deepEqual(s.wrong().map((x) => x.id), missed);

    const retry = createSession(s.wrong(), mulberry32(6), s.wrong().length);
    const asked: string[] = [];
    while (retry.current) {
      asked.push(retry.current.item.id);
      retry.answer(0);
      retry.next();
    }
    assert.deepEqual([...asked].sort(), [...missed].sort());
  });

  test("không giới hạn: hỏi quá số câu của deck, finish() kết thúc", () => {
    const s = createSession(deck, mulberry32(7), null);
    for (let i = 0; i < 12; i++) {
      assert.ok(s.current, `câu ${i}`);
      s.answer(0);
      s.next();
    }
    s.finish();
    assert.equal(s.done, true);
    assert.equal(s.current, null);
    assert.equal(s.next(), null);
  });

  test("deck rỗng: không có câu, không phải done (để hiện thông báo bộ lọc)", () => {
    const s = createSession([], mulberry32(8), 10);
    assert.equal(s.current, null);
    assert.equal(s.done, false);
  });
});
