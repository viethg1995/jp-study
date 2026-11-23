// Bất biến bộ thủ ↔ chữ giáo trình trên dữ liệu thật (kanji.json + radicals.json).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { loadKanjiAndRadicals } from "../test/data.ts";
import { curriculumLevel, hasRadicalPage, radicalKanji, radicalNeighbors, radicalQuizHref } from "./radicals.ts";

const { kanji, radicals } = loadKanjiAndRadicals();
const byChar = new Map(kanji.map((k) => [k.char, k]));
const parts = (ch: string) => byChar.get(ch)?.radical_parts ?? [];

describe("bộ thủ → chữ giáo trình", () => {
  test("radical_parts luôn chứa bộ chính, tăng dần, không trùng", () => {
    for (const k of kanji) {
      if (k.radical !== null) assert.ok(k.radical_parts.includes(k.radical), k.char);
      assert.deepEqual(k.radical_parts, [...new Set(k.radical_parts)].sort((a, b) => a - b), k.char);
    }
  });

  test("bộ 1 nét chỉ có khi là bộ chính", () => {
    for (const k of kanji) for (const n of k.radical_parts) if (n <= 6) assert.equal(n, k.radical, k.char);
  });

  test("ví dụ thành phần: 休 có 人 + 木, 語 có 口 + 言, 朝 có 月 (74) chứ không phải 肉 (130)", () => {
    assert.ok(parts("休").includes(9) && parts("休").includes(75));
    assert.ok(parts("語").includes(30) && parts("語").includes(149));
    assert.ok(parts("朝").includes(74) && !parts("朝").includes(130));
  });

  test("mỗi chữ giáo trình xuất hiện đúng 1 lần ở mỗi bộ nó có; primary ∩ parts = ∅", () => {
    for (const r of radicals) {
      const d = radicalKanji(r.number, kanji);
      const p = d.primary.flatMap((g) => g.items.map((k) => k.char));
      const q = d.parts.flatMap((g) => g.items.map((k) => k.char));
      assert.equal(new Set([...p, ...q]).size, p.length + q.length, r.char);
      assert.equal(d.total, p.length + q.length);
      for (const k of d.other) assert.equal(curriculumLevel(k), null);
    }
  });

  test("tổng: mọi chữ giáo trình được liệt kê dưới mỗi bộ trong radical_parts của nó", () => {
    const count = new Map<string, number>();
    for (const r of radicals) {
      const d = radicalKanji(r.number, kanji);
      for (const g of [...d.primary, ...d.parts]) for (const k of g.items) count.set(k.char, (count.get(k.char) ?? 0) + 1);
    }
    for (const k of kanji) if (curriculumLevel(k) !== null) assert.equal(count.get(k.char), k.radical_parts.length, k.char);
  });
});

describe("điều hướng bộ thủ trước / sau", () => {
  const pages = radicals.filter((r) => hasRadicalPage(radicalKanji(r.number, kanji))).map((r) => r.number);

  test("có ~196 trang, bỏ qua bộ không có chữ", () => {
    assert.ok(pages.length > 150 && pages.length < radicals.length, String(pages.length));
  });

  test("prev/next luôn là bộ có trang, đối xứng, tăng dần theo số bộ", () => {
    const set = new Set(pages);
    for (const n of pages) {
      const { prev, next } = radicalNeighbors(n, pages);
      if (prev !== null) {
        assert.ok(set.has(prev) && prev < n);
        assert.equal(radicalNeighbors(prev, pages).next, n);
      }
      if (next !== null) {
        assert.ok(set.has(next) && next > n);
        assert.equal(radicalNeighbors(next, pages).prev, n);
      }
    }
  });

  test("bộ đầu không có prev, bộ cuối không có next; bộ không có trang → null", () => {
    const sorted = [...pages].sort((a, b) => a - b);
    assert.equal(radicalNeighbors(sorted[0]!, pages).prev, null);
    assert.equal(radicalNeighbors(sorted.at(-1)!, pages).next, null);
    const missing = radicals.find((r) => !pages.includes(r.number));
    if (missing) assert.deepEqual(radicalNeighbors(missing.number, pages), { prev: null, next: null });
  });

  test("link quiz theo nhóm số nét: phạm vi cả 214 bộ", () => {
    assert.equal(radicalQuizHref(3), "kanji/bo-thu/quiz/?pham-vi=tat-ca&net-tu=3&net-den=3");
  });
});
