// Tiện ích chia thể dùng chung cho các trang /chia-the/ — chỉ nhận dữ liệu, không gọi getCollection.
import type { ConjEntry, ConjFormDef, ConjGroup, ConjKind } from "../content.config";

export const KIND_LABEL: Record<ConjKind | "V", string> = {
  V: "Cả 3 nhóm",
  V1: "Nhóm 1",
  V2: "Nhóm 2",
  V3: "Nhóm 3",
  Ai: "Tính từ い",
  An: "Tính từ な",
  N: "Danh từ",
};

export const GROUP_OF_KIND: Record<ConjKind, ConjGroup> = {
  V1: "verb",
  V2: "verb",
  V3: "verb",
  Ai: "adj-i",
  An: "adj-na",
  N: "noun",
};

/** Đường dẫn (không có "/" đầu/cuối) của từng nhóm. Danh từ chỉ có trang chi tiết cho từ ví dụ. */
export const GROUP_SLUG: Record<ConjGroup, string> = {
  verb: "dong-tu",
  "adj-i": "tinh-tu-i",
  "adj-na": "tinh-tu-na",
  noun: "danh-tu",
};

export const LIST_GROUPS: ConjGroup[] = ["verb", "adj-i", "adj-na"];

export function entryPath(e: Pick<ConjEntry, "kind" | "vocab_id">): string {
  return `chia-the/${GROUP_SLUG[GROUP_OF_KIND[e.kind]]}/${e.vocab_id}/`;
}

export function vocabPath(e: Pick<ConjEntry, "book" | "lesson" | "vocab_id">): string {
  return e.book === "n3" ? `vocabulary/n3/${e.lesson}/#${e.vocab_id}` : `vocabulary/${e.lesson}/#${e.vocab_id}`;
}

export function sourceLabel(e: Pick<ConjEntry, "book" | "lesson">): string {
  return e.book === "n3" ? `N3 · Bài ${e.lesson}` : `Bài ${e.lesson}`;
}

/** Nhóm theo nguồn: Minna bài 1–50 rồi N3 bài 1–14 (giữ thứ tự trong data). */
export function bySource(entries: ConjEntry[]): { id: string; title: string; items: ConjEntry[] }[] {
  const out = new Map<string, { id: string; title: string; items: ConjEntry[] }>();
  for (const e of entries) {
    const id = e.book === "n3" ? `n3-${e.lesson}` : `mn-${e.lesson}`;
    const title = e.book === "n3" ? `N3 · Bài ${e.lesson}` : `Minna · Bài ${e.lesson}`;
    const g = out.get(id) ?? { id, title, items: [] };
    g.items.push(e);
    out.set(id, g);
  }
  return [...out.values()];
}

/** vocab_id (kể cả mục trùng ở bài khác) → đường dẫn trang chia thể. Dùng cho link từ thẻ từ vựng. */
export function conjLinks(entries: ConjEntry[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const e of entries) {
    const path = entryPath(e);
    for (const id of [e.vocab_id, ...e.aliases]) out.set(id, path);
  }
  return out;
}

export function formPath(f: Pick<ConjFormDef, "group" | "id">): string {
  return `chia-the/the/${GROUP_SLUG[f.group]}/${f.id}/`;
}

/** Thể của một nhóm theo thứ tự bài học (ngoài giáo trình xếp cuối), gom theo bài. */
export function byLesson(defs: ConjFormDef[]): { lesson: number | null; forms: ConjFormDef[] }[] {
  const sorted = [...defs].sort((a, b) => (a.lesson ?? 99) - (b.lesson ?? 99));
  const out: { lesson: number | null; forms: ConjFormDef[] }[] = [];
  for (const f of sorted) {
    const last = out.at(-1);
    if (last && last.lesson === f.lesson) last.forms.push(f);
    else out.push({ lesson: f.lesson, forms: [f] });
  }
  return out;
}

/** Tách quy tắc để hiển thị từng dòng: mỗi câu một khối; câu có "; " → dòng dẫn (trước dấu ":") + từng trường hợp.
 *  "Theo âm cuối…: い・ち・り → って; み・び・に → んで. Ngoại lệ: …" → [{head, items:[…]}, {head:"Ngoại lệ: …"}] */
export function ruleLines(text: string): { head: string | null; items: string[] }[] {
  return text
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      if (!s.includes("; ")) return { head: s, items: [] };
      const colon = s.indexOf(": ");
      const head = colon >= 0 && colon < s.indexOf("; ") ? s.slice(0, colon + 1) : null;
      const body = head ? s.slice(colon + 2) : s;
      return { head, items: body.replace(/\.$/, "").split("; ") };
    });
}

/** Nhóm hiển thị các thể động từ: dùng cho trang chi tiết từ và dropdown chọn thể. Nhóm khác: một nhóm duy nhất. */
export const VERB_FORM_SECTIONS: { title: string; ids: string[] }[] = [
  { title: "Lịch sự (thể ます)", ids: ["masu", "masen", "mashita", "masendeshita", "mashou", "tai"] },
  { title: "Thể thường", ids: ["dict", "nai", "ta", "nakatta", "te"] },
  { title: "Điều kiện", ids: ["tara", "ba"] },
  { title: "Thể khác", ids: ["potential", "volitional", "imperative", "prohibitive", "passive", "causative", "causative_passive"] },
];
