// Lối vào "Câu hay sai" ở trang chủ: gom câu đã lưu (jp:quiz:wrong, Q10) theo trang quiz → link mở trang đó ở chế độ ôn
// (?on=sai) với bộ lọc chứa được các câu sai. Hàm thuần, không đụng DOM / localStorage (trang chủ đọc qua lib/storage.ts).
//   Từ vựng tách theo cấp (suy từ ID: mn-01…25 = N5, mn-26…50 = N4, n3- = N3); phần khác không suy được cấp từ ID →
//   link không kèm cấp (trang mở cấp mặc định — như số đếm "Câu hay sai (N)" trên trang đó, đếm theo loại câu).
//   `loai` = các loại câu đang có câu sai (trang mặc định chỉ chọn 1 loại → câu sai loại khác sẽ bị lọc mất).
import { CONJ_KINDS } from "./conjugation";
import { KANJI_KINDS, RADICAL_KINDS } from "./kanji";
import { VOCAB_KINDS, type VocabLevel } from "./vocab";
import { kindOfId, type WrongStore } from "./wrong";

export interface WrongGroup {
  /** Nhãn hiển thị, vd "Từ vựng N4". */
  label: string;
  /** Đường dẫn trang quiz kèm query, không có "/" đầu, vd "vocabulary/quiz/?cap=n4&loai=nghia&on=sai". */
  href: string;
  count: number;
}

interface Section {
  key: string;
  label: string;
  path: string;
  /** loại câu → slug của tham số `loai` trên trang (null = trang không có tham số loại câu cho loại này). */
  kinds: Readonly<Record<string, string>> | null;
  /** Danh sách loại câu khi `kinds` = null. */
  kindIds?: readonly string[];
  /** Tham số cố định thêm vào link. */
  extra?: Readonly<Record<string, string>>;
}

const invert = (o: Readonly<Record<string, string>>): Record<string, string> => Object.fromEntries(Object.entries(o).map(([slug, kind]) => [kind, slug]));

const SECTIONS: readonly Section[] = [
  { key: "vocab", label: "Từ vựng", path: "vocabulary/quiz/", kinds: invert(VOCAB_KINDS) },
  { key: "kanji", label: "Kanji", path: "kanji/quiz/", kinds: invert(KANJI_KINDS) },
  { key: "radical", label: "Bộ thủ", path: "kanji/bo-thu/quiz/", kinds: invert(RADICAL_KINDS) },
  { key: "conj", label: "Chia thể", path: "chia-the/quiz/", kinds: invert(CONJ_KINDS) },
  // Đếm số: mặc định chỉ hỏi ô "Cần nhớ" → o=tat-ca để câu sai ở ô thường vẫn vào lượt
  { key: "counter", label: "Đếm số", path: "dem-so/quiz/", kinds: null, kindIds: ["n-ctr"], extra: { o: "tat-ca" } },
  { key: "number", label: "Số đếm", path: "dem-so/quiz/", kinds: null, kindIds: ["n-num"], extra: { loai: "so" } },
];

const LEVEL_LABEL: Record<VocabLevel, string> = { n5: "N5", n4: "N4", n3: "N3" };

/** Cấp của câu từ vựng theo ID dữ liệu (`v-mean:mn-27-004`, `v-cloze:n3-012-e1`); không nhận ra → null. */
export function vocabLevelOfId(id: string): VocabLevel | null {
  const dataId = id.slice(id.indexOf(":") + 1);
  if (dataId.startsWith("n3-")) return "n3";
  const m = /^mn-(\d{2})-/.exec(dataId);
  if (!m) return null;
  return Number(m[1]) <= 25 ? "n5" : "n4";
}

const sectionOf = (kind: string): Section | undefined =>
  SECTIONS.find((s) => (s.kinds ? kind in s.kinds : (s.kindIds ?? []).includes(kind)));

