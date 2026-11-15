import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { loadCounters } from "../../test/data.ts";
import { buildQuizItems, toQuizItems } from "../counter-quiz.ts";
import type { QuizItem } from "./types.ts";
import { checkDeck, finalizeDeck, isValidRuby, rubyForms } from "./validate.ts";

function q(over: Partial<QuizItem> = {}): QuizItem {
  return {
    id: "t:1",
    kind: "t",
    prompt: "{先生|せんせい}",
    promptLang: "ja",
    hint: null,
    answer: "giáo viên",
    accepted: [],
    pool: ["học sinh", "bác sĩ", "nhân viên"],
    explain: null,
    href: "",
    tags: {},
    ...over,
  };
}
const rules = (items: QuizItem[]): string[] => checkDeck(items).map((x) => x.rule);

describe("isValidRuby / rubyForms", () => {
  test("cú pháp đúng", () => {
    for (const s of ["かな", "{漢字|かんじ}です", "{明日|あした}[[{行|い}きます]]。", ""]) assert.ok(isValidRuby(s), s);
  });
  test("cú pháp sai", () => {
    for (const s of ["{漢字", "漢字|かな", "{漢字|}", "[[あ", "あ]]x{a|b}", "[[あ[[い]]]]", "{a|b|c}", "a}b"]) assert.ok(!isValidRuby(s), s);
  });
  test("chuỗi thường có ngoặc vuông lẻ là hợp lệ, hiển thị nguyên văn", () => {
    assert.ok(isValidRuby("hút [thuốc lá]"));
    assert.deepEqual(rubyForms("chậm, muộn [giờ]"), { text: "chậm, muộn [giờ]", reading: "chậm, muộn [giờ]" });
  });
  test("chữ hiển thị và cách đọc", () => {
    assert.deepEqual(rubyForms("{先生|せんせい}です"), { text: "先生です", reading: "せんせいです" });
  });
});

describe("checkDeck — mỗi quy tắc bắt đúng lỗi", () => {
  test("deck đúng → không lỗi", () => assert.deepEqual(rules([q(), q({ id: "t:2" })]), []));
  test("1. đáp án đúng lọt vào nhiễu (cả accepted, cả khác katakana/hiragana)", () => {
    assert.deepEqual(rules([q({ pool: ["giáo viên", "a", "b", "c"] })]), ["answer-in-pool"]);
    assert.deepEqual(rules([q({ accepted: ["thầy"], pool: ["thầy", "a", "b", "c"] })]), ["answer-in-pool"]);
    assert.deepEqual(rules([q({ prompt: "x", answer: "テレビ", pool: ["てれび", "a", "b", "c"] })]), ["answer-in-pool"]);
  });
  test("2. thiếu nhiễu / nhiễu trùng", () => {
    assert.deepEqual(rules([q({ pool: ["a", "b"] })]), ["pool-too-small"]);
    assert.deepEqual(rules([q({ pool: ["a", "b", "b", "c"] })]), ["pool-too-small"]);
  });
  test("3. trùng id", () => assert.deepEqual(rules([q(), q()]), ["duplicate-id"]));
  test("4. ruby sai ở prompt hoặc đáp án", () => {
    assert.deepEqual(rules([q({ prompt: "{先生|せんせい" })]), ["bad-ruby"]);
    assert.deepEqual(rules([q({ pool: ["a", "b", "{c"] })]), ["bad-ruby"]);
  });
  test("5. câu hỏi lộ đáp án qua furigana hoặc chữ", () => {
    assert.deepEqual(rules([q({ answer: "せんせい", pool: ["a", "b", "c"] })]), ["leak"]);
    assert.deepEqual(rules([q({ prompt: "先生", answer: "先生", pool: ["a", "b", "c"] })]), ["leak"]);
    assert.deepEqual(rules([q({ prompt: "先生", answer: "せんせい", pool: ["a", "b", "c"] })]), []);
  });
});

describe("finalizeDeck", () => {
  test("bỏ câu thiếu nhiễu, giữ câu đúng, ghi lý do", () => {
    const { items, dropped } = finalizeDeck([q(), q({ id: "t:2", pool: ["a"] })]);
    assert.deepEqual(items.map((x) => x.id), ["t:1"]);
    assert.deepEqual(dropped.map((x) => [x.id, x.rule]), [["t:2", "pool-too-small"]]);
  });
  test("lỗi khác → throw", () => {
    assert.throws(() => finalizeDeck([q(), q()]), /duplicate-id/);
    assert.throws(() => finalizeDeck([q({ pool: ["giáo viên", "a", "b", "c"] })]), /answer-in-pool/);
  });
});

describe("dữ liệu thật: quiz đếm số qua kiểu chung", () => {
  const items = toQuizItems(buildQuizItems(loadCounters()));
  test("366 câu, checkDeck không lỗi", () => {
    assert.equal(items.length, 366);
    assert.deepEqual(checkDeck(items).slice(0, 5), []);
  });
  test("finalizeDeck không bỏ câu nào", () => {
    assert.equal(finalizeDeck(items).dropped.length, 0);
  });
});
