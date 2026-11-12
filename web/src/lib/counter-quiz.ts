// Quiz đếm số — sinh câu hỏi lúc build từ data/counters.json. Không gọi getCollection.
// Đáp án đúng = kana + alt của ô dữ liệu. Đáp án nhiễu sinh máy móc từ lỗi biến âm hay gặp
// (ghép thẳng はちほん, ngắt âm sai はっほん, đổi âm đầu sai さんほん/さんぽん, đọc số sai よんじ/しじ)
// rồi LOẠI mọi cách đọc có trong kana/alt → không bao giờ coi một cách đọc đúng là sai.
import type { Counter, CounterReading } from "../content.config";
import { counterPath, formatNumberJa, isChanged, numberKana } from "./counters";
import type { QuizItem as Item } from "./quiz/types";

export interface QuizItem {
  id: string; // c-hon-3 — chỉ để phân biệt trong phiên, không lưu
  counter: string; // c-hon
  char: string;
  name: string;
  group: Counter["sound_group"];
  display: string; // 3 · 10,000
  answer: string;
  alt: string[];
  note: string | null;
  changed: boolean; // biến âm / bất quy tắc — ô cần học thuộc
  pool: string[]; // đáp án nhiễu, gần đúng nhất trước
  href: string; // không có "/" đầu
}

// Âm đầu trợ số từ có thể bị đổi (đục / bán đục)
const VOICE: Record<string, string[]> = {
  は: ["ば", "ぱ"], ひ: ["び", "ぴ"], ふ: ["ぶ", "ぷ"], へ: ["べ", "ぺ"], ほ: ["ぼ", "ぽ"],
  か: ["が"], き: ["ぎ"], く: ["ぐ"], け: ["げ"], こ: ["ご"],
  さ: ["ざ"], し: ["じ"], す: ["ず"], せ: ["ぜ"], そ: ["ぞ"],
  た: ["だ"], て: ["で"], と: ["ど"],
};
// Sau っ chỉ ghép với âm vô thanh k/s/t/p (và h — lỗi はっほん người học hay mắc)
const AFTER_SOKUON = /^[かきくけこさしすせそたちつてとはひふへほぱぴぷぺぽ]/;
// Cách đọc khác của chữ số cuối: 4 よん/よ/し, 7 なな/しち, 9 きゅう/く
const DIGIT_ALT: [string, string[]][] = [
  ["よん", ["よ", "し"]],
  ["なな", ["しち"]],
  ["きゅう", ["く"]],
];

function numberStems(n: number): { plain: string[]; sokuon: string[] } {
  const base = numberKana(n);
  const plain = new Set([base]);
  for (const [end, alts] of DIGIT_ALT) {
    if (base.endsWith(end)) for (const a of alts) plain.add(base.slice(0, -end.length) + a);
  }
  // Ngắt âm chỉ từ cách đọc chuẩn: いち→いっ, ろく→ろっ, はち→はっ, ひゃく→ひゃっ, じゅう→じゅっ/じっ
  const sokuon = new Set<string>();
  if (base.endsWith("じゅう")) {
    sokuon.add(base.slice(0, -1) + "っ");
    sokuon.add(base.slice(0, -3) + "じっ");
  } else if (/[ちく]$/.test(base)) sokuon.add(base.slice(0, -1) + "っ");
  return { plain: [...plain], sokuon: [...sokuon] };
}

function counterSuffixes(c: Counter): string[] {
  const head = c.kana[0] ?? "";
  return [c.kana, ...(VOICE[head] ?? []).map((v) => v + c.kana.slice(1))];
}

/** Đáp án nhiễu cho một ô; ít nhất 3 mục nhờ phần bù từ ô khác của cùng trợ số từ. */
export function distractors(c: Counter, r: CounterReading): string[] {
  const valid = new Set([r.kana, ...r.alt]);
  const out = new Set<string>();
  const add = (s: string): void => {
    if (!valid.has(s)) out.add(s);
  };
  const { plain, sokuon } = numberStems(r.n);
  const suffixes = counterSuffixes(c);
  for (const p of plain) for (const s of suffixes) add(p + s);
  for (const p of sokuon) for (const s of suffixes) if (AFTER_SOKUON.test(s)) add(p + s);
  // Bù bằng cách đọc của số gần nhất (ひとつ/ふたつ, ようか/よっか…) — với nhóm đọc riêng đây là nhiễu chính
  const near = c.readings.filter((x) => x.n !== r.n).sort((a, b) => Math.abs(a.n - r.n) - Math.abs(b.n - r.n));
  for (const x of near.slice(0, 4)) add(x.kana);
  return [...out];
}

export function buildQuizItems(counters: Counter[]): QuizItem[] {
  return counters.flatMap((c) =>
    c.readings.map((r) => ({
      id: `${c.id}-${r.n}`,
      counter: c.id,
      char: c.char,
      name: c.name_vi,
      group: c.sound_group,
      display: formatNumberJa(r.n),
      answer: r.kana,
      alt: r.alt,
      note: r.note,
      changed: isChanged(c, r),
      pool: distractors(c, r),
      href: counterPath(c),
    })),
  );
}

/**
 * Câu hỏi đếm số theo kiểu chung lib/quiz (kind "n-ctr") — trang /dem-so/quiz/ dùng hàm này.
 */
export function toQuizItems(items: readonly QuizItem[]): Item[] {
  return items.map((q) => ({
    id: `n-ctr:${q.id}`,
    kind: "n-ctr",
    prompt: `${q.display}${q.char}`,
    promptLang: "ja",
    hint: `～${q.char} · ${q.name}`,
    answer: q.answer,
    accepted: q.alt,
    pool: q.pool,
    explain: q.note,
    href: q.href,
    tags: { counter: q.counter, group: q.group, changed: q.changed ? 1 : 0 },
  }));
}
