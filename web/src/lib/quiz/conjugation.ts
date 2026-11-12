// Quiz chia thể (Q6, plan/quiz.md "Q6 — spec"). Khác Q4/Q5: câu hỏi SINH TRÊN TRÌNH DUYỆT (Q6-1) từ bảng chia gọn
// /chia-the/quiz/<nhóm>.json (buildConjTable lúc build) — nhiễu lọc theo đúng bài đã học. Unit test chạy conjItems
// trên toàn bộ dữ liệu + checkDeck như các deck khác.
//   c-to     {書|か}きます · Thể て → {書|か}いて   nhiễu: "chia sai" (Q6-4) — biến âm て sai, chia nhầm nhóm, い ↔ な
//   c-which  たべさせる → Thể sai khiến          nhiễu: thể đã học có đuôi giống; khả năng = bị động → cả hai đúng (Q6-5)
//   c-group  かえります → Nhóm I                 3 lựa chọn (Q6-3)
// Đáp án đúng luôn lấy từ data/; bộ "chia sai" ở đây chỉ sinh nhiễu, nhiễu trùng chữ hiển thị của đáp án thì bị bỏ.
import type { ConjEntry, ConjFormDef } from "../schemas";
import { normalize } from "./core";
import type { QuizItem } from "./types";
import { MIN_POOL, MIN_POOL_BY_KIND, isValidRuby, leaks, rubyForms } from "./validate";

export type ConjGroupId = "verb" | "adj-i" | "adj-na";
export const CONJ_GROUPS: readonly ConjGroupId[] = ["verb", "adj-i", "adj-na"];
/** = GROUP_SLUG ở lib/conjugation.ts (đường dẫn trang chia thể). */
export const CONJ_GROUP_SLUG: Record<ConjGroupId, string> = { verb: "dong-tu", "adj-i": "tinh-tu-i", "adj-na": "tinh-tu-na" };
export const CONJ_GROUP_LABEL: Record<ConjGroupId, string> = { verb: "Động từ", "adj-i": "Tính từ い", "adj-na": "Tính từ な" };
export const CONJ_KINDS = { chia: "c-to", the: "c-which", nhom: "c-group" } as const;
export type ConjKindSlug = keyof typeof CONJ_KINDS;
export const CONJ_KIND_LABEL: Record<ConjKindSlug, string> = { chia: "Chia", the: "Nhận thể", nhom: "Nhóm động từ" };
export type VerbKind = "V1" | "V2" | "V3";
export const VERB_GROUP_LABEL: Record<VerbKind, string> = { V1: "Nhóm I", V2: "Nhóm II", V3: "Nhóm III" };
const GROUP_OF: Record<string, ConjGroupId | undefined> = { V1: "verb", V2: "verb", V3: "verb", Ai: "adj-i", An: "adj-na" };

/** Bảng chia gọn của một nhóm từ — file /chia-the/quiz/<nhóm>.json. */
export interface ConjTable {
  version: 1;
  group: ConjGroupId;
  forms: { id: string; name: string; lesson: number | null }[];
  rows: ConjRow[];
}
export interface ConjRow {
  id: string;
  kind: string;
  book: "minna" | "n3";
  lesson: number;
  meaning: string;
  /** Dạng gốc trong giáo trình (thể ます / tính từ nguyên dạng) — ruby. */
  base: string;
  /** thể → [ruby, quy tắc, bất quy tắc 0/1]; thiếu thể = từ không dùng thể đó. */
  forms: Record<string, [string, string, 0 | 1]>;
}

export function buildConjTable(group: ConjGroupId, entries: readonly ConjEntry[], defs: readonly ConjFormDef[]): ConjTable {
  return {
    version: 1,
    group,
    forms: defs.filter((d) => d.group === group).map((d) => ({ id: d.id, name: d.name_vi, lesson: d.lesson })),
    rows: entries
      .filter((e) => GROUP_OF[e.kind] === group)
      .map((e) => ({
        id: e.vocab_id,
        kind: e.kind,
        book: e.book,
        lesson: e.lesson,
        meaning: e.meaning_vi,
        base: e.ruby,
        forms: Object.fromEntries(e.forms.map((f) => [f.form, [f.ruby, f.rule, f.irregular ? 1 : 0]])),
      })),
  };
}

