import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTranslation } from "../test/data.ts";
import { parseRuby } from "./ruby.ts";
import { DEFAULT_DIRECTION, PASSAGE_LEVELS, parseDirection, passagePath } from "./translation.ts";

test("parseDirection: giá trị hợp lệ giữ nguyên, lạ/thiếu → mặc định", () => {
  assert.equal(parseDirection("vi-ja"), "vi-ja");
  assert.equal(parseDirection("ja-vi"), "ja-vi");
  assert.equal(parseDirection(null), DEFAULT_DIRECTION);
  assert.equal(parseDirection("en-ja"), DEFAULT_DIRECTION);
});

test("đường dẫn đoạn văn", () => {
  assert.equal(passagePath("p-n5-001"), "dich/doan/p-n5-001/");
});

test("đoạn văn (dữ liệu thật): ruby web parse khớp ja_text của pipeline, para hợp lệ, cấp nằm trong danh sách", () => {
  const { passages } = loadTranslation();
  for (const p of passages) {
    assert.ok(PASSAGE_LEVELS.includes(p.level), p.id);
    assert.ok(p.id.startsWith(`p-${p.level}-`), p.id);
    assert.ok(p.sentences.length >= 3, p.id);
    let para = 1;
    for (const [i, s] of p.sentences.entries()) {
      const segs = parseRuby(s.ja);
      assert.equal(segs.map((x) => x.text).join(""), s.ja_text, `${p.id} câu ${i + 1}`);
      assert.ok(segs.every((x) => !x.target), `${p.id} câu ${i + 1}: không được có [[…]]`);
      assert.ok(s.para === para || s.para === para + 1, `${p.id} câu ${i + 1}: para ${s.para}`);
      para = s.para;
    }
    assert.ok(parseRuby(p.title_ja).length > 0, p.id);
  }
});
