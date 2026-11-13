// Trang tổng /luyen-tap/ (Q8) trên dữ liệu thật: dựng đúng "file" như endpoint sinh lúc build rồi chạy mixFiles → mixItems.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { loadConjugation, loadCounters, loadKanjiSource, loadVocab } from "../../test/data.ts";
import { buildQuizItems, toQuizItems } from "../counter-quiz.ts";
import { buildConjTable, CONJ_GROUP_SLUG, CONJ_GROUPS, type ConjTable, learnedForms } from "./conjugation.ts";
import { partOf } from "./core.ts";
import { buildKanjiDeck, type KanjiKindSlug, type KanjiLevel } from "./kanji.ts";
import { MIX_KIND_LABELS, MIX_PARTS, type MixFile, type MixOptions, mixFiles, mixItems } from "./mix.ts";
import { mulberry32 } from "./random.ts";
import { createSession } from "./session.ts";
import type { Deck, QuizItem } from "./types.ts";
import { checkDeck } from "./validate.ts";
import { buildVocabDeck, type VocabKindSlug, type VocabLevel } from "./vocab.ts";

const vocab = loadVocab();
const kanji = loadKanjiSource();
const conj = loadConjugation();
const tables = new Map<string, ConjTable>(CONJ_GROUPS.map((g) => [CONJ_GROUP_SLUG[g], buildConjTable(g, conj.entries, conj.forms)]));
const counters: Deck = { version: 1, name: "dem-so", items: toQuizItems(buildQuizItems(loadCounters())) };

const cache = new Map<string, unknown>();
/** Nội dung file như endpoint build ra (cùng hàm sinh). */
function fileData(f: MixFile): unknown {
  let d = cache.get(f.path);
  if (d !== undefined) return d;
  let m: RegExpMatchArray | null;
  if ((m = f.path.match(/^vocabulary\/quiz\/(n\d)-(\w+)\.json$/))) d = { version: 1, name: "", items: buildVocabDeck(vocab, m[1] as VocabLevel, m[2] as VocabKindSlug).items };
  else if ((m = f.path.match(/^kanji\/quiz\/tv-(n\d)-(\w+)\.json$/))) d = { version: 1, name: "", items: buildKanjiDeck(kanji, "tv", m[1] as KanjiLevel, m[2] as KanjiKindSlug).items };
  else if ((m = f.path.match(/^chia-the\/quiz\/([\w-]+)\.json$/))) d = tables.get(m[1]!);
  else if (f.path === "luyen-tap/dem-so.json") d = counters;
  assert.ok(d, `không dựng được ${f.path}`);
  cache.set(f.path, d);
  return d;
}
const mix = (o: Partial<MixOptions> = {}): QuizItem[] => {
  const opts: MixOptions = { from: 1, to: 25, parts: MIX_PARTS, ...o };
  const files = mixFiles(opts);
  return mixItems(opts, files, files.map(fileData));
};
const lessonsOf = (q: QuizItem): number[] => [q.tags.lesson ?? []].flat().map(Number);

describe("mixFiles: chỉ tải file của cấp có bài trong khoảng (Q8-4)", () => {
  test("bài 1–25 → chỉ N5: 3 từ vựng + 3 Kanji + 3 bảng chia + đếm số", () => {
    const files = mixFiles({ from: 1, to: 25, parts: MIX_PARTS });
    assert.equal(files.length, 10);
    assert.ok(!files.some((f) => /n4/.test(f.path)), files.map((f) => f.path).join(" "));
  });
  test("bài 20–30 → cả N5 và N4; bài 26–50 → chỉ N4", () => {
    const mid = mixFiles({ from: 20, to: 30, parts: MIX_PARTS }).map((f) => f.path);
    assert.ok(mid.includes("vocabulary/quiz/n5-doc.json") && mid.includes("kanji/quiz/tv-n4-hv.json"));
    assert.ok(!mixFiles({ from: 26, to: 50, parts: MIX_PARTS }).some((f) => /n5/.test(f.path)));
  });
  test("chỉ chọn phần → chỉ file của phần đó; không chọn gì → không file nào", () => {
    assert.deepEqual(new Set(mixFiles({ from: 1, to: 50, parts: ["kanji"] }).map((f) => f.part)), new Set(["kanji"]));
    assert.deepEqual(mixFiles({ from: 1, to: 50, parts: [] }), []);
  });
});

