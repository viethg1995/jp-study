// Quiz từ vựng (Q4) trên dữ liệu thật data/vocabulary — bất biến + trường hợp đã biết.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { loadConjugation, loadVocab } from "../../test/data.ts";
import { parseRuby } from "../ruby.ts";
import { buildConjTable, CONJ_GROUPS, type ConjRow } from "./conjugation.ts";
import { filterItems } from "./core.ts";
import { misreadings } from "./kana.ts";
import type { QuizItem } from "./types.ts";
import { checkDeck, rubyForms } from "./validate.ts";
import { VOCAB_KINDS, VOCAB_LEVELS, type VocabKindSlug, type VocabLevel, buildVocabDeck, cleanMeaning, levelOf, meaningKeys } from "./vocab.ts";

const all = loadVocab();
const conjData = loadConjugation();
const conj = CONJ_GROUPS.map((g) => buildConjTable(g, conjData.entries, conjData.forms));
const decks = new Map<string, ReturnType<typeof buildVocabDeck>>();
const deck = (level: VocabLevel, slug: VocabKindSlug): QuizItem[] => {
  const k = `${level}-${slug}`;
  if (!decks.has(k)) decks.set(k, buildVocabDeck(all, level, slug, conj));
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
        // dung lượng: mốc mỗi chunk (Q12) ở chunks.test.ts — file tải về là chunk, không phải cả cấp
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

  // Q4b: từ đích đã chia (plan/quiz/q04b-cloze-inflected.md)
  const text = (r: string): string => parseRuby(r).map((x) => x.text).join("");
  const rowById = new Map<string, ConjRow>(conj.flatMap((t) => t.rows.map((r) => [r.id, r] as const)));
  const inflected = (level: VocabLevel): QuizItem[] => deck(level, "dien").filter((q) => q.explain?.includes(" = "));

  test("Q4b: có câu từ đích đã chia mỗi cấp; số câu bỏ qua không tăng (mốc đo 2026-11-16)", () => {
    const min = { n5: 95, n4: 185, n3: 215 }; // đo 2026-11-17: 97 · 191 · 220
    for (const level of VOCAB_LEVELS) assert.ok(inflected(level).length >= min[level], `${level}: ${inflected(level).length}`);
    // câu có [[…]] đã biến đổi (không phải danh từ riêng) nhưng không vào deck — tồn đọng dữ liệu ở README "Lỗi dữ liệu"
    let skipped = 0;
    for (const level of VOCAB_LEVELS) {
      const ids = new Set(deck(level, "dien").map((q) => q.id.replace("v-cloze:", "")));
      for (const e of all.filter((x) => levelOf(x) === level && x.pos.code !== "PN"))
        for (const x of e.examples) if (/\[\[/.test(x.ruby) && !ids.has(x.id)) skipped++;
    }
    assert.ok(skipped <= 13, `bỏ qua ${skipped} câu`); // đo 2026-11-17: 12 (148 → aliases N3: 96 → cách đọc: 66 → phái sinh: 26 → lộ đáp án theo chữ + nhiều cách viết: 15 → chữ trong từ ghép không tính lộ: 12 "không hỏi": mẫu câu, や, 買い物, phó từ N3 ～なる)
  });

  test("Q4b: từ N3 trùng Minna (aliases bảng chia) có câu điền từ; alias không thắng same_word", () => {
    const ids = new Set(deck("n3", "dien").map((q) => q.id));
    for (const id of ["n3-101-e1", "n3-108-e1", "n3-117-e1", "n3-333-e1"]) assert.ok(ids.has(`v-cloze:${id}`), id);
    // mn-22-004 掛けます (đeo kính) là alias của かけます (gọi điện) — phải tra hàng 掛けます qua same_word
    assert.ok(deck("n5", "dien").some((q) => q.id === "v-cloze:mn-22-004-e1"));
  });

  test("Q4b: từ display kana / khác chữ cùng âm khớp theo cách đọc; dạng chia sai viết theo chữ của câu", () => {
    const q = (level: VocabLevel, id: string): QuizItem => {
      const it = deck(level, "dien").find((x) => x.id === `v-cloze:${id}`);
      assert.ok(it, id);
      return it;
    };
    // 点けて (bảng chia: つけます) — dạng sai つけって phải thành {点|つ}けって, không còn kana trần lộ đáp án
    const tsukete = q("n5", "mn-14-001-e1");
    assert.equal(tsukete.answer, "{点|つ}けて");
    assert.ok(tsukete.pool.includes("{点|つ}けって"), tsukete.pool.join(" "));
    assert.ok(!tsukete.pool.some((p) => /^つけ/.test(p)), tsukete.pool.join(" "));
    q("n4", "mn-26-001-e1"); // 診て ↔ hàng 見ます
    q("n4", "mn-40-002-e1"); // 量って ↔ hàng 測ります
    // 連れて来ます / 帰って来ます: nhóm III (_decisions/15-conjugation-pos.txt), không còn dạng V1 sai
    q("n5", "mn-24-004-e1");
    const all5 = deck("n5", "dien").concat(deck("n4", "dien"));
    assert.ok(!all5.some((x) => x.pool.some((p) => /(つれて|かえって|もって)(く|いて|かない)$/.test(rubyForms(p).reading))));
    // 悪くないです: ～くありません là dạng đúng → không được làm nhiễu
    const warui = q("n5", "mn-08-016-e1");
    assert.ok(!warui.pool.some((p) => rubyForms(p).reading.endsWith("くありません")), warui.pool.join(" "));
  });

  test("Q4b bước 2.1: thể phái sinh — bị động/sai khiến + ます, なければなりません, なくても, thân ます / gốc tính từ", () => {
    const q = (level: VocabLevel, id: string): QuizItem => {
      const it = deck(level, "dien").find((x) => x.id === `v-cloze:${id}`);
      assert.ok(it, id);
      return it;
    };
    const cases: [VocabLevel, string, string, string][] = [
      ["n4", "mn-37-001-e1", "褒められました", "Thể bị động → ました"],
      ["n4", "mn-48-004-e1", "録音させて", "Thể sai khiến → て"],
      ["n5", "mn-17-004-e1", "払わなければなりません", "Thể ない → なければなりません"],
      ["n5", "mn-17-006-e1", "出かけなくても", "Thể ない → なくても"],
      ["n5", "mn-25-004-e1", "足りなかったら", "Quá khứ phủ định thể thường + ら"], // 足ります sửa V1 → V2
      ["n4", "mn-43-005-e1", "切れ", "Thân ます"],
      ["n4", "mn-43-015-e1", "優し", "Gốc tính từ (bỏ い)"],
      ["n3", "n3-575-e1", "与えすぎないで", "Thân ます + すぎないで"],
    ];
    for (const [level, id, answer, form] of cases) {
      const it = q(level, id);
      assert.equal(rubyForms(it.answer).text, answer, id);
      assert.ok(it.explain?.startsWith(`${answer} = ${form}`), `${id}: ${it.explain}`);
      // nhiễu cùng kiểu phái sinh, không có dạng đúng nào của chính từ
      assert.ok(it.pool.length >= 3 && !it.pool.some((p) => rubyForms(p).reading === rubyForms(it.answer).reading), id);
    }
    // thân ます không nối đuôi bất kỳ: 足りなかったら không phải 足り + なかったら
    for (const level of VOCAB_LEVELS)
      for (const it of deck(level, "dien")) if (it.explain?.includes(" = Thân ます + ")) assert.match(it.explain, / = Thân ます \+ (そう|すぎ|ながら|に)/u, it.id);
  });

  test("bước 2.2: câu điền từ — lộ đáp án chỉ xét chữ hiển thị; nhiều cách viết; nhiễu không có ～", () => {
    const has = (level: VocabLevel, id: string): QuizItem | undefined => deck(level, "dien").find((x) => x.id === `v-cloze:${id}`);
    // cách đọc trùng ở chữ Hán khác không còn bị coi là lộ: 量 / 料理, 医学 / 大学, 西 / 沈みます
    for (const [level, id] of [["n4", "mn-44-021-e1"], ["n4", "mn-47-015-e1"], ["n4", "mn-32-028-e1"]] as const) assert.ok(has(level, id), id);
    // chữ đáp án chỉ nằm trong từ ghép dài hơn → không tính lộ (user giữ câu gốc): 本 / 日本語, 国 / 中国, 山 / 富士山
    for (const id of ["mn-02-007-e1", "mn-03-022-e1", "mn-08-034-e1"]) assert.ok(has("n5", id), id);
    // trường ghi nhiều cách viết: 夫 /主人 → hỏi 夫; làm nhiễu → chỉ cách viết đầu
    assert.equal(rubyForms(has("n5", "mn-09-033-e1")!.answer).text, "夫");
    for (const level of VOCAB_LEVELS)
      for (const q of deck(level, "dien")) {
        assert.ok(!q.pool.some((p) => /[～/／]/u.test(p)), `${q.id}: ${q.pool.join(" ")}`);
      }
  });

  test("Q4b: nhiễu không đọc giống đáp án (đồng âm cùng thể: 付いて ↔ ついて)", () => {
    for (const level of VOCAB_LEVELS)
      for (const q of inflected(level)) {
        const a = rubyForms(q.answer).reading;
        assert.ok(!q.pool.some((p) => rubyForms(p).reading === a), `${q.id}: ${q.pool.join(" ")}`);
      }
  });

  test("Q4b: nhiễu không trùng bất kỳ thể đúng nào của chính từ; cùng đuôi với đáp án (ました, ないで)", () => {
    for (const level of VOCAB_LEVELS)
      for (const q of inflected(level)) {
        const row = rowById.get(q.id.replace("v-cloze:", "").replace(/-e\d+$/, ""));
        const right = new Set(row ? Object.values(row.forms).map(([r]) => text(r)) : [text(q.answer)]);
        for (const p of q.pool) assert.ok(!right.has(text(p)), `${q.id}: ${p}`);
        assert.ok(q.pool.length >= 3, q.id);
        // つないで là thể て, không phải ない + で → chỉ xét đuôi で khi giải thích ghi "+ で"
        const ends = ["ました", "ません", ...(q.explain!.includes("+ で") ? ["ないで"] : [])];
        for (const end of ends)
          if (text(q.answer).endsWith(end)) assert.ok(q.pool.every((p) => text(p).endsWith(end)), `${q.id}: ${q.pool.join(",")}`);
      }
  });

  test("Q13: từ N3 trùng từ Minna (n3-101 倒れる) và alias cùng sách (mn-27-005 できます) có câu điền từ đã chia", () => {
    const n3 = inflected("n3").find((x) => x.id.startsWith("v-cloze:n3-101-"));
    assert.ok(n3, "thiếu câu của n3-101");
    assert.match(n3.explain!, /^倒れました = Quá khứ lịch sự · 倒れる/);
    assert.ok(inflected("n5").some((x) => x.id.startsWith("v-cloze:mn-27-005-")) || inflected("n4").some((x) => x.id.startsWith("v-cloze:mn-27-005-")), "thiếu câu của mn-27-005");
  });

  test("Q4b: 来ました — nhiễu là động từ khác thể ました + dạng chia sai; giải thích ghi tên thể", () => {
    const q = inflected("n5").find((x) => text(x.answer) === "来ました")!;
    assert.ok(q, "thiếu câu 来ました");
    assert.match(q.explain!, /^来ました = Quá khứ lịch sự · 来ます/);
    assert.ok(q.pool.slice(0, 6).filter((p) => /^[行帰起寝働]/.test(text(p))).length >= 2, q.pool.join(","));
  });
});
