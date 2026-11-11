// Tiện ích trang /dem-so/ — chỉ nhận dữ liệu, không gọi getCollection.
import type { Counter, CounterReading } from "../content.config";

export const CATEGORY_LABEL: Record<Counter["category"], string> = {
  general: "Đếm chung",
  people: "Người",
  animals: "Động vật",
  objects: "Đồ vật",
  place: "Nhà, tầng",
  time: "Thời gian",
  date: "Ngày tháng",
  frequency: "Số lần",
  money: "Tiền",
  age: "Tuổi",
  order: "Thứ tự",
};

/** Nhóm hiển thị trên trang chọn trợ số từ (gộp các loại nhỏ cho đỡ rời rạc). */
export const DISPLAY_GROUPS: { label: string; cats: Counter["category"][] }[] = [
  { label: "Người, đồ vật, động vật", cats: ["general", "people", "objects", "animals", "place"] },
  { label: "Thời gian, ngày tháng", cats: ["time", "date"] },
  { label: "Tiền, tuổi, số lần, thứ tự", cats: ["money", "age", "frequency", "order"] },
];

/** c-kai-floor → kai-floor (đường dẫn /dem-so/kai-floor/). */
export const counterSlug = (c: Pick<Counter, "id">): string => c.id.replace(/^c-/, "");
export const counterPath = (c: Pick<Counter, "id">): string => `dem-so/${counterSlug(c)}/`;

/** vocab_id → trang trợ số từ (không có "/" đầu). Liên kết đã tính trong pipeline (Counter.vocab_refs). */
export function counterLinks(counters: Pick<Counter, "id" | "vocab_refs">[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const c of counters) for (const id of c.vocab_refs) out.set(id, counterPath(c));
  return out;
}

/** Ô 1–10 dùng cho bảng tổng hợp. */
export function readingOf(c: Counter, n: number): CounterReading | undefined {
  return c.readings.find((r) => r.n === n);
}

/** Số viết kiểu Nhật (dấu phẩy nhóm nghìn): 10000 → 10,000 — dùng cạnh chữ Nhật (10,000本). */
export const formatNumberJa = (n: number): string => n.toLocaleString("ja-JP");

const DIGIT = ["", "いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう"];
// Hàng trăm / nghìn có biến âm cố định (300 さんびゃく, 600 ろっぴゃく, 3000 さんぜん…)
const HUNDREDS = ["", "ひゃく", "にひゃく", "さんびゃく", "よんひゃく", "ごひゃく", "ろっぴゃく", "ななひゃく", "はっぴゃく", "きゅうひゃく"];
const THOUSANDS = ["", "せん", "にせん", "さんぜん", "よんせん", "ごせん", "ろくせん", "ななせん", "はっせん", "きゅうせん"];

/** Cách đọc số < 10.000 (mặc định よん/なな/きゅう, 10 じゅう, 100 ひゃく, 1000 せん). */
function under10k(n: number): string {
  const th = Math.floor(n / 1000), h = Math.floor((n % 1000) / 100), t = Math.floor((n % 100) / 10), u = n % 10;
  return THOUSANDS[th]! + HUNDREDS[h]! + (t ? (t > 1 ? DIGIT[t]! : "") + "じゅう" : "") + DIGIT[u]!;
}

/** Cách đọc số thường (chưa ghép trợ số từ): 24 → にじゅうよん, 10000 → いちまん. Nhóm 4 chữ số: 億, 万. */
export function numberKana(n: number): string {
  const oku = Math.floor(n / 1e8), man = Math.floor((n % 1e8) / 1e4);
  // 万/億 luôn có いち (いちまん, いちおく); under10k(1) = いち
  return (oku ? under10k(oku) + "おく" : "") + (man ? under10k(man) + "まん" : "") + under10k(n % 1e4);
}

/** Đọc khác 'số thường + trợ số từ' ghép thẳng (biến âm hoặc bất quy tắc) → tô nhấn trong bảng. */
export function isChanged(c: Counter, r: CounterReading): boolean {
  if (r.irregular) return true;
  return r.kana !== numberKana(r.n) + c.kana;
}
