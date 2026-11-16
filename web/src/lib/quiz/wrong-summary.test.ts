// Lối vào "Câu hay sai" ở trang chủ: gom câu sai theo trang quiz + link đúng bộ lọc.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { summarizeWrong, vocabLevelOfId } from "./wrong-summary.ts";
import { emptyStore, type WrongStore } from "./wrong.ts";

const store = (...ids: string[]): WrongStore => ({ ...emptyStore(), items: Object.fromEntries(ids.map((id) => [id, { w: 1, s: 0, t: 1 }])) });

describe("vocabLevelOfId", () => {
  test("Minna 1–25 = N5, 26–50 = N4, sách N3 = N3; câu điền từ theo ID câu ví dụ", () => {
    assert.equal(vocabLevelOfId("v-mean:mn-25-010"), "n5");
    assert.equal(vocabLevelOfId("v-read:mn-26-001"), "n4");
    assert.equal(vocabLevelOfId("v-cloze:mn-41-039-e1"), "n4");
    assert.equal(vocabLevelOfId("v-hv:n3-101"), "n3");
    assert.equal(vocabLevelOfId("v-mean:xx-1"), null);
  });
});

describe("summarizeWrong", () => {
  test("rỗng → không nhóm nào", () => {
    assert.deepEqual(summarizeWrong(emptyStore()), []);
  });

  test("từ vựng tách theo cấp, loai theo thứ tự trang (không theo thứ tự gặp)", () => {
    const g = summarizeWrong(store("v-cloze:mn-03-001-e1", "v-mean:mn-04-002", "v-read:mn-30-001", "v-mean:n3-005"));
    assert.deepEqual(g, [
      { label: "Từ vựng N5", href: "vocabulary/quiz/?cap=n5&loai=nghia,dien&on=sai", count: 2 },
      { label: "Từ vựng N4", href: "vocabulary/quiz/?cap=n4&loai=doc&on=sai", count: 1 },
      { label: "Từ vựng N3", href: "vocabulary/quiz/?cap=n3&loai=nghia&on=sai", count: 1 },
    ]);
  });

  test("Kanji (gồm r-of), Bộ thủ, Chia thể, Đếm số, Số đếm — đúng trang và tham số", () => {
    const g = summarizeWrong(
      store("n-num:ten-10", "c-to:mn-05-001:te", "r-name:30", "r-of:k-問", "k-hv:k-学", "n-ctr:c-hon-3", "c-group:mn-05-001", "k-read:k-大:大学"),
    );
    assert.deepEqual(g, [
      { label: "Kanji", href: "kanji/quiz/?loai=hv,doc,bo&on=sai", count: 3 },
      { label: "Bộ thủ", href: "kanji/bo-thu/quiz/?loai=ten&on=sai", count: 1 },
      { label: "Chia thể", href: "chia-the/quiz/?loai=chia,nhom&on=sai", count: 2 },
      { label: "Đếm số", href: "dem-so/quiz/?o=tat-ca&on=sai", count: 1 },
      { label: "Số đếm", href: "dem-so/quiz/?loai=so&on=sai", count: 1 },
    ]);
  });

  test("loại câu lạ / ID từ vựng không nhận ra → bỏ qua", () => {
    assert.deepEqual(summarizeWrong(store("x-foo:1", "v-mean:abc")), []);
  });
});
