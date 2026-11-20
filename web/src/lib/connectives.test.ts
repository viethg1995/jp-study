// Từ nối (trang /tu-noi/) trên dữ liệu thật: mọi mục có nhóm chức năng, link từ vựng tìm được, thay thế đối xứng.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { loadConnectives, loadVocab } from "../test/data.ts";
import { parseRuby } from "./ruby.ts";
import { connectiveHref, grammarLabel, groupByFunction, sourceLabel, vocabHref } from "./connectives.ts";

const doc = loadConnectives();
const vocab = loadVocab();
const n3Lesson = new Map(vocab.filter((e) => e.book === "n3").map((e) => [e.id, e.lesson]));

describe("từ nối", () => {
  test("mỗi mục vào đúng một nhóm chức năng; nhóm trong mục: nối câu trước, N5 → N3", () => {
    const groups = groupByFunction(doc.functions, doc.connectives);
    assert.equal(groups.reduce((n, g) => n + g.items.length, 0), doc.connectives.length);
    for (const g of groups) {
      const firstClause = g.items.findIndex((c) => c.type === "clause");
      if (firstClause >= 0) assert.ok(g.items.slice(firstClause).every((c) => c.type === "clause"), g.fn.id);
    }
  });
  test("link từ vựng trỏ đúng thẻ có thật; substitutes đối xứng; ví dụ có đúng một [[…]]", () => {
    const ids = new Set(vocab.map((e) => e.id));
    const byId = new Map(doc.connectives.map((c) => [c.id, c]));
    for (const c of doc.connectives) {
      for (const v of c.vocab_refs) {
        assert.ok(ids.has(v), `${c.id}: ${v}`);
        assert.ok(vocabHref(v, n3Lesson)?.endsWith(`/#${v}`), `${c.id}: ${v}`);
      }
      for (const s of c.substitutes) assert.ok(byId.get(s)?.substitutes.includes(c.id), `${c.id} ↔ ${s}`);
      for (const e of c.examples) assert.equal(parseRuby(e.ruby).filter((x) => x.target).length > 0, true, e.id);
    }
  });
  test("nhãn", () => {
    assert.equal(sourceLabel({ book: "minna", lesson: 28 }), "Minna bài 28");
    assert.equal(sourceLabel({ book: "n3", lesson: 14 }), "N3 bài 14");
    assert.equal(sourceLabel({ book: null, lesson: null }), "Ngoài giáo trình");
    assert.equal(grammarLabel("g-09-7"), "Ngữ pháp bài 9");
    assert.equal(connectiveHref("cn-noni"), "tu-noi/#cn-noni");
    assert.equal(vocabHref("mn-08-046", n3Lesson), "vocabulary/8/#mn-08-046");
    assert.equal(vocabHref("n3-687", n3Lesson), "vocabulary/n3/14/#n3-687");
  });
});
