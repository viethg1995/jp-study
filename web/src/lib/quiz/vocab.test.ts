// Quiz từ vựng (Q4) trên dữ liệu thật data/vocabulary — bất biến + trường hợp đã biết.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { gzipSync } from "node:zlib";
import { loadVocab } from "../../test/data.ts";
import { filterItems } from "./core.ts";
import { misreadings } from "./kana.ts";
import type { QuizItem } from "./types.ts";
import { checkDeck } from "./validate.ts";
import { VOCAB_KINDS, VOCAB_LEVELS, type VocabKindSlug, type VocabLevel, buildVocabDeck, cleanMeaning, levelOf, meaningKeys } from "./vocab.ts";

const all = loadVocab();
const decks = new Map<string, ReturnType<typeof buildVocabDeck>>();
const deck = (level: VocabLevel, slug: VocabKindSlug): QuizItem[] => {
  const k = `${level}-${slug}`;
  if (!decks.has(k)) decks.set(k, buildVocabDeck(all, level, slug));
  return decks.get(k)!.items;
};
const SLUGS = Object.keys(VOCAB_KINDS) as VocabKindSlug[];
const JA = /[\u3040-\u30ff\u3400-\u9fff]/u;

describe("15 deck (cấp × loại câu)", () => {
  for (const level of VOCAB_LEVELS) {
    for (const slug of SLUGS) {
      test(`${level}-${slug}: checkDeck 0 lỗi, bỏ < 2% câu, kích thước trong giới hạn`, () => {
        const items = deck(level, slug);
        const { dropped } = decks.get(`${level}-${slug}`)!;
        assert.ok(items.length > 300, `chỉ ${items.length} câu`);
        assert.deepEqual(checkDeck(items).slice(0, 5), []);
        assert.ok(dropped.length / (items.length + dropped.length) < 0.02, `bỏ ${dropped.length} câu`);
        assert.ok(items.every((q) => q.kind === VOCAB_KINDS[slug] && q.tags.level === level));
        // Giới hạn đo 2026-11-12: lớn nhất ~400KB gốc / ~47KB gzip (dung lượng thực tải về)
        const json = JSON.stringify({ version: 1, name: `${level}-${slug}`, items });
        assert.ok(Buffer.byteLength(json) < 450_000, `${Buffer.byteLength(json)} byte`);
        assert.ok(gzipSync(json).length < 60_000, `${gzipSync(json).length} byte gzip`);
      });
    }
  }
});

describe("v-read (đọc)", () => {
  test("chỉ từ hiển thị bằng kanji; prompt không có furigana", () => {
    const kanjiWords = new Set(all.filter((e) => e.kanji && e.display === "kanji").map((e) => e.kanji));
    for (const q of deck("n5", "doc")) {
      assert.ok(kanjiWords.has(q.prompt), q.id);
      assert.ok(!q.prompt.includes("{"), q.id);
    }
  });

  test("Q4-3: đủ 3 dạng máy sinh thì cả pool là dạng máy sinh", () => {
    let full = 0;
    for (const level of VOCAB_LEVELS) {
      for (const q of deck(level, "doc")) {
        const machine = misreadings(q.answer, [q.answer, ...q.accepted], 6);
        if (machine.length >= 3) {
          full++;
          assert.deepEqual(q.pool, machine, q.id);
        } else assert.equal(q.pool.length, 3, q.id); // bù bằng cách đọc từ thật cho đủ 3
      }
    }
    // Đo 2026-11-12: 942/1.604 câu đủ 3 dạng máy sinh; còn lại là từ ngắn / toàn âm n, m, r, y, w (なに, いま, でんわ)
    // → bù cách đọc từ thật. Mốc 900 để bắt hồi quy khi sửa kana.ts.
    assert.ok(full >= 900, `chỉ ${full} câu có đủ 3 dạng máy sinh`);
  });

  test("降ります: nhận cả ふります và おります, gợi ý hiện nghĩa, không cách đọc nào làm nhiễu", () => {
    const qs = deck("n5", "doc").filter((q) => q.prompt === "降ります");
    assert.equal(qs.length, 2);
    for (const q of qs) {
      assert.deepEqual([q.answer, ...q.accepted].sort(), ["おります", "ふります"]);
      assert.match(q.hint ?? "", /nghĩa:/);
      assert.ok(!q.pool.includes("おります") && !q.pool.includes("ふります"));
    }
  });

  test("từ lặp ở nhiều bài chỉ còn 1 câu, mang đủ danh sách bài; lọc bài nào cũng gặp", () => {
    const q = deck("n5", "doc").filter((x) => x.prompt === "出ます");
    assert.equal(q.length, 1);
    const lessons = q[0]!.tags.lesson as number[];
    assert.ok(lessons.length > 1, String(lessons));
    for (const n of lessons) assert.equal(filterItems(q, { lesson: { min: n, max: n } }).length, 1);
  });
});

