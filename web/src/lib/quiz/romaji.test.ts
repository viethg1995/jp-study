// Bộ chuyển romaji → kana (Q9, plan/quiz/q09-kana-input.md).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { hasLatin, toKana } from "./romaji.ts";

const eq = (input: string, want: string, final = true): void => assert.equal(toKana(input, final), want, input);

describe("romaji → kana", () => {
  test("âm cơ bản", () => {
    eq("aiueo", "あいうえお");
    eq("gakusei", "がくせい");
    eq("sensei", "せんせい");
    eq("watashiha", "わたしは");
    eq("wo", "を");
  });

  test("biến thể Hepburn / Kunrei: shi/si, chi/ti, tsu/tu, fu/hu, ji/zi", () => {
    for (const [a, b] of [["shi", "si"], ["chi", "ti"], ["tsu", "tu"], ["fu", "hu"], ["ji", "zi"]]) assert.equal(toKana(a!, true), toKana(b!, true), `${a}/${b}`);
    eq("shichi", "しち");
    eq("tsukue", "つくえ");
  });

  test("âm ghép: kya, sha/sya, cha/tya/cya, ja/jya/zya, ryo, nyu, di/du", () => {
    eq("kyou", "きょう");
    eq("shashin", "しゃしん");
    eq("syasin", "しゃしん");
    for (const x of ["cha", "tya", "cya"]) eq(x, "ちゃ");
    for (const x of ["ja", "jya", "zya"]) eq(x, "じゃ");
    eq("ryokou", "りょこう");
    eq("gyuunyuu", "ぎゅうにゅう");
    eq("hanadi", "はなぢ");
    eq("tsuduku", "つづく");
  });

  test("っ: phụ âm đôi, tch", () => {
    eq("kitte", "きって");
    eq("zasshi", "ざっし");
    eq("roppyaku", "ろっぴゃく");
    eq("matcha", "まっちゃ");
    eq("macchya", "まっちゃ");
    eq("gakkou", "がっこう");
  });

  test("ん: nn, n', n trước phụ âm, n cuối", () => {
    eq("konnichiha", "こんにちは");
    eq("konnnichiha", "こんにちは");
    eq("kan'i", "かんい");
    eq("kanni", "かんに");
    eq("sanpo", "さんぽ");
    eq("hon", "ほん");
    eq("honn", "ほん");
    eq("hon'ya", "ほんや");
    eq("konya", "こにゃ"); // không có ' → にゃ (như IME)
    eq("sanbyaku", "さんびゃく");
    eq("kinyoubi", "きにょうび");
  });

  test("đang gõ: n cuối và phần dở dang giữ nguyên", () => {
    eq("hon", "ほn", false);
    eq("ky", "ky", false);
    eq("gakush", "がくsh", false);
    eq("sa", "さ", false);
    assert.equal(hasLatin(toKana("gakush", false)), true);
    assert.equal(hasLatin(toKana("gakusei", false)), false);
  });

  test("âm nhỏ, trường âm, chữ hoa, kana gõ thẳng", () => {
    eq("xtu", "っ");
    eq("ltu", "っ");
    eq("la", "ぁ");
    eq("pa-sento", "ぱーせんと");
    eq("GAKUSEI", "がくせい");
    eq("がくせい", "がくせい");
    eq("がくsei", "がくせい");
    eq("faito", "ふぁいと");
  });

  test("ký tự lạ giữ nguyên (chấm sẽ sai)", () => {
    eq("q", "q");
    eq("3", "3");
  });
});
