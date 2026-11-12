import assert from "node:assert/strict";
import { test } from "node:test";
import { type ParamDef, readFilter, writeFilter } from "./params.ts";

const DEFS: ParamDef[] = [
  { param: "cap", tag: "level", type: "enum", options: { n5: "n5", n4: "n4", n3: "n3" } },
  { param: "tu", tag: "lesson", type: "min", lo: 1, hi: 50 },
  { param: "den", tag: "lesson", type: "max", lo: 1, hi: 50 },
  { param: "loai", tag: "kind", type: "enum", options: { doc: "v-read", nghia: "v-mean", hv: "v-hv" }, multi: true },
];

test("đọc đủ tham số", () => {
  assert.deepEqual(readFilter("cap=n5&tu=1&den=10&loai=doc,nghia", DEFS), {
    level: ["n5"],
    lesson: { min: 1, max: 10 },
    kind: ["v-read", "v-mean"],
  });
});

test("ghi rồi đọc lại ra đúng bộ lọc cũ", () => {
  const f = { level: ["n4"], lesson: { min: 26, max: 30 }, kind: ["v-hv", "v-read"] };
  const qs = writeFilter(f, DEFS);
  assert.equal(qs, "cap=n4&tu=26&den=30&loai=doc,hv");
  assert.deepEqual(readFilter(qs, DEFS), { level: ["n4"], lesson: { min: 26, max: 30 }, kind: ["v-read", "v-hv"] });
});

test("giá trị sai bị bỏ qua, không lỗi", () => {
  assert.deepEqual(readFilter("cap=n9&tu=abc&den=99&loai=xx", DEFS), {});
  assert.deepEqual(readFilter("tu=-1&den=1.5", DEFS), {});
  assert.deepEqual(readFilter("loai=doc,xx,doc", DEFS), { kind: ["v-read"] });
  assert.deepEqual(readFilter("", DEFS), {});
});

test("tu > den → đổi chỗ; chỉ một đầu → khoảng hở", () => {
  assert.deepEqual(readFilter("tu=20&den=5", DEFS), { lesson: { min: 5, max: 20 } });
  assert.deepEqual(readFilter("den=5", DEFS), { lesson: { max: 5 } });
});

test("enum không multi chỉ lấy 1 giá trị khi ghi", () => {
  assert.equal(writeFilter({ level: ["n5", "n4"] }, DEFS), "cap=n5");
});

test("nhận URLSearchParams", () => {
  assert.deepEqual(readFilter(new URLSearchParams({ cap: "n3" }), DEFS), { level: ["n3"] });
});
