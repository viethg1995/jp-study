// Quiz Kanji + bộ thủ (Q5) trên dữ liệu thật data/kanji — bất biến + trường hợp đã biết (plan/quiz.md "Q5 — spec").
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { gzipSync } from "node:zlib";
import { loadKanjiSource } from "../../test/data.ts";
import { filterItems } from "./core.ts";
import {
  KANJI_KINDS,
  KANJI_LEVELS,
  KANJI_VIEWS,
  type KanjiKindSlug,
  type KanjiLevel,
  type KanjiView,
  RADICAL_KINDS,
  type RadicalKindSlug,
  buildKanjiDeck,
  buildRadicalDeck,
  kanjiLessonRanges,
  kanjiMeaning,
  lessonsOf,
  pickExamples,
  radicalScopes,
  swapReadings,
} from "./kanji.ts";
import type { QuizItem } from "./types.ts";
import { checkDeck, rubyForms } from "./validate.ts";

const src = loadKanjiSource();
const cache = new Map<string, ReturnType<typeof buildKanjiDeck>>();
const built = (view: KanjiView, level: KanjiLevel, slug: KanjiKindSlug): ReturnType<typeof buildKanjiDeck> => {
  const k = `${view}-${level}-${slug}`;
  if (!cache.has(k)) cache.set(k, buildKanjiDeck(src, view, level, slug));
  return cache.get(k)!;
};
const deck = (view: KanjiView, level: KanjiLevel, slug: KanjiKindSlug): QuizItem[] => built(view, level, slug).items;
const byChar = (items: QuizItem[], ch: string): QuizItem | undefined => items.find((q) => q.id.split(":")[1] === `k-${ch}`);
const kanji = (ch: string) => src.kanji.find((k) => k.char === ch)!;
const SLUGS = Object.keys(KANJI_KINDS) as KanjiKindSlug[];
const JA = /[぀-ヿ㐀-鿿]/u;

function sizeOk(name: string, items: QuizItem[]): void {
  // Đo 2026-11-12: lớn nhất tv-n5-doc ~526KB gốc / ~81KB gzip (1.317 câu, chỉ tải khi chọn "Cách đọc"); còn lại ≤ 40KB gzip
  const json = JSON.stringify({ version: 1, name, items });
  assert.ok(Buffer.byteLength(json) < 600_000, `${Buffer.byteLength(json)} byte`);
  assert.ok(gzipSync(json).length < 90_000, `${gzipSync(json).length} byte gzip`);
}

describe("30 deck chữ (xếp theo × cấp × loại)", () => {
  for (const view of KANJI_VIEWS) {
    for (const level of KANJI_LEVELS) {
      for (const slug of SLUGS) {
        test(`${view}-${level}-${slug}: checkDeck 0 lỗi, bỏ < 2% câu, kích thước`, () => {
          const { items, dropped } = built(view, level, slug);
          assert.ok(items.length > 50, `chỉ ${items.length} câu`);
          assert.deepEqual(checkDeck(items).slice(0, 5), []);
          assert.ok(dropped.length / (items.length + dropped.length) < 0.02, `bỏ ${dropped.length} câu`);
          assert.ok(items.every((q) => q.kind === KANJI_KINDS[slug] && q.tags.level === level));
          sizeOk(`${view}-${level}-${slug}`, items);
        });
      }
    }
  }
});

describe("cách xếp bài (Q5-2)", () => {
  test("khoảng bài khớp trang /kanji/<cấp>: giáo trình N5 1–26, N4 1–24, N3 1–35; từ vựng 1–25, 26–50, N3 1–14", () => {
    assert.deepEqual(kanjiLessonRanges(src), {
      gt: { n5: { from: 1, to: 26 }, n4: { from: 1, to: 24 }, n3: { from: 1, to: 35 } },
      tv: { n5: { from: 1, to: 25 }, n4: { from: 26, to: 50 }, n3: { from: 1, to: 14 } },
    });
  });
  test("số chữ mỗi nhóm: giáo trình 130/177/301, từ vựng 530/323/178", () => {
    const n = (v: KanjiView, l: KanjiLevel): number => src.kanji.filter((k) => lessonsOf(k, v, l, src.n3VocabLesson).length > 0).length;
    assert.deepEqual(KANJI_LEVELS.map((l) => n("gt", l)), [130, 177, 301]);
    assert.deepEqual(KANJI_LEVELS.map((l) => n("tv", l)), [530, 323, 178]);
  });
  test("chữ ở nhiều bài giáo trình N3 (個) → tag lesson nhiều giá trị, lọc bài nào cũng ra", () => {
    const ko = byChar(deck("gt", "n3", "hv"), "個")!;
    const ls = ko.tags.lesson as number[];
    assert.ok(ls.length >= 2, String(ls));
    for (const l of ls) assert.ok(filterItems([ko], { lesson: { min: l, max: l } }).length === 1);
  });
  test("lọc khoảng bài: gt-n5 bài 1–3 chỉ còn chữ bài 1–3", () => {
    const items = filterItems(deck("gt", "n5", "hv"), { lesson: { min: 1, max: 3 } });
    assert.ok(items.length > 5 && items.length < 25, String(items.length));
    for (const q of items) assert.ok((q.tags.lesson as number[]).some((l) => l <= 3), q.id);
  });
});

