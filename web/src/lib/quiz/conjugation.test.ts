// Quiz chia thể (Q6) trên dữ liệu thật data/conjugation.json — câu sinh trên trình duyệt nên test chạy hàm sinh
// trên TOÀN BỘ dữ liệu + checkDeck (bảo đảm thay cho checkDeck lúc chạy, xem conjItems).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { gzipSync } from "node:zlib";
import { loadConjugation } from "../../test/data.ts";
import {
  CONJ_GROUPS,
  type ConjGroupId,
  type ConjOptions,
  type ConjTable,
  buildConjTable,
  conjItems,
  godan,
  ichidan,
  learnedForms,
  wrongForms,
} from "./conjugation.ts";
import type { QuizItem } from "./types.ts";
import { checkDeck, rubyForms } from "./validate.ts";

const data = loadConjugation();
const tables = Object.fromEntries(CONJ_GROUPS.map((g) => [g, buildConjTable(g, data.entries, data.forms)])) as Record<ConjGroupId, ConjTable>;
const ALL: ConjOptions["kinds"] = ["chia", "the", "nhom"];
const gen = (g: ConjGroupId, o: Partial<ConjOptions> = {}): QuizItem[] => conjItems(tables[g], { book: "minna", upTo: 50, kinds: ALL, ...o });
const both = (g: ConjGroupId, o: Partial<ConjOptions> = {}): QuizItem[] => [...gen(g, o), ...gen(g, { ...o, book: "n3", from: 1, to: 14 })];
const text = (s: string): string => rubyForms(s).text;
const reading = (s: string): string => rubyForms(s).reading;
const row = (g: ConjGroupId, kana: string) => tables[g].rows.find((r) => reading(r.base) === kana)!;
const item = (items: QuizItem[], id: string): QuizItem => {
  const q = items.find((x) => x.id === id);
  assert.ok(q, `không có câu ${id}`);
  return q;
};

describe("toàn bộ dữ liệu: 3 nhóm từ × 2 sách × 3 loại câu", () => {
  for (const g of CONJ_GROUPS) {
    test(`${g}: checkDeck 0 lỗi; bỏ < 1% ô; bảng gọn trong giới hạn`, () => {
      const items = both(g);
      assert.deepEqual(checkDeck(items).slice(0, 5), []);
      // mỗi ô (trừ ô làm đề) → 1 câu Chia + 1 câu Nhận thể
      const t = tables[g];
      let cells = 0;
      for (const r of t.rows) {
        // đề: động từ Minna = thể ます, N3 = thể từ điển; tính từ = nguyên dạng
        const base = g === "verb" ? (r.book === "n3" ? "dict" : "masu") : null;
        const prompt = base ? r.forms[base]![0] : r.base;
        for (const [id, [ruby]] of Object.entries(r.forms)) if (id !== base && text(ruby) !== text(prompt)) cells++;
      }
      for (const kind of ["c-to", "c-which"]) {
        const n = items.filter((x) => x.kind === kind).length;
        assert.ok(n >= cells * 0.99 && n <= cells, `${kind}: ${n}/${cells}`);
      }
      // Đo 2026-11-12: động từ 725KB gốc / 71KB gzip; tính từ ≤ 90KB / ≤ 10KB
      const json = JSON.stringify(t);
      assert.ok(Buffer.byteLength(json) < 900_000, `${Buffer.byteLength(json)} byte`);
      assert.ok(gzipSync(json).length < 90_000, `${gzipSync(json).length} byte gzip`);
    });
  }
  test("danh từ (2 từ mẫu) không vào quiz", () => {
    for (const g of CONJ_GROUPS) assert.ok(tables[g].rows.every((r) => r.kind !== "N"));
  });
});

