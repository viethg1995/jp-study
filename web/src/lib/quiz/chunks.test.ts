// Chia file deck theo nhóm bài (Q12, plan/quiz/q12-deck-chunking.md bước 3) — hàm thuần + dữ liệu thật:
// hợp các chunk = deck đầy đủ, bộ lọc bài nào cũng đủ câu, mỗi chunk trong mốc dung lượng, đường dẫn trang tổng có thật.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { gzipSync } from "node:zlib";
import { loadConjugation, loadKanjiSource, loadVocab } from "../../test/data.ts";
import { chunkFile, chunkPaths, chunkStart, chunkStarts, conjPath, splitByChunk, uniqueById } from "./chunks.ts";
import { CONJ_GROUP_SLUG, CONJ_GROUPS, buildConjTable } from "./conjugation.ts";
import { matches } from "./core.ts";
import { KANJI_KINDS, KANJI_LEVELS, KANJI_VIEWS, type KanjiKindSlug, buildKanjiDeck, kanjiLessonRanges } from "./kanji.ts";
import { MIX_PARTS, mixFiles } from "./mix.ts";
import type { QuizItem } from "./types.ts";
import { LEVEL_LESSONS, VOCAB_KINDS, VOCAB_LEVELS, type VocabKindSlug, buildVocabDeck } from "./vocab.ts";

/** Mốc mỗi chunk (thay mốc cả cấp 500KB / 75KB). Đo 2026-11-17: lớn nhất kanji tv-n5-doc-06 ~144KB / ~22KB gzip (sát mốc gốc — gzip mới là dung lượng tải thật). */
const CHUNK_MAX = 150_000, CHUNK_MAX_GZ = 25_000;
/** Bảng chia gọn theo sách (không chia theo bài: Minna luôn tải bài 1 → "đã học tới"). Đo 2026-11-17: dong-tu-minna 477KB / 46KB. */
const CONJ_MAX = 550_000, CONJ_MAX_GZ = 55_000;

const size = (name: string, items: readonly QuizItem[]): [number, number] => {
  const json = JSON.stringify({ version: 1, name, items });
  return [Buffer.byteLength(json), gzipSync(json).length];
};

describe("hàm thuần", () => {
  test("cửa sổ cố định theo số bài: Minna 5 bài, N3 3 bài", () => {
    assert.deepEqual([1, 5, 6, 25, 26, 30, 31, 50].map((l) => chunkStart("n5", l)), [1, 1, 6, 21, 26, 26, 31, 46]);
    assert.deepEqual([1, 3, 4, 13, 14].map((l) => chunkStart("n3", l)), [1, 1, 4, 13, 13]);
    assert.deepEqual(chunkStarts("n5", LEVEL_LESSONS.n5), [1, 6, 11, 16, 21]);
    assert.deepEqual(chunkStarts("n4", LEVEL_LESSONS.n4), [26, 31, 36, 41, 46]);
    assert.deepEqual(chunkStarts("n3", LEVEL_LESSONS.n3), [1, 4, 7, 10, 13]);
    assert.deepEqual(chunkStarts("n5", LEVEL_LESSONS.n5, 3, 5), [1]);
    assert.deepEqual(chunkStarts("n5", LEVEL_LESSONS.n5, 5, 6), [1, 6]);
    assert.deepEqual(chunkStarts("n5", LEVEL_LESSONS.n5, 20, 30), [16, 21]); // cắt theo khoảng của cấp
    assert.deepEqual(chunkStarts("n4", LEVEL_LESSONS.n4, 1, 25), []);
    assert.equal(chunkFile("n5-dien", 6), "n5-dien-06.json");
    assert.deepEqual(chunkPaths("vocabulary/quiz", "n4-doc", "n4", LEVEL_LESSONS.n4, 48, 50), ["vocabulary/quiz/n4-doc-46.json"]);
    assert.equal(conjPath("dong-tu", "n3"), "chia-the/quiz/dong-tu-n3.json");
  });
  test("câu nhiều bài vào mọi chunk chứa bài đó; bỏ trùng khi gộp; câu ngoài khoảng → throw", () => {
    const it = (id: string, lesson: number[]): QuizItem => ({ id, kind: "v-read", prompt: "x", promptLang: "ja", hint: null, answer: "a", accepted: [], pool: [], explain: null, href: "", tags: { lesson } });
    const m = splitByChunk([it("a", [3]), it("b", [4, 12]), it("c", [7, 8])], "n5", LEVEL_LESSONS.n5);
    assert.deepEqual([...m].map(([s, xs]) => [s, xs.map((x) => x.id)]), [[1, ["a", "b"]], [6, ["c"]], [11, ["b"]], [16, []], [21, []]]);
    assert.deepEqual(uniqueById([...m.values()].flat()).map((x) => x.id), ["a", "b", "c"]);
    assert.throws(() => splitByChunk([it("d", [30])], "n5", LEVEL_LESSONS.n5), /ngoài khoảng/);
  });
});