// ---------------------------------------------------------------- Bộ "chia sai" (Q6-4) — thao tác trên chuỗi ruby

/** Tách phần kana cuối (sau dấu } cuối cùng): {書|か}く → ["{書|か}", "く"]. */
function splitTail(ruby: string): [string, string] {
  const i = ruby.lastIndexOf("}");
  return i < 0 ? ["", ruby] : [ruby.slice(0, i + 1), ruby.slice(i + 1)];
}

const U = "うくぐすつぬぶむる";
const ROW: Record<"a" | "i" | "e" | "o", string> = { a: "わかがさたなばまら", i: "いきぎしちにびみり", e: "えけげせてねべめれ", o: "おこごそとのぼもろ" };
const TE: Record<string, string> = { う: "って", つ: "って", る: "って", む: "んで", ぶ: "んで", ぬ: "んで", く: "いて", ぐ: "いで", す: "して" };
const TE_ENDINGS = ["いて", "いで", "って", "んで", "して"];
const toTa = (te: string): string => te.replace(/て$/, "た").replace(/で$/, "だ");

/** Chia như động từ nhóm I từ thể từ điển (dùng để chia SAI nhóm II/III: たべる → たべらない, たべって). */
export function godan(dict: string, form: string): string | null {
  const [head, tail] = splitTail(dict);
  const last = tail.at(-1);
  if (!last || !U.includes(last)) return null;
  const stem = head + tail.slice(0, -1);
  const row = (r: keyof typeof ROW): string => stem + ROW[r][U.indexOf(last)]!;
  const te = stem + TE[last]!;
  const m: Record<string, string> = {
    masu: row("i") + "ます", masen: row("i") + "ません", mashita: row("i") + "ました", masendeshita: row("i") + "ませんでした",
    mashou: row("i") + "ましょう", tai: row("i") + "たい", te, nai: row("a") + "ない", nakatta: row("a") + "なかった", dict,
    ta: toTa(te), tara: toTa(te) + "ら", potential: row("e") + "る", volitional: row("o") + "う", imperative: row("e"),
    prohibitive: dict + "な", ba: row("e") + "ば", passive: row("a") + "れる", causative: row("a") + "せる", causative_passive: row("a") + "される",
  };
  return m[form] ?? null;
}

/** Chia như động từ nhóm II từ thân ます (dùng để chia SAI nhóm I/III: かきます → かきて, かきない; します → しれる). */
export function ichidan(stem: string, form: string): string | null {
  const m: Record<string, string> = {
    masu: "ます", masen: "ません", mashita: "ました", masendeshita: "ませんでした", mashou: "ましょう", tai: "たい", te: "て",
    nai: "ない", nakatta: "なかった", dict: "る", ta: "た", tara: "たら", potential: "られる", volitional: "よう", imperative: "ろ",
    prohibitive: "るな", ba: "れば", passive: "られる", causative: "させる", causative_passive: "させられる",
  };
  return m[form] === undefined ? null : stem + m[form];
}

/** Biến âm て/た sai của nhóm I: {書|か}く → かって, かんで, かして, かいで (đúng: かいて — nơi gọi tự loại). */
function teSwaps(dict: string, form: string): string[] {
  if (form !== "te" && form !== "ta" && form !== "tara") return [];
  const [head, tail] = splitTail(dict);
  if (!tail || !U.includes(tail.at(-1)!)) return [];
  const stem = head + tail.slice(0, -1);
  return TE_ENDINGS.map((e) => stem + (form === "te" ? e : form === "ta" ? toTa(e) : toTa(e) + "ら"));
}

