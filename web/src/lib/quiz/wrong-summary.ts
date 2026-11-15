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