describe("k-hv, k-mean, k-char", () => {
  test("chữ 2 âm Hán-Việt: âm thứ hai vào accepted", () => {
    const two = src.kanji.filter((k) => k.han_viet.length === 2);
    assert.equal(two.length, 5);
    for (const k of two) {
      const q = KANJI_LEVELS.flatMap((l) => [...deck("gt", l, "hv"), ...deck("tv", l, "hv")]).find((x) => x.id === `k-hv:${k.id}`);
      if (!q) continue;
      assert.equal(q.answer, k.han_viet[0]);
      assert.deepEqual(q.accepted, [k.han_viet[1]]);
    }
  });
  test("giải thích mỗi ý một dòng: chữ · âm · nghĩa / On / Kun", () => {
    assert.equal(byChar(deck("tv", "n5", "hv"), "高")!.explain, "高 · CAO · cao; đắt\nOn: コウ\nKun: たか(い)、たか、だか、たか(まる)");
  });
  test("quốc tự 込 匂 (không có âm Hán-Việt) không có câu k-hv / k-char", () => {
    for (const v of KANJI_VIEWS) {
      for (const l of KANJI_LEVELS) {
        for (const slug of ["hv", "chu"] as const) {
          for (const ch of "込匂") assert.equal(byChar(deck(v, l, slug), ch), undefined, `${v}-${l}-${slug} ${ch}`);
        }
      }
    }
  });
  test("Q5-4: nghĩa bỏ chữ Nhật trong ngoặc, giữ phần tiếng Việt", () => {
    assert.equal(kanjiMeaning("quả táo (林檎)"), "quả táo");
    assert.equal(kanjiMeaning("(挨拶 chào hỏi)"), "chào hỏi");
    assert.equal(kanjiMeaning("xương sống; (風呂 bồn tắm)"), "xương sống; bồn tắm");
    assert.equal(kanjiMeaning("cơm hộp (弁当); biện luận"), "cơm hộp; biện luận");
    assert.equal(kanjiMeaning("nhà, quán (田舎 quê)"), "nhà, quán (quê)");
    assert.equal(kanjiMeaning("tờ, tấm (đếm vật mỏng)"), "tờ, tấm (đếm vật mỏng)");
  });
  test("không đề / đáp án / nhiễu nào của k-mean, k-char chứa chữ Nhật (nghĩa đã làm sạch)", () => {
    for (const v of KANJI_VIEWS) {
      for (const l of KANJI_LEVELS) {
        for (const q of deck(v, l, "nghia")) for (const s of [q.answer, ...q.pool]) assert.ok(!JA.test(s), `${q.id}: ${s}`);
        for (const q of deck(v, l, "chu")) assert.ok(!JA.test(q.prompt), `${q.id}: ${q.prompt}`);
      }
    }
  });
  test("chữ đồng nghĩa không làm nhiễu của nhau ở k-mean (休 / 憩 'nghỉ ngơi')", () => {
    for (const v of KANJI_VIEWS) {
      for (const l of KANJI_LEVELS) {
        for (const q of deck(v, l, "nghia")) {
          const keys = new Set(q.answer.split(/[,;]/).map((x) => x.trim().toLowerCase()));
          for (const p of q.pool) for (const x of p.split(/[,;]/)) assert.ok(!keys.has(x.trim().toLowerCase()), `${q.id}: ${p}`);
        }
      }
    }
  });
  test("k-char: nhiễu ưu tiên chữ giống hình — 聞 có 間 / 開 / 問 trong 3 nhiễu đầu", () => {
    const q = byChar(deck("tv", "n5", "chu"), "聞")!;
    assert.ok(q.pool.slice(0, 3).some((x) => "間開問".includes(x)), q.pool.join(" "));
  });
});