// Tính từ: thể của い và な đặt tương ứng theo nghĩa (い plain ↔ な da/attributive, い ba ↔ な nara)
const I_END: Record<string, string[]> = {
  plain: ["い"], da: ["い"], attributive: ["い"], desu: ["いです"], neg: ["くない"], neg_polite: ["くないです", "くありません"],
  past: ["かった"], past_polite: ["かったです"], past_neg: ["くなかった"], past_neg_polite: ["くなかったです", "くありませんでした"],
  te: ["くて"], adverb: ["く"], ba: ["ければ"], nara: ["ければ"],
};
const NA_END: Record<string, string[]> = {
  plain: ["だ"], da: ["だ"], attributive: ["な", "の"], desu: ["です", "なです"], neg: ["じゃない"], neg_polite: ["じゃありません"],
  past: ["だった"], past_polite: ["でした"], past_neg: ["じゃなかった"], past_neg_polite: ["じゃありませんでした"],
  te: ["で"], adverb: ["に"], ba: ["なら"], nara: ["なら"],
};

/** Nhiễu "chia sai" theo thứ tự ưu tiên (chưa loại dạng đúng). */
export function wrongForms(row: ConjRow, form: string): string[] {
  const f = (id: string): string | undefined => row.forms[id]?.[0];
  const out: string[] = [];
  const push = (...xs: (string | null | undefined)[]): void => {
    for (const x of xs) if (x) out.push(x);
  };
  if (row.kind === "V1" || row.kind === "V2" || row.kind === "V3") {
    const dict = f("dict"), masu = f("masu");
    const stem = masu?.endsWith("ます") ? masu.slice(0, -2) : null;
    if (row.kind === "V1") {
      if (dict) push(...teSwaps(dict, form));
      if (stem) push(ichidan(stem, form));
    } else if (row.kind === "V2") {
      if (dict) push(godan(dict, form));
    } else {
      if (stem) push(ichidan(stem, form));
      if (dict) push(godan(dict, form));
    }
  } else if (row.kind === "Ai") {
    const plain = f("plain");
    if (plain) {
      const stem = plain.endsWith("い") ? plain.slice(0, -1) : plain;
      for (const e of NA_END[form] ?? []) push(plain + e); // たかいでした, たかいじゃない
      for (const e of I_END[form] ?? []) push(stem + e); // いい → いくない (bất quy tắc)
      if (form === "past_polite") push(stem + "かったでした");
    }
  } else if (row.kind === "An") {
    const da = f("da");
    if (da?.endsWith("だ")) {
      const w = da.slice(0, -1);
      for (const e of I_END[form] ?? []) push(w + e); // しずかくない, しずかかった
      for (const e of NA_END[form] ?? []) push(w + e); // しずかなです, しずかの
    }
  }
  return out;
}

// ---------------------------------------------------------------- Sinh câu hỏi

export interface ConjOptions {
  book: "minna" | "n3";
  /** Minna: đã học tới bài (lọc cả từ lẫn thể, Q6-2). */
  upTo?: number;
  /** N3: khoảng bài từ vựng. */
  from?: number;
  to?: number;
  /** Chỉ động từ: nhóm I/II/III; bỏ trống = cả 3. */
  verbKinds?: readonly VerbKind[];
  /** Thể được hỏi (c-to, c-which); bỏ trống = mọi thể đã học. */
  forms?: readonly string[];
  kinds: readonly ConjKindSlug[];
}

const POOL_SIZE = 6;
// tách ruby lặp lại rất nhiều lần (mỗi ô × mỗi thể) → nhớ đệm; chạy trên trình duyệt mỗi lần đổi bộ lọc
const formsCache = new Map<string, { text: string; reading: string }>();
function rf(s: string): { text: string; reading: string } {
  let v = formsCache.get(s);
  if (!v) formsCache.set(s, (v = rubyForms(s)));
  return v;
}
const shownCache = new Map<string, string>();
function shown(s: string): string {
  let v = shownCache.get(s);
  if (v === undefined) shownCache.set(s, (v = normalize(rf(s).text)));
  return v;
}

export function conjHref(group: ConjGroupId, id: string): string {
  return `chia-the/${CONJ_GROUP_SLUG[group]}/${id}/`;
}

/** Thể đã học (Minna: bài ≤ B; thể ngoài giáo trình — bị bắt làm — chỉ khi B = 50). N3: mọi thể. */
export function learnedForms(table: ConjTable, opts: Pick<ConjOptions, "book" | "upTo">): ConjTable["forms"] {
  if (opts.book === "n3") return table.forms;
  const b = opts.upTo ?? 50;
  return table.forms.filter((f) => (f.lesson === null ? b >= 50 : f.lesson <= b));
}

