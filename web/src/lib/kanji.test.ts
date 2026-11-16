import { test } from "node:test";
import assert from "node:assert/strict";
import { kunReadings } from "./kanji.ts";

test("kunReadings: gộp cách cắt okurigana trùng, '-' → '～'", () => {
  assert.deepEqual(
    kunReadings(["か.わる", "かわ.る", "かわ.り", "か.わり", "-がわ.り", "-が.わり", "か.える", "よ", "しろ"]),
    ["か(わる)", "か(わり)", "～が(わり)", "か(える)", "よ", "しろ"],
  );
  assert.deepEqual(kunReadings(["たか.い", "たか", "-だか", "たか.まる"]), ["たか(い)", "たか", "～だか", "たか(まる)"]);
  assert.deepEqual(kunReadings(["うえ", "かみ-"]), ["うえ", "かみ～"]);
});