describe("mixItems trên dữ liệu thật", () => {
  test("bài 1–50, đủ 4 phần: id duy nhất, checkDeck 0 lỗi, mọi loại câu có nhãn góc thẻ", () => {
    const items = mix({ to: 50 });
    assert.equal(new Set(items.map((q) => q.id)).size, items.length);
    assert.deepEqual(checkDeck(items).slice(0, 5), []);
    const kinds = new Set(items.map((q) => q.kind));
    assert.deepEqual(kinds, new Set(Object.keys(MIX_KIND_LABELS)));
    assert.deepEqual(new Set(items.map(partOf)), new Set(["v", "k", "c", "n"]));
  });
  test("gợi ý luôn hiện chỉ là gợi ý cần để trả lời; bài / số nét / loại từ nằm trong info (ô ⓘ)", () => {
    const items = mix({ to: 50 });
    for (const q of items) {
      assert.ok(!/Bài \d|nét$|^～/.test(q.hint ?? ""), `${q.id}: ${q.hint}`);
      assert.ok(q.info, `${q.id} thiếu info`);
    }
    assert.ok(items.some((q) => q.kind === "v-cloze" && q.hint), "câu điền từ phải có câu dịch");
  });
  test("bài 10–12: từ vựng, Kanji, chia thể chỉ có câu thuộc bài 10–12; thể chỉ gồm thể đã học tới bài 12", () => {
    const items = mix({ from: 10, to: 12 });
    for (const q of items.filter((x) => x.kind !== "n-ctr")) assert.ok(lessonsOf(q).some((l) => l >= 10 && l <= 12), `${q.id} ${lessonsOf(q)}`);
    const learned = new Set(learnedForms(tables.get("dong-tu")!, { book: "minna", upTo: 12 }).map((f) => f.id));
    const verbForms = items.filter((q) => q.kind === "c-to" && q.href.startsWith("chia-the/dong-tu/")).map((q) => q.id.split(":")[2]!);
    assert.ok(verbForms.length > 0);
    for (const f of verbForms) assert.ok(learned.has(f), f);
  });
  test("chia thể: thông tin ⓘ có nhóm từ; không có câu Nhóm động từ", () => {
    const items = mix({ parts: ["chia-the"] });
    assert.ok(items.length > 0 && items.every((q) => /^(Động từ|Tính từ い|Tính từ な) - .+\nBài \d+$/.test(q.info ?? "")), items[0]?.info ?? "");
    assert.ok(!items.some((q) => q.kind === "c-group"));
  });
  test("đếm số: nhóm 'Cần nhớ' (149 câu), câu dẫn 'Đọc thế nào?', không theo bài", () => {
    const a = mix({ parts: ["dem-so"] });
    const b = mix({ from: 40, to: 41, parts: ["dem-so"] });
    assert.equal(a.length, 149);
    assert.equal(b.length, 149);
  });
});

describe("trộn đều theo phần, trong phần theo loại câu (Q8-3)", () => {
  test("lượt 20 câu × 4 phần → 5/5/5/5; trong phần, số câu mỗi loại chênh ≤ 1", () => {
    const items = mix({ to: 50 });
    for (let seed = 1; seed <= 10; seed++) {
      const s = createSession(items, mulberry32(seed), 20, partOf, (q) => q.kind);
      const asked: QuizItem[] = [];
      while (s.current) {
        asked.push(s.current.item);
        s.answer(0);
        s.next();
      }
      assert.equal(asked.length, 20);
      const byPart = Map.groupBy(asked, partOf);
      assert.deepEqual([...byPart.values()].map((v) => v.length), [5, 5, 5, 5]);
      for (const [p, qs] of byPart) {
        const counts = [...Map.groupBy(qs, (q) => q.kind).values()].map((v) => v.length);
        const kindsInPart = new Set(items.filter((q) => partOf(q) === p).map((q) => q.kind)).size;
        assert.equal(counts.length, Math.min(kindsInPart, 5), `${p}: ${counts}`);
        assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `${p}: ${counts}`);
      }
    }
  });
});