function rowsOf(table: ConjTable, opts: ConjOptions): ConjRow[] {
  return table.rows.filter((r) => {
    if (r.book !== opts.book) return false;
    if (opts.book === "minna" ? r.lesson > (opts.upTo ?? 50) : r.lesson < (opts.from ?? 1) || r.lesson > (opts.to ?? 50)) return false;
    return table.group !== "verb" || !opts.verbKinds?.length || opts.verbKinds.includes(r.kind as VerbKind);
  });
}

/** Dạng làm đề: Minna = thể ます / nguyên dạng; N3 động từ = thể từ điển (như sách N3). */
function promptForm(table: ConjTable, r: ConjRow): { ruby: string; form: string | null } {
  if (table.group === "verb") {
    const id = r.book === "n3" ? "dict" : "masu";
    return { ruby: r.forms[id]?.[0] ?? r.base, form: id };
  }
  return { ruby: r.base, form: null };
}

// Thể lịch sự (đuôi ます/です): nhiễu bù cùng "độ lịch sự" với đáp án, không thì lộ (hỏi thể て mà nhiễu しません)
const POLITE = new Set(["masu", "masen", "mashita", "masendeshita", "mashou", "desu", "neg_polite", "past_polite", "past_neg_polite"]);
const sameClass = (a: string, b: string): boolean => POLITE.has(a) === POLITE.has(b);

const lessonLabel = (r: ConjRow): string => (r.book === "n3" ? `N3 · Bài ${r.lesson}` : `Bài ${r.lesson}`);