/** Gom câu sai theo trang quiz (thứ tự cố định: Từ vựng N5/N4/N3, Kanji, Bộ thủ, Chia thể, Đếm số, Số đếm); bỏ nhóm 0 câu. */
export function summarizeWrong(store: WrongStore): WrongGroup[] {
  const groups = new Map<string, { section: Section; level: VocabLevel | null; kinds: Set<string>; count: number }>();
  for (const id of Object.keys(store.items)) {
    const kind = kindOfId(id);
    const section = sectionOf(kind);
    if (!section) continue;
    const level = section.key === "vocab" ? vocabLevelOfId(id) : null;
    if (section.key === "vocab" && !level) continue;
    const key = `${section.key}|${level ?? ""}`;
    const g = groups.get(key) ?? { section, level, kinds: new Set<string>(), count: 0 };
    g.kinds.add(kind);
    g.count++;
    groups.set(key, g);
  }
  const order = (key: string): number => {
    const [sk, lv] = key.split("|");
    return SECTIONS.findIndex((s) => s.key === sk) * 10 + (lv ? Object.keys(LEVEL_LABEL).indexOf(lv) : 0);
  };
  return [...groups.entries()]
    .sort(([a], [b]) => order(a) - order(b))
    .map(([, g]) => {
      const q = new URLSearchParams();
      if (g.level) q.set("cap", g.level);
      if (g.section.kinds) {
        const kinds = g.section.kinds;
        // slug theo thứ tự khai báo của trang, không theo thứ tự gặp
        q.set("loai", Object.keys(kinds).filter((k) => g.kinds.has(k)).map((k) => kinds[k]!).join(","));
      }
      for (const [k, v] of Object.entries(g.section.extra ?? {})) q.set(k, v);
      q.set("on", "sai");
      return {
        label: g.level ? `${g.section.label} ${LEVEL_LABEL[g.level]}` : g.section.label,
        href: `${g.section.path}?${q.toString().replaceAll("%2C", ",")}`,
        count: g.count,
      };
    });
}

// ---------------------------------------------------------------- Bước 2.3a: trang tự chọn cấp / nhóm khi ?on=sai
// ID câu Kanji (`k-hv:k-日`, `k-read:k-日:日本`) và Chia thể (`c-to:mn-14-003:te`) không mang cấp / nhóm từ → trang chủ
// không kèm vào link; trang quiz mở với ?on=sai mà URL chưa ghi cấp / nhóm thì chọn nơi có NHIỀU câu sai nhất (bảng tra
// nhỏ nhúng lúc build ở chính trang đó — trang chủ giữ nhẹ). Hòa → theo thứ tự `order`.

/** Khóa xuất hiện nhiều nhất; hòa → khóa đứng trước trong `order`; rỗng → null. */
export function mostCommon<T extends string>(keys: readonly T[], order: readonly T[]): T | null {
  const n = new Map<T, number>();
  for (const k of keys) n.set(k, (n.get(k) ?? 0) + 1);
  let best: T | null = null;
  for (const k of order) if ((n.get(k) ?? 0) > 0 && (best === null || n.get(k)! > n.get(best)!)) best = k;
  return best;
}

export type ConjScope = `${"verb" | "adj-i" | "adj-na"}|${"minna" | "n3"}`;
const CONJ_SCOPES: readonly ConjScope[] = ["verb|minna", "adj-i|minna", "adj-na|minna", "verb|n3", "adj-i|n3", "adj-na|n3"];

/**
 * Nhóm từ + sách có nhiều câu sai chia thể nhất. `adj`: vocab_id → nhóm cho tính từ (không có = động từ); sách theo
 * tiền tố ID (`n3-` = N3). Không có câu sai chia thể → null.
 */
export function pickConjScope(ids: readonly string[], adj: Readonly<Record<string, "adj-i" | "adj-na">>): ConjScope | null {
  const conjKinds = new Set<string>(Object.values(CONJ_KINDS));
  const keys = ids
    .filter((id) => conjKinds.has(kindOfId(id)))
    .map((id) => {
      const vid = id.split(":")[1] ?? "";
      return `${adj[vid] ?? "verb"}|${vid.startsWith("n3-") ? "n3" : "minna"}` as ConjScope;
    });
  return mostCommon(keys, CONJ_SCOPES);
}

/** Chữ Hán của câu Kanji (`k-hv:k-日`, `k-read:k-日:日本` → 日); câu khác → null. */
export function kanjiCharOfId(id: string): string | null {
  if (!(Object.values(KANJI_KINDS) as string[]).includes(kindOfId(id))) return null;
  const k = id.split(":")[1] ?? "";
  return k.startsWith("k-") ? k.slice(2) : null;
}

/** Cấp có nhiều câu sai Kanji nhất. `levels`: cấp → chuỗi các chữ thuộc cấp đó (một chữ có thể ở nhiều cấp). */
export function pickKanjiLevel(ids: readonly string[], levels: Readonly<Record<VocabLevel, string>>): VocabLevel | null {
  const keys: VocabLevel[] = [];
  for (const id of ids) {
    const c = kanjiCharOfId(id);
    if (c) for (const l of ["n5", "n4", "n3"] as const) if (levels[l].includes(c)) keys.push(l);
  }
  return mostCommon(keys, ["n5", "n4", "n3"]);
}