describe("Q6-4: bộ chia sai (nhiễu)", () => {
  test("godan / ichidan cơ bản", () => {
    assert.equal(godan("{食|た}べる", "nai"), "{食|た}べらない");
    assert.equal(godan("{食|た}べる", "te"), "{食|た}べって");
    assert.equal(godan("{書|か}く", "te"), "{書|か}いて");
    assert.equal(ichidan("{書|か}き", "te"), "{書|か}きて");
    assert.equal(ichidan("し", "potential"), "しられる");
  });
  test("書きます → て: nhiễu có かって, かきて; không có đáp án かいて", () => {
    const q = item(gen("verb"), `c-to:${row("verb", "かきます").id}:te`);
    const pool = q.pool.map(reading);
    assert.ok(pool.includes("かって") && pool.includes("かきて"), pool.join(" "));
    assert.ok(!pool.includes("かいて"));
    assert.equal(reading(q.answer), "かいて");
  });
  test("行きます → て = いって (ngoại lệ): いいて là nhiễu", () => {
    const q = item(gen("verb"), `c-to:${row("verb", "いきます").id}:te`);
    assert.equal(reading(q.answer), "いって");
    assert.ok(q.pool.map(reading).includes("いいて"));
  });
  test("帰ります (I) ↔ 食べます (II): chia nhầm nhóm", () => {
    const items = gen("verb");
    const kaeru = item(items, `c-to:${row("verb", "かえります").id}:nai`);
    assert.equal(reading(kaeru.answer), "かえらない");
    assert.ok(kaeru.pool.map(reading).includes("かえりない"), kaeru.pool.join(" ")); // chia như nhóm II từ thân ます
    const taberu = item(items, `c-to:${row("verb", "たべます").id}:nai`);
    assert.ok(taberu.pool.map(reading).includes("たべらない"), taberu.pool.join(" "));
    assert.ok(item(items, `c-to:${row("verb", "たべます").id}:te`).pool.map(reading).includes("たべって"));
  });
  test("tính từ: いい → いくない; 長い → 長いでした; きれい → きれいくない, きれいなです", () => {
    const i = gen("adj-i");
    assert.ok(item(i, `c-to:${row("adj-i", "いい").id}:neg`).pool.map(reading).includes("いくない"));
    assert.ok(item(i, `c-to:${row("adj-i", "ながい").id}:past_polite`).pool.map(reading).includes("ながいでした"));
    const na = gen("adj-na");
    assert.ok(item(na, `c-to:${row("adj-na", "きれい").id}:neg`).pool.map(reading).includes("きれいくない"));
    assert.ok(item(na, `c-to:${row("adj-na", "きれい").id}:desu`).pool.map(reading).includes("きれいなです"));
  });
  test("wrongForms sinh cả dạng đúng (chưa lọc) — conjItems phải loại: 来ます → ない không có nhiễu 来ない", () => {
    const r = row("verb", "きます");
    assert.ok(wrongForms(r, "nai").some((w) => text(w) === text(r.forms.nai![0])), "wrongForms 来る phải có dạng trùng chữ 来ない");
    const q = item(gen("verb"), `c-to:${r.id}:nai`);
    assert.ok(!q.pool.some((p) => text(p) === "来ない"), q.pool.join(" "));
  });
  test("không nhiễu nào trùng chữ hiển thị với đáp án", () => {
    for (const g of CONJ_GROUPS) {
      for (const q of both(g).filter((x) => x.kind === "c-to")) {
        for (const p of q.pool) assert.notEqual(text(p), text(q.answer), q.id);
      }
    }
  });
  test("nhiễu bù cùng độ lịch sự: hỏi thể て không có しません / しました", () => {
    const q = item(gen("verb"), `c-to:${row("verb", "べんきょうします").id}:te`);
    for (const p of q.pool) assert.ok(!/ま(す|せん|した|しょう)/.test(reading(p)), p);
  });
});