function toItems(table: ConjTable, opts: ConjOptions, r: ConjRow, learned: ConjTable["forms"], asked: ConjTable["forms"]): QuizItem[] {
  const out: QuizItem[] = [];
  const p = promptForm(table, r);
  const href = conjHref(table.group, r.id);
  const tags = { lesson: r.lesson, group: r.kind, book: r.book };

  for (const f of asked) {
    const cell = r.forms[f.id];
    if (!cell) continue; // từ không có thể này (わかります: không có khả năng)
    const [ruby, rule, irr] = cell;
    // trùng chữ với đề (ます; tính từ nguyên dạng) → tự lộ
    if (f.id === p.form || shown(ruby) === shown(p.ruby)) continue;

    if (opts.kinds.includes("chia")) {
      const bad = new Set([shown(ruby)]);
      const pool: string[] = [];
      // bù: thể khác của chính từ — cùng độ lịch sự trước, rồi độ dài gần đáp án
      const len = rf(ruby).reading.length;
      const others = learned
        .filter((x) => x.id !== f.id && r.forms[x.id] && r.forms[x.id]![0] !== p.ruby)
        .map((x) => ({ ruby: r.forms[x.id]![0], score: (sameClass(x.id, f.id) ? 0 : 100) + Math.abs(rf(r.forms[x.id]![0]).reading.length - len) }))
        .sort((a, b) => a.score - b.score)
        .map((x) => x.ruby);
      for (const c of [...wrongForms(r, f.id), ...others]) {
        const k = shown(c);
        if (bad.has(k) || !isValidRuby(c)) continue;
        bad.add(k);
        pool.push(c);
        if (pool.length >= POOL_SIZE) break;
      }
      out.push({
        id: `c-to:${r.id}:${f.id}`,
        kind: "c-to",
        prompt: p.ruby,
        promptLang: "ja",
        question: `Chia sang ${f.name}`,
        hint: `${r.meaning} · ${lessonLabel(r)}`,
        answer: ruby,
        accepted: [],
        pool,
        explain: `${rule}${irr ? " · Bất quy tắc" : ""}`,
        href,
        tags: { ...tags, form: f.id },
      });
    }

    if (opts.kinds.includes("the")) {
      const kana = (id: string): string | undefined => r.forms[id] && normalize(rf(r.forms[id][0]).reading);
      const mine = kana(f.id)!;
      // cùng kana (V2: khả năng = bị động) → cũng đúng, kể cả khi thể kia chưa học
      const same = table.forms.filter((x) => x.id !== f.id && kana(x.id) === mine).map((x) => x.name);
      const suffix = (a: string, b: string): number => {
        let n = 0;
        while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
        return n;
      };
      const pool = learned
        .filter((x) => x.id !== f.id && !same.includes(x.name))
        .map((x) => ({ x, score: suffix(kana(x.id) ?? "", mine) + (sameClass(x.id, f.id) ? 10 : 0) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, POOL_SIZE)
        .map(({ x }) => x.name);
      out.push({
        id: `c-which:${r.id}:${f.id}`,
        kind: "c-which",
        prompt: ruby,
        promptLang: "ja",
        question: "Đây là thể nào?",
        hint: `${r.meaning} · ${lessonLabel(r)}`,
        answer: f.name,
        accepted: same,
        pool,
        explain: `${rf(p.ruby).text} → ${rf(ruby).text}: ${rule}${same.length ? ` · Cùng dạng với ${same.join(", ")}` : ""}`,
        href,
        tags: { ...tags, form: f.id },
      });
    }
  }

  if (opts.kinds.includes("nhom") && table.group === "verb") {
    const k = r.kind as VerbKind;
    out.push({
      id: `c-group:${r.id}`,
      kind: "c-group",
      prompt: p.ruby,
      promptLang: "ja",
      question: "Động từ nhóm mấy?",
      hint: `${r.meaning} · ${lessonLabel(r)}`,
      answer: VERB_GROUP_LABEL[k],
      accepted: [],
      pool: (Object.keys(VERB_GROUP_LABEL) as VerbKind[]).filter((x) => x !== k).map((x) => VERB_GROUP_LABEL[x]),
      explain: groupReason(r),
      href,
      tags,
    });
  }
  return out;
}

const I_ROW = new Set([..."いきぎしじちぢにひびぴみり"]);
const E_ROW = new Set([..."えけげせぜてでねへべぺめれ"]);

/** Lý do thuộc nhóm — nêu rõ ca dễ nhầm (かえります nhóm I; おきます nhóm II hàng い). */
export function groupReason(r: ConjRow): string {
  const masu = rf(r.forms.masu?.[0] ?? "").reading;
  const dict = rf(r.forms.dict?.[0] ?? "").reading;
  const before = [...masu.replace(/ます$/, "")].at(-1) ?? "";
  if (r.kind === "V3") return "Nhóm III: します (kể cả danh từ + します) và きます";
  if (r.kind === "V2") {
    return I_ROW.has(before)
      ? `Nhóm II — ngoại lệ: thân ます kết thúc hàng い (${before}) nhưng vẫn là nhóm II, phải học thuộc`
      : `Nhóm II: thân ます kết thúc hàng え (${before})`;
  }
  const dictPrev = [...dict].at(-2) ?? "";
  const tricky = dict.endsWith("る") && (I_ROW.has(dictPrev) || E_ROW.has(dictPrev));
  return `Nhóm I: thân ます kết thúc hàng い (${before})${tricky ? ` — thể từ điển ${dict} trông như nhóm II nhưng là nhóm I` : ""}`;
}

/**
 * Câu hỏi cho bộ lọc hiện tại — chạy trên trình duyệt mỗi khi bộ lọc đổi. Câu không đủ nhiễu bị bỏ (không throw).
 * Không gọi checkDeck ở đây (chiếm ~60% thời gian): nhiễu đã loại trùng đáp án + kiểm ruby ngay lúc sinh; đề/đáp án
 * lấy từ data/ không đổi theo bộ lọc → unit test chạy checkDeck trên toàn bộ dữ liệu (conjugation.test.ts).
 */
export function conjItems(table: ConjTable, opts: ConjOptions): QuizItem[] {
  const learned = learnedForms(table, opts);
  const asked = opts.forms?.length ? learned.filter((f) => opts.forms!.includes(f.id)) : learned;
  return rowsOf(table, opts)
    .flatMap((r) => toItems(table, opts, r, learned, asked))
    // tự lộ đáp án (くださいます → mệnh lệnh ください) → bỏ, như quiz từ vựng
    .filter((x) => x.pool.length >= (MIN_POOL_BY_KIND[x.kind] ?? MIN_POOL) && !(x.kind === "c-to" && leaks(x)));
}