describe("v-mean / v-word (nghĩa)", () => {
  test("nhiễu không trùng ý nghĩa với đáp án (vd 道 'đường' không có 砂糖 'đường')", () => {
    for (const level of VOCAB_LEVELS) {
      for (const q of deck(level, "nghia")) {
        const keys = meaningKeys(q.answer);
        for (const p of q.pool) assert.ok(![...meaningKeys(p)].some((k) => keys.has(k)), `${q.id}: ${q.answer} ~ ${p}`);
      }
    }
  });

  test("v-word: câu hỏi không có chữ Nhật (đã bỏ '(ví dụ: …)'), không lộ đáp án", () => {
    for (const level of VOCAB_LEVELS) for (const q of deck(level, "tu")) assert.ok(!JA.test(q.prompt), `${q.id}: ${q.prompt}`);
  });

  test("v-word: 'Cũng đúng' chỉ gồm từ nghĩa trùng hoàn toàn (đường: 砂糖 ↔ 道), không lẫn イギリス vào 'anh/ chị'", () => {
    const sugar = deck("n5", "tu").find((q) => q.answer === "{砂糖|さとう}")!;
    assert.deepEqual(sugar.accepted, ["{道|みち}"]);
    const anata = deck("n5", "tu").find((q) => q.id === "v-word:mn-01-002")!;
    assert.ok(!anata.accepted.includes("イギリス"), anata.accepted.join(","));
  });

  test("cleanMeaning bỏ ngoặc chứa chữ Nhật, giữ ngoặc tiếng Việt", () => {
    assert.equal(cleanMeaning("người (nước) ～ (ví dụ: アメリカじん là người Mỹ)"), "người (nước) ～");
    assert.equal(cleanMeaning("hút [thuốc lá]"), "hút [thuốc lá]");
  });

  test("nhiễu cùng chủ đề (từ đứng gần trong bài): お兄さん → người trong gia đình, không phải ひとつ…とお", () => {
    const q = deck("n5", "nghia").find((x) => x.id.includes("mn-11-033"))!;
    assert.ok(q, "thiếu câu お兄さん");
    const near = q.pool.slice(0, 6); // = NEAR: makeOptions chỉ bốc trong 6 mục đầu
    assert.ok(near.every((p) => !/\bcái\b/.test(p)), near.join(" / "));
    assert.ok(near.filter((p) => /chị|em|bố|mẹ/.test(p)).length >= 3, near.join(" / "));
  });
});

describe("v-hv (Hán-Việt)", () => {
  test("学生 → HỌC SINH, nhiễu ưu tiên từ có chung chữ (先生, 大学…)", () => {
    const q = deck("n5", "hv").find((x) => x.prompt === "学生")!;
    assert.equal(q.answer, "HỌC SINH");
    assert.ok(q.pool.slice(0, 3).every((p) => /HỌC|SINH/.test(p)), q.pool.join(","));
  });
});

describe("v-cloze (điền từ)", () => {
  test("Q4-2: chỉ câu có từ đích giữ nguyên dạng; câu hỏi có chỗ trống, gợi ý là câu dịch", () => {
    const byId = new Map(all.flatMap((e) => e.examples.map((x) => [x.id, x] as const)));
    for (const level of VOCAB_LEVELS) {
      for (const q of deck(level, "dien")) {
        assert.ok(q.prompt.includes("＿＿＿") && !q.prompt.includes("[["), q.id);
        const ex = byId.get(q.id.replace("v-cloze:", ""))!;
        assert.equal(q.hint, ex.vi);
      }
    }
  });

  test("không có danh từ riêng (câu dịch giữ tên → lộ đáp án: 新神戸 / 'ga Shin-Kobe')", () => {
    for (const level of VOCAB_LEVELS) assert.ok(deck(level, "dien").every((q) => q.tags.pos !== "PN"), level);
  });

  test("động từ đã chia (行きました) không vào deck", () => {
    const verbsInflected = all.filter((e) => /^V/.test(e.pos.code) && levelOf(e) === "n5").flatMap((e) => e.examples.filter((x) => /\[\[.*(ました|ません|て|た)\]\]/.test(x.ruby)).map((x) => x.id));
    const ids = new Set(deck("n5", "dien").map((q) => q.id.replace("v-cloze:", "")));
    assert.ok(verbsInflected.length > 0);
    assert.ok(verbsInflected.every((id) => !ids.has(id)));
  });
});