describe("Q6-5: nhận thể", () => {
  test("154 từ có khả năng = bị động → mỗi chiều 154 câu có accepted", () => {
    const items = both("verb").filter((x) => x.kind === "c-which");
    const pot = items.filter((x) => x.id.endsWith(":potential") && x.accepted.includes("Thể bị động"));
    const pas = items.filter((x) => x.id.endsWith(":passive") && x.accepted.includes("Thể khả năng"));
    assert.equal(pot.length, 154);
    assert.equal(pas.length, 154);
    for (const q of [...pot, ...pas]) assert.ok(!q.pool.includes("Thể bị động") && !q.pool.includes("Thể khả năng"), q.id);
  });
  test("không hỏi thể ます (trùng đề); hỏi ません", () => {
    const items = gen("verb").filter((x) => x.kind === "c-which");
    assert.ok(!items.some((x) => x.id.endsWith(":masu")));
    assert.ok(items.some((x) => x.id.endsWith(":masen")));
  });
  test("nhiễu chỉ gồm thể đã học (đã học tới bài 20)", () => {
    const learned = new Set(learnedForms(tables.verb, { book: "minna", upTo: 20 }).map((f) => f.name));
    for (const q of gen("verb", { upTo: 20, kinds: ["the"] })) for (const p of q.pool) assert.ok(learned.has(p), `${q.id}: ${p}`);
  });
});

describe("Q6-3: nhóm động từ (3 lựa chọn)", () => {
  test("pool 2 mục; 1 câu mỗi động từ; ca dễ nhầm có giải thích", () => {
    const items = gen("verb", { kinds: ["nhom"] });
    assert.equal(items.length, tables.verb.rows.filter((r) => r.book === "minna").length);
    for (const q of items) assert.equal(q.pool.length, 2, q.id);
    assert.match(item(items, `c-group:${row("verb", "かえります").id}`).explain!, /trông như nhóm II/);
    assert.match(item(items, `c-group:${row("verb", "おきます").id}`).explain!, /ngoại lệ/);
  });
  test("chỉ có ở động từ", () => {
    assert.equal(gen("adj-i", { kinds: ["nhom"] }).length, 0);
  });
});

describe("Q6-2: bộ lọc", () => {
  test("đã học tới bài 15: thể ます…て (bài ≤ 15), từ bài ≤ 15", () => {
    assert.deepEqual(learnedForms(tables.verb, { book: "minna", upTo: 15 }).map((f) => f.id), ["masu", "masen", "mashita", "masendeshita", "mashou", "tai", "te"]);
    const lesson = new Map(tables.verb.rows.map((r) => [r.id, r.lesson]));
    for (const q of gen("verb", { upTo: 15 })) assert.ok(lesson.get(q.id.split(":")[1]!)! <= 15, q.id);
  });
  test("thể bị bắt làm (ngoài giáo trình) chỉ khi bài 50", () => {
    assert.ok(!learnedForms(tables.verb, { book: "minna", upTo: 49 }).some((f) => f.id === "causative_passive"));
    assert.ok(learnedForms(tables.verb, { book: "minna", upTo: 50 }).some((f) => f.id === "causative_passive"));
  });
  test("N3: bài từ–đến, mọi thể", () => {
    const items = conjItems(tables.verb, { book: "n3", from: 2, to: 3, kinds: ["chia"] });
    assert.ok(items.length > 0);
    for (const q of items) assert.ok(q.tags.book === "n3" && (q.tags.lesson as number) >= 2 && (q.tags.lesson as number) <= 3, q.id);
    assert.ok(items.some((q) => q.id.endsWith(":causative_passive")));
  });
  test("lọc nhóm động từ + thể", () => {
    const items = gen("verb", { verbKinds: ["V3"], forms: ["te", "nai"], kinds: ["chia"] });
    assert.ok(items.length > 50);
    for (const q of items) assert.ok(q.tags.group === "V3" && /:(te|nai)$/.test(q.id), q.id);
  });
  test("từ không có thể: わかります không có câu thể khả năng", () => {
    assert.ok(!gen("verb").some((q) => q.id === `c-to:${row("verb", "わかります").id}:potential`));
  });
  test("đề: Minna = thể ます, N3 = thể từ điển", () => {
    const mn = gen("verb", { kinds: ["chia"] })[0]!;
    assert.match(reading(mn.prompt), /ます$/);
    const n3 = conjItems(tables.verb, { book: "n3", kinds: ["chia"] })[0]!;
    assert.match(reading(n3.prompt), /[うくぐすつぬぶむる]$/);
  });
});
