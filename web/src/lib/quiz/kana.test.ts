import assert from "node:assert/strict";
import { test } from "node:test";
import { misreadings } from "./kana.ts";

test("せんせい: có bỏ trường âm (せんせ) và các loại lỗi khác", () => {
  const m = misreadings("せんせい");
  assert.ok(m.includes("せんせ"), m.join(","));
  assert.ok(m.length >= 3);
});

test("がっこう: bỏ っ (がこう), bỏ trường âm (がっこ)", () => {
  const m = misreadings("がっこう", [], 20);
  assert.ok(m.includes("がこう"));
  assert.ok(m.includes("がっこ"));
});

test("きょう: きよう (âm nhỏ thành to), きょ (bỏ trường âm)", () => {
  const m = misreadings("きょう", [], 20);
  assert.ok(m.includes("きよう"));
  assert.ok(m.includes("きょ"));
});

test("じしょ: thêm っ (じっしょ), đổi đục (ししょ)", () => {
  const m = misreadings("じしょ", [], 20);
  assert.ok(m.includes("じっしょ"));
  assert.ok(m.includes("ししょ"));
});

test("không bao giờ trả lại chính đáp án hoặc cách đọc hợp lệ", () => {
  // 家: うち / いえ đều đúng; 一日: いちにち / ついたち
  for (const [r, valid] of [
    ["いちにち", ["ついたち"]],
    ["びょういん", []],
    ["せんせい", ["せんせい"]],
  ] as const) {
    const m = misreadings(r, valid, 50);
    assert.ok(!m.includes(r));
    for (const v of valid) assert.ok(!m.includes(v));
  }
});

test("không trùng lặp; dạng sai đúng chữ viết (không mở đầu bằng chữ nhỏ/ん, không kết thúc っ)", () => {
  for (const r of ["しゅっぱつ", "りょこう", "きって", "ほんとう", "いっしょ"]) {
    const m = misreadings(r, [], 50);
    assert.equal(new Set(m).size, m.length, r);
    for (const x of m) assert.ok(!/^[ゃゅょっん]/.test(x) && !x.endsWith("っ"), `${r} → ${x}`);
  }
});

test("xen kẽ loại lỗi: 3 dạng đầu không cùng một loại", () => {
  // がっこう: bỏ trường âm, bỏ っ, đổi đục (không thêm trường âm được: こ đã có う)
  assert.deepEqual(misreadings("がっこう").slice(0, 3), ["がっこ", "がこう", "かっこう"]);
});

test("thêm trường âm kiểu おばさん → おばあさん, おじさん → おじいさん", () => {
  assert.ok(misreadings("おばさん", [], 20).includes("おばあさん"));
  assert.ok(misreadings("おじさん", [], 20).includes("おじいさん"));
});

test("không sinh dạng vô lý: không động vào đuôi ます, không thêm trường âm ở âm cuối / trước ん", () => {
  for (const [r, bad] of [
    ["たべます", ["たべまっす", "たべまず", "たべますう"]],
    ["いえ", ["いえい"]],
    ["せんせい", ["せいんせい"]],
    ["がっこう", ["がっこうう"]],
    ["よせる", ["よせいる"]],
    ["いじょうです。", ["いじょうでいす。", "いじょうですう。", "いじょうでっす。"]],
  ] as const) {
    const m = misreadings(r, [], 50);
    for (const b of bad) assert.ok(!m.includes(b), `${r} → ${b}`);
  }
  assert.ok(misreadings("たべます", [], 50).every((x) => x.endsWith("ます")));
});

test("giữ tiền tố ～", () => {
  const m = misreadings("～じん");
  assert.ok(m.length > 0);
  assert.ok(m.every((x) => x.startsWith("～")));
  assert.ok(m.includes("～しん"));
});

test("max giới hạn số kết quả; chữ quá ngắn vẫn không lỗi", () => {
  assert.ok(misreadings("せんせい", [], 2).length <= 2);
  assert.ok(Array.isArray(misreadings("め")));
});
