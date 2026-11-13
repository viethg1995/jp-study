// Câu hay sai (Q10, plan/quiz/q10-wrong-answers.md): lưu ID câu + thống kê, dùng chung mọi trang quiz (cùng ID trên
// trang từng phần và trang tổng). Hàm thuần trên cấu trúc dữ liệu — đọc/ghi thật qua lib/storage.ts (runner gọi).
//   sai → thêm / w+1, s=0 · đúng câu đang có → s+1 · đúng REMEMBER_STREAK lần liên tiếp → xóa (đã nhớ)
//   tối đa MAX_ITEMS câu, vượt → bỏ câu cập nhật cũ nhất · dữ liệu hỏng / sai phiên bản → rỗng
import type { QuizItem } from "./types";

export const WRONG_VERSION = 1;
/** Đúng liên tiếp bấy nhiêu lần thì coi là đã nhớ (user chốt 2026-11-13). */
export const REMEMBER_STREAK = 3;
export const MAX_ITEMS = 1000;

export interface WrongStat {
  /** Số lần sai. */
  w: number;
  /** Số lần đúng liên tiếp kể từ lần sai gần nhất. */
  s: number;
  /** Thời điểm cập nhật (giây). */
  t: number;
}
export interface WrongStore {
  v: typeof WRONG_VERSION;
  items: Record<string, WrongStat>;
}

export const emptyStore = (): WrongStore => ({ v: WRONG_VERSION, items: {} });

const isStat = (x: unknown): x is WrongStat => {
  const o = x as Partial<WrongStat> | null;
  return !!o && typeof o === "object" && [o.w, o.s, o.t].every((n) => typeof n === "number" && Number.isFinite(n));
};

/** Chuỗi đã lưu → store; null / JSON hỏng / phiên bản khác → rỗng; mục hỏng bị bỏ. */
export function parseStore(raw: string | null): WrongStore {
  if (!raw) return emptyStore();
  try {
    const d = JSON.parse(raw) as { v?: unknown; items?: unknown };
    if (d?.v !== WRONG_VERSION || !d.items || typeof d.items !== "object") return emptyStore();
    const items: Record<string, WrongStat> = {};
    for (const [id, st] of Object.entries(d.items as Record<string, unknown>)) if (isStat(st)) items[id] = { w: st.w, s: st.s, t: st.t };
    return { v: WRONG_VERSION, items };
  } catch {
    return emptyStore();
  }
}

export interface RecordResult {
  store: WrongStore;
  /** Câu vừa đạt REMEMBER_STREAK lần đúng liên tiếp → đã xóa. */
  remembered: boolean;
}

/** Ghi một câu trả lời (không sửa store cũ). `now` tính bằng giây. */
export function recordAnswer(store: WrongStore, id: string, ok: boolean, now: number): RecordResult {
  const items = { ...store.items };
  const cur = items[id];
  let remembered = false;
  if (!ok) {
    items[id] = { w: (cur?.w ?? 0) + 1, s: 0, t: now };
  } else if (cur) {
    if (cur.s + 1 >= REMEMBER_STREAK) {
      delete items[id];
      remembered = true;
    } else items[id] = { ...cur, s: cur.s + 1, t: now };
  }
  return { store: { v: WRONG_VERSION, items: prune(items) }, remembered };
}

/** Giữ tối đa MAX_ITEMS câu: bỏ câu cập nhật cũ nhất. */
function prune(items: Record<string, WrongStat>): Record<string, WrongStat> {
  const ids = Object.keys(items);
  if (ids.length <= MAX_ITEMS) return items;
  const keep = ids.sort((a, b) => items[b]!.t - items[a]!.t || a.localeCompare(b)).slice(0, MAX_ITEMS);
  return Object.fromEntries(keep.map((id) => [id, items[id]!]));
}

/** Loại câu của ID (`v-mean:mn-04-001` → `v-mean`). */
export const kindOfId = (id: string): string => id.split(":")[0]!;

/** Câu thuộc phạm vi trang: `kinds` rỗng = mọi loại (trang tổng). */
const inScope = (id: string, kinds: readonly string[]): boolean => kinds.length === 0 || kinds.includes(kindOfId(id));

/** Số câu đã lưu thuộc các loại câu của trang. */
export function countWrong(store: WrongStore, kinds: readonly string[]): number {
  return Object.keys(store.items).filter((id) => inScope(id, kinds)).length;
}

/** Xóa câu sai thuộc các loại câu của trang (`kinds` rỗng = xóa hết). */
export function clearWrong(store: WrongStore, kinds: readonly string[]): WrongStore {
  return { v: WRONG_VERSION, items: Object.fromEntries(Object.entries(store.items).filter(([id]) => !inScope(id, kinds))) };
}

/**
 * Chế độ ôn: chỉ câu có trong danh sách, sai nhiều trước rồi sai gần đây; cùng (w, t) giữ ngẫu nhiên theo `rand`.
 * Lượt `limit` câu lấy từ đầu danh sách này (session tự trộn thứ tự hỏi).
 */
export function reviewItems(items: readonly QuizItem[], store: WrongStore, rand: () => number): QuizItem[] {
  return items
    .filter((it) => store.items[it.id])
    .map((it) => ({ it, st: store.items[it.id]!, r: rand() }))
    .sort((a, b) => b.st.w - a.st.w || b.st.t - a.st.t || a.r - b.r)
    .map((x) => x.it);
}
