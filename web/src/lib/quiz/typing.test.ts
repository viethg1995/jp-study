// Gõ kana (Q9, plan/quiz/q09-kana-input.md): chấm câu gõ + dữ liệu thật của 5 loại câu gõ được.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { loadConjugation, loadCounters, loadKanjiSource, loadNumbers, loadVocab } from "../../test/data.ts";
import { buildQuizItems, toQuizItems } from "../counter-quiz.ts";
import { buildConjTable, CONJ_GROUPS, conjItems } from "./conjugation.ts";
import { buildKanjiDeck } from "./kanji.ts";
import { numberItems } from "./numbers.ts";
import { mulberry32 } from "./random.ts";
import { createSession } from "./session.ts";
import type { QuizItem } from "./types.ts";
import { TYPABLE_KINDS, isTypable, readingOf, typedCorrect, typingForm } from "./typing.ts";
import { buildVocabDeck } from "./vocab.ts";

const it = (answer: string, accepted: string[] = []): QuizItem => ({
  id: "x", kind: "v-read", prompt: "p", promptLang: "ja", hint: null, explain: null, answer, accepted, pool: ["a", "b", "c"], href: "", tags: {},
});

describe("chấm câu gõ", () => {
  test("romaji / hiragana / katakana / khoảng trắng; ruby so phần đọc", () => {
    assert.ok(typedCorrect(it("がくせい"), "gakusei"));
    assert.ok(typedCorrect(it("がくせい"), "がくせい"));
    assert.ok(typedCorrect(it("パーセント"), "pa-sento"));
    assert.ok(typedCorrect(it("{行|い}って"), "itte"));
    assert.ok(typedCorrect(it("ゼロさんの ごうろく"), "zerosannogouroku"));
    assert.ok(typedCorrect(it("よん", ["し"]), "shi"));
    assert.ok(!typedCorrect(it("がくせい"), "gakuse"));
    assert.ok(!typedCorrect(it("きって"), "kite"));
    assert.ok(!typedCorrect(it("がくせい"), ""));
    assert.equal(readingOf("[[{万|ばん}]]{事|じ}"), "ばんじ");
    assert.ok(typedCorrect(it("～じん"), "jin"));
    assert.ok(typedCorrect(it("おさきにどうぞ。"), "osakinidouzo"));
    assert.ok(typedCorrect(it("２，３にち"), "2,3nichi"));
    assert.ok(typedCorrect(it("110ばん"), "110ban"));
  });

  test("session.answerTyped: ô trống không chấm; sai lưu vào câu sai; Không biết = sai", () => {
    const deck = [it("がくせい"), { ...it("ほん"), id: "y" }];
    const s = createSession(deck, mulberry32(1), 2);
    assert.equal(s.answerTyped("   "), null);
    assert.equal(s.answered, false);
    const first = s.current!.item;
    const r = s.answerTyped(first.answer === "ほん" ? "hon" : "gakusei")!;
    assert.equal(r.ok, true);
    assert.equal(r.choice, first.answer);
    assert.equal(s.answerTyped("x"), null); // đã trả lời
    s.next();
    const g = s.answerTyped("", true)!;
    assert.equal(g.ok, false);
    assert.deepEqual([s.right, s.total, s.wrong().length], [1, 2, 1]);
  });
});

describe("dữ liệu thật: đáp án 5 loại câu gõ được đều là kana", () => {
  const KNOWN_BAD = ["v-read:mn-09-033", "v-read:mn-09-035"];
  const KANA = /^[ぁ-ゟー0-9]+$/u; // sau typingForm: hiragana (katakana đã đổi) + chữ số, không khoảng trắng / ký hiệu
  const vocab = loadVocab();
  const conj = loadConjugation();
  const tables = CONJ_GROUPS.map((g) => buildConjTable(g, conj.entries, conj.forms));
  const groups: [string, QuizItem[]][] = [
    ["v-read", (["n5", "n4", "n3"] as const).flatMap((l) => buildVocabDeck(vocab, l, "doc").items)],
    ["k-read", (["n5", "n4", "n3"] as const).flatMap((l) => buildKanjiDeck(loadKanjiSource(), "tv", l, "doc").items)],
    ["c-to", tables.flatMap((t) => conjItems(t, { book: "minna", upTo: 50, kinds: ["chia"] }))],
    ["n-ctr", toQuizItems(buildQuizItems(loadCounters()))],
    ["n-num", numberItems(loadNumbers())],
  ];
  test("đủ 5 loại", () => assert.deepEqual(groups.map(([k]) => k), [...TYPABLE_KINDS]));
  for (const [kind, items] of groups) {
    test(`${kind}: ${items.length} câu, phần đọc chỉ gồm kana (trừ lỗi dữ liệu đã biết → vẫn trắc nghiệm)`, () => {
      assert.ok(items.length > 50);
      const bad = items.filter((q) => ![q.answer, ...q.accepted].every((a) => KANA.test(typingForm(readingOf(a)))));
      assert.deepEqual(bad.filter((q) => isTypable(q)), []);
      // lỗi dữ liệu (README "Lỗi dữ liệu"): trường kanji/kana chứa nhiều cách viết "おっと/しゅじん"
      assert.ok(bad.every((q) => KNOWN_BAD.includes(q.id)), bad.map((q) => `${q.id} ${q.answer}`).join(", "));
    });
  }
});
