// Quiz số đếm `n-num` (Q7, plan/quiz/q07-numbers.md): data/counters.json → numbers (86 số của trang /dem-so/so-dem/).
// Hàm thuần — trang /dem-so/quiz/ và /luyen-tap/dem-so.json gọi lúc build.
//   đề "3,800" → chọn cách đọc; accepted = alt (4 → し cũng đúng)
//   nhiễu máy sinh, chắc chắn sai: biến âm sai/thiếu, bỏ いち trước 万/億, thêm いち trước 十/百, phân số đảo,
//   thập phân đọc liền;
//   thiếu thì bù cách đọc của số gần trong cùng mục. Không đổi 4/7/9 (しひゃく…) — cách đọc cũ/hiếm, không chắc sai.
import { numberKana } from "../counters";
import type { NumberSystem } from "../schemas";
import type { QuizItem } from "./types";

export const NUM_KIND = "n-num";
/** Chữ trên URL (?nhom-so=…) → id tab của dữ liệu. */
export const NUM_TAB_SLUG: Record<string, string> = {
  basic: "0-99",
  hundreds: "tram-nghin",
  large: "van-uc",
  fraction: "thap-phan",
  other: "so-khac",
};

/** = NEAR ở core.ts: makeOptions chỉ bốc trong 6 mục đầu pool. */
const POOL_SIZE = 6;

/**
 * Lỗi biến âm hay gặp (đúng → sai), thay một chỗ mỗi lần. Chiều bỏ biến âm (さんびゃく → さんひゃく) và chiều
 * thêm biến âm vào chỗ không có (ごひゃく → ごびゃく, ろくせん → ろっせん). Mọi kết quả là cách đọc sai của chính số đó.
 */
const SOUND_SLIPS: readonly [string, string][] = [
  ["さんびゃく", "さんひゃく"],
  ["ろっぴゃく", "ろくひゃく"],
  ["はっぴゃく", "はちひゃく"],
  ["さんぜん", "さんせん"],
  ["はっせん", "はちせん"],
  ["にひゃく", "にびゃく"],
  ["よんひゃく", "よんびゃく"],
  ["ごひゃく", "ごびゃく"],
  ["ななひゃく", "ななびゃく"],
  ["きゅうひゃく", "きゅうびゃく"],
  ["よんせん", "よんぜん"],
  ["ろくせん", "ろっせん"],
  ["ななせん", "ななぜん"],
  ["きゅうせん", "きゅうぜん"],
  ["いちまん", "まん"],
  ["いちおく", "おく"],
];

/** Thay `from` ở từng vị trí (mỗi biến thể chỉ một chỗ sai). */
function replaceEach(s: string, from: string, to: string): string[] {
  const out: string[] = [];
  for (let i = s.indexOf(from); i >= 0; i = s.indexOf(from, i + 1)) out.push(s.slice(0, i) + to + s.slice(i + from.length));
  return out;
}

/** Nhiễu máy sinh của một số (chưa loại cách đọc đúng). */
export function numberSlips(display: string, kana: string): string[] {
  const out: string[] = [];
  for (const [from, to] of SOUND_SLIPS) out.push(...replaceEach(kana, from, to));
  // thêm いち trước 十/百 đứng đầu (người học hay đọc 10 いちじゅう, 100 いちひゃく) — 千 không làm: いっせん cũng đúng
  if (kana.startsWith("じゅう") || kana.startsWith("じゅっ") || kana.startsWith("ひゃく")) out.push(`いち${kana}`);
  // phân số đảo tử/mẫu: さんぶんのいち (1/3) → いちぶんのさん
  const frac = /^(.+)ぶんの(.+)$/.exec(kana);
  if (frac) out.push(`${frac[2]}ぶんの${frac[1]}`);
  // thập phân ≥ 2 chữ số đọc liền như số nguyên: 3.14 さんてんいちよん → さんてんじゅうよん
  const dec = /^-?\d+\.(\d{2,})$/.exec(display);
  const at = kana.indexOf("てん");
  if (dec && at >= 0) out.push(kana.slice(0, at + 2) + numberKana(Number(dec[1])));
  return out;
}

export function numberItems(numbers: NumberSystem): QuizItem[] {
  const items: QuizItem[] = [];
  for (const tab of numbers.tabs) {
    const inTab = tab.sections.flatMap((s) => s.items);
    for (const section of tab.sections) {
      section.items.forEach((it, i) => {
        const valid = new Set([it.kana, ...it.alt]);
        const pool: string[] = [];
        const push = (s: string): void => {
          if (pool.length < POOL_SIZE && !valid.has(s) && !pool.includes(s)) pool.push(s);
        };
        for (const s of numberSlips(it.display, it.kana)) push(s);
        // bù: số gần trong cùng mục, rồi cùng tab
        const near = section.items.map((x, j) => ({ x, d: Math.abs(j - i) })).filter((n) => n.d > 0).sort((a, b) => a.d - b.d);
        for (const { x } of near) push(x.kana);
        for (const x of inTab) push(x.kana);
        const writing = it.kanji !== it.display ? `${it.kanji}\n` : "";
        items.push({
          id: `${NUM_KIND}:${tab.id}-${it.display}`,
          kind: NUM_KIND,
          prompt: it.display,
          promptLang: "ja",
          question: "Đọc thế nào?",
          hint: null,
          info: `${writing}${tab.label}`,
          answer: it.kana,
          accepted: it.alt,
          pool,
          explain: it.note,
          href: `dem-so/so-dem/#${tab.id}`,
          tags: { tab: tab.id },
        });
      });
    }
  }
  return items;
}
