import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createQueue, filterItems, isCorrect, makeOptions, NEAR, normalize } from "./core.ts";
import { mulberry32 } from "./random.ts";
import type { QuizItem } from "./types.ts";

function item(id: string, tags: QuizItem["tags"] = {}, kind = "t"): QuizItem {
  return { id, kind, prompt: id, promptLang: "ja", hint: null, answer: "A", accepted: [], pool: [], explain: null, href: "", tags };
}

describe("makeOptions", () => {
  const q = { answer: "ok", pool: ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9"] };

  test("4 lựa chọn khác nhau, đúng 1 đáp án đúng ở vị trí correct", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 200; i++) {
      const { options, correct } = makeOptions(q, rng);
      assert.equal(options.length, 4);
      assert.equal(new Set(options).size, 4);
      assert.equal(options.filter((o) => o === "ok").length, 1);
      assert.equal(options[correct], "ok");
    }
  });

  test(`nhiễu chỉ lấy từ ${NEAR} mục đầu pool, và có dùng đủ cả ${NEAR} mục`, () => {
    const rng = mulberry32(2);
    const used = new Set<string>();
    for (let i = 0; i < 300; i++) for (const o of makeOptions(q, rng).options) if (o !== "ok") used.add(o);
    assert.deepEqual([...used].sort(), q.pool.slice(0, NEAR).sort());
  });

  test("vị trí đáp án đúng phân bố đều (1.000 lần, mỗi vị trí 20–30%)", () => {
    const rng = mulberry32(3);
    const pos = [0, 0, 0, 0];
    for (let i = 0; i < 1000; i++) pos[makeOptions(q, rng).correct]!++;
    for (const n of pos) assert.ok(n >= 200 && n <= 300, `lệch: ${pos}`);
  });

  test("pool ít hơn 3 → ít lựa chọn hơn, không lỗi", () => {
    const { options } = makeOptions({ answer: "ok", pool: ["x"] }, mulberry32(4));
    assert.deepEqual([...options].sort(), ["ok", "x"]);
  });
});

describe("normalize / isCorrect", () => {
  test("katakana = hiragana, bỏ khoảng trắng (cả toàn khoảng), NFKC", () => {
    assert.equal(normalize("テレビ"), "てれび");
    assert.equal(normalize(" か　き "), "かき");
    assert.equal(normalize("ﾃﾚﾋﾞ"), "てれび");
    assert.equal(normalize("ＡＢ"), "ab");
    assert.equal(normalize("コーヒー"), "こーひー");
  });

  test("nhận answer và accepted, từ chối cái khác", () => {
    const q = { answer: "はっぽん", accepted: ["はちほん"] };
    assert.ok(isCorrect(q, "はっぽん"));
    assert.ok(isCorrect(q, "ハチホン"));
    assert.ok(!isCorrect(q, "はちぽん"));
  });
});

describe("filterItems", () => {
  const items = [
    item("a", { level: "n5", lesson: 1 }, "v-read"),
    item("b", { level: "n5", lesson: 10 }, "v-mean"),
    item("c", { level: "n4", lesson: 30 }, "v-read"),
    item("d", { level: "n5" }, "v-read"), // thiếu lesson
  ];
  const ids = (f: Parameters<typeof filterItems>[1]): string[] => filterItems(items, f).map((x) => x.id);

  test("filter rỗng → giữ hết", () => assert.deepEqual(ids({}), ["a", "b", "c", "d"]));
  test("danh sách giá trị", () => assert.deepEqual(ids({ level: ["n5"] }), ["a", "b", "d"]));
  test("khóa kind lọc theo QuizItem.kind", () => assert.deepEqual(ids({ kind: ["v-read"] }), ["a", "c", "d"]));
  test("khoảng số đóng hai đầu; thiếu tag → loại", () => {
    assert.deepEqual(ids({ lesson: { min: 1, max: 10 } }), ["a", "b"]);
    assert.deepEqual(ids({ lesson: { max: 5 } }), ["a"]);
  });
  test("kết hợp nhiều luật (AND)", () => {
    assert.deepEqual(ids({ kind: ["v-read"], level: ["n5"], lesson: { min: 1 } }), ["a"]);
  });
  test("khoảng số với giá trị chuỗi → không khớp", () => {
    assert.deepEqual(ids({ level: { min: 1 } }), []);
  });
});

describe("createQueue", () => {
  const deck = ["a", "b", "c", "d", "e"].map((id) => item(id));

  test("một vòng hỏi đủ mọi câu, không lặp", () => {
    const q = createQueue(deck, mulberry32(5));
    const got = Array.from({ length: 5 }, () => q.next()!.id);
    assert.deepEqual([...got].sort(), ["a", "b", "c", "d", "e"]);
    assert.equal(q.asked, 5);
  });

  test("qua nhiều vòng không bao giờ hỏi 2 câu giống nhau liền nhau", () => {
    for (let seed = 0; seed < 50; seed++) {
      const q = createQueue(deck.slice(0, 2), mulberry32(seed));
      let prev = "";
      for (let i = 0; i < 20; i++) {
        const id = q.next()!.id;
        assert.notEqual(id, prev, `seed ${seed} câu ${i}`);
        prev = id;
      }
    }
  });

  test("limit dừng đúng số câu", () => {
    const q = createQueue(deck, mulberry32(6), 3);
    assert.ok(q.next() && q.next() && q.next());
    assert.equal(q.next(), null);
    assert.equal(q.asked, 3);
  });

  test("limit lớn hơn deck → sang vòng mới", () => {
    const q = createQueue(deck, mulberry32(7), 12);
    const got = Array.from({ length: 12 }, () => q.next());
    assert.ok(got.every((x) => x !== null));
    assert.equal(q.next(), null);
  });

  test("deck rỗng → null; deck 1 câu → hỏi lại câu đó", () => {
    assert.equal(createQueue([], mulberry32(8)).next(), null);
    const one = createQueue([item("x")], mulberry32(8));
    assert.equal(one.next()!.id, "x");
    assert.equal(one.next()!.id, "x");
  });
});