/** Mọi bộ lọc bài liên tục [from, to] (bước 1 bài): câu khớp trong deck đầy đủ = câu khớp trong các chunk đã tải. */
function sameAsFull(name: string, items: readonly QuizItem[], level: string, range: { from: number; to: number }): void {
  const chunks = splitByChunk(items, level, range);
  const union = uniqueById([...chunks.values()].flat());
  assert.equal(union.length, items.length, `${name}: hợp chunk ≠ deck đầy đủ`);
  for (const [s, xs] of chunks) {
    const [raw, gz] = size(chunkFile(name, s), xs);
    assert.ok(raw < CHUNK_MAX && gz < CHUNK_MAX_GZ, `${chunkFile(name, s)}: ${raw} byte / ${gz} gzip`);
  }
  for (let from = range.from; from <= range.to; from++)
    for (const to of [from, Math.min(from + 2, range.to), range.to]) {
      const f = { lesson: { min: from, max: to } };
      const want = items.filter((x) => matches(x, f)).map((x) => x.id).sort();
      const got = uniqueById(chunkStarts(level, range, from, to).flatMap((s) => chunks.get(s)!)).filter((x) => matches(x, f)).map((x) => x.id).sort();
      assert.deepEqual(got, want, `${name} bài ${from}–${to}`);
    }
}

describe("deck từ vựng: chunk = deck đầy đủ, trong mốc dung lượng", () => {
  const vocab = loadVocab();
  const conj = loadConjugation();
  const tables = CONJ_GROUPS.map((g) => buildConjTable(g, conj.entries, conj.forms));
  for (const level of VOCAB_LEVELS)
    for (const slug of Object.keys(VOCAB_KINDS) as VocabKindSlug[])
      test(`${level}-${slug}`, () => sameAsFull(`${level}-${slug}`, buildVocabDeck(vocab, level, slug, tables).items, level, LEVEL_LESSONS[level]));
});

describe("deck Kanji: chunk = deck đầy đủ, trong mốc dung lượng", () => {
  const src = loadKanjiSource();
  const ranges = kanjiLessonRanges(src);
  for (const view of KANJI_VIEWS)
    for (const level of KANJI_LEVELS)
      for (const slug of Object.keys(KANJI_KINDS) as KanjiKindSlug[])
        test(`${view}-${level}-${slug}`, () => sameAsFull(`${view}-${level}-${slug}`, buildKanjiDeck(src, view, level, slug).items, level, ranges[view][level]));
});

describe("bảng chia gọn tách theo sách", () => {
  test("mỗi file trong mốc; hai sách đủ mọi hàng", () => {
    const conj = loadConjugation();
    for (const g of CONJ_GROUPS) {
      const t = buildConjTable(g, conj.entries, conj.forms);
      let rows = 0;
      for (const book of ["minna", "n3"] as const) {
        const part = { ...t, rows: t.rows.filter((r) => r.book === book) };
        rows += part.rows.length;
        const json = JSON.stringify(part);
        const [raw, gz] = [Buffer.byteLength(json), gzipSync(json).length];
        assert.ok(raw < CONJ_MAX && gz < CONJ_MAX_GZ, `${conjPath(CONJ_GROUP_SLUG[g], book)}: ${raw} byte / ${gz} gzip`);
      }
      assert.equal(rows, t.rows.length);
    }
  });
});

test("trang tổng: mọi đường dẫn mixFiles đều được endpoint sinh ra", () => {
  const ranges = kanjiLessonRanges(loadKanjiSource());
  const built = new Set<string>([
    ...VOCAB_LEVELS.flatMap((l) => (Object.keys(VOCAB_KINDS) as VocabKindSlug[]).flatMap((s) => chunkPaths("vocabulary/quiz", `${l}-${s}`, l, LEVEL_LESSONS[l]))),
    ...KANJI_VIEWS.flatMap((v) =>
      KANJI_LEVELS.flatMap((l) => (Object.keys(KANJI_KINDS) as KanjiKindSlug[]).flatMap((s) => chunkPaths("kanji/quiz", `${v}-${l}-${s}`, l, ranges[v][l]))),
    ),
    ...CONJ_GROUPS.flatMap((g) => (["minna", "n3"] as const).map((b) => conjPath(CONJ_GROUP_SLUG[g], b))),
    "luyen-tap/dem-so.json",
  ]);
  for (let from = 1; from <= 50; from += 7)
    for (const to of [from, Math.min(50, from + 4), 50])
      for (const f of mixFiles({ from, to, parts: MIX_PARTS })) assert.ok(built.has(f.path), `${f.path} (bài ${from}–${to})`);
});