describe("k-read (Q5-3)", () => {
  test("≤ 3 từ mỗi chữ; ưu tiên từ giáo trình; có 1 On + 1 Kun nếu chữ có; bỏ từ chỉ một chữ", () => {
    for (const k of src.kanji) {
      const picked = pickExamples(k);
      assert.ok(picked.length <= 3, k.char);
      assert.ok(picked.every((e) => e.word !== k.char), k.char);
      const pool = k.examples.filter((e) => e.word !== k.char);
      for (const t of ["on", "kun"] as const) {
        if (pool.some((e) => e.reading_type === t)) assert.ok(picked.some((e) => e.reading_type === t), `${k.char} thiếu ${t}`);
      }
      if (pool.filter((e) => e.source === "vocab").length >= 3 && picked.length === 3) {
        // chỉ lấy JMdict khi cần đủ On/Kun
        const jm = picked.filter((e) => e.source === "jmdict");
        for (const e of jm) assert.ok(!pool.some((x) => x.source === "vocab" && x.reading_type === e.reading_type), `${k.char}: ${e.word}`);
      }
    }
  });
  test("đổi âm On ↔ Kun: 大学 → たいがく, おおがく; không trùng cách đọc đúng", () => {
    const dai = kanji("大");
    const ex = dai.examples.find((e) => e.word === "大学")!;
    const sw = swapReadings(dai, ex);
    assert.ok(sw.includes("たいがく") && sw.includes("おおがく"), sw.join(" "));
    assert.ok(!sw.includes("だいがく"));
  });
  test("mỗi từ chỉ hỏi 1 lần trong một deck; đề tô đúng chữ đang hỏi", () => {
    for (const v of KANJI_VIEWS) {
      for (const l of KANJI_LEVELS) {
        const words = new Set<string>();
        for (const q of deck(v, l, "doc")) {
          const w = rubyForms(q.prompt).text;
          assert.ok(!words.has(w), `${v}-${l}: ${w} hỏi 2 lần`);
          words.add(w);
          const m = /\[\[(.)\]\]/u.exec(q.prompt);
          assert.ok(m && q.id.startsWith(`k-read:k-${m[1]}:`), q.id);
        }
      }
    }
  });
  test("大学 nằm ở deck tv-n5 với nhiễu たいがく hoặc おおがく", () => {
    const q = deck("tv", "n5", "doc").find((x) => rubyForms(x.prompt).text === "大学")!;
    assert.equal(q.answer, "だいがく");
    assert.ok(q.pool.includes("たいがく") || q.pool.includes("おおがく"), q.pool.join(" "));
  });
});

describe("r-of (Q5-5)", () => {
  test("問 → 口 · Khẩu, nhiễu đầu là thành phần 門; giải thích nói rõ", () => {
    const q = byChar(deck("tv", "n5", "bo"), "問")!;
    assert.equal(q.answer, "口 · Khẩu");
    assert.equal(q.pool[0], "門 · Môn");
    assert.match(q.explain!, /門 chỉ là thành phần/);
  });
  test("chữ dùng biến thể hiện dạng biến thể: 何 → 亻 · Nhân", () => {
    assert.equal(byChar(deck("tv", "n5", "bo"), "何")!.answer, "亻 · Nhân");
  });
  test("dạng trong chữ là một bộ khác thì hiện chữ bộ gốc: 書 → 曰 · Viết (không phải 日)", () => {
    assert.equal(byChar(deck("gt", "n5", "bo"), "書")!.answer, "曰 · Viết");
  });
  test("chữ chính là bộ thủ (口, 木, 人) không có câu r-of", () => {
    for (const ch of "口木人") assert.equal(byChar(deck("tv", "n5", "bo"), ch), undefined, ch);
  });
  test("không nhiễu nào là bộ đúng dưới dạng khác (人 khi đáp án 亻)", () => {
    for (const q of deck("tv", "n5", "bo")) {
      const ans = q.answer.split(" · ")[1];
      for (const p of q.pool) assert.notEqual(p.split(" · ")[1], ans === "Nhân" ? undefined : ans, `${q.id}: ${p}`);
      assert.ok(!q.pool.some((p) => p.split(" · ")[0] === q.answer.split(" · ")[0]), q.id);
    }
  });
});

describe("bộ thủ (r-name, r-char)", () => {
  const radical = (slug: RadicalKindSlug) => buildRadicalDeck(src, slug);
  test("2 deck × 214 câu, checkDeck 0 lỗi", () => {
    for (const slug of Object.keys(RADICAL_KINDS) as RadicalKindSlug[]) {
      const { items, dropped } = radical(slug);
      assert.equal(items.length, 214);
      assert.equal(dropped.length, 0);
      assert.deepEqual(checkDeck(items), []);
      sizeOk(slug, items);
    }
  });
  test("phạm vi cộng dồn: N5 145, tới N4 165, tới N3 174 bộ", () => {
    const s = radicalScopes(src);
    const upTo = (n: number): number => [...s.values()].filter((x) => x <= n).length;
    assert.deepEqual([upTo(1), upTo(2), upTo(3)], [145, 165, 174]);
    const items = radical("ten").items;
    assert.equal(filterItems(items, { scope: { max: 1 } }).length, 145);
    assert.equal(filterItems(items, { scope: { max: 4 } }).length, 214);
  });
  test("2 bộ cùng tên (几 / 己 'Kỷ') không làm nhiễu của nhau; nghĩa kèm theo để phân biệt", () => {
    const items = radical("ten").items;
    for (const q of items) {
      const name = q.answer.split(" · ")[0]!.toLowerCase();
      for (const p of q.pool) assert.notEqual(p.split(" · ")[0]!.toLowerCase(), name, `${q.id}: ${p}`);
    }
    assert.equal(items.find((q) => q.prompt === "几")!.answer, "Kỷ · ghế tựa");
  });
  test("bộ không có chữ nào → link về nhóm số nét; có chữ → trang bộ", () => {
    const items = radical("ten").items;
    for (const q of items) assert.match(q.href, q.tags.scope === 4 ? /^kanji\/bo-thu\/#net-\d+$/ : /^kanji\/bo-thu\/\d+\/$/, q.id);
  });
});
