// Content collections — schema zod nằm ở ./lib/schemas.ts (đồng bộ với pipeline/jp_pipeline/schemas.py).
import { defineCollection } from "astro:content";
import { file, glob } from "astro/loaders";
import { z } from "astro/zod";
import {
  CONJ_SCHEMA_VERSION,
  KANJI_SCHEMA_VERSION,
  conjEntry,
  conjFormDef,
  conjGroupDef,
  kanjiEntry,
  kanjiStrokes,
  radical,
  vocabLesson,
} from "./lib/schemas.ts";

export { POS_CODES, SCHEMA_VERSION, KANJI_SCHEMA_VERSION } from "./lib/schemas.ts";
export type { ConjEntry, ConjFormDef, ConjGroup, ConjGroupDef, ConjKind, ConjValue } from "./lib/schemas.ts";
export type { VocabEntry, VocabExample, VocabSense, KanjiComponent, KanjiEntry, KanjiExample, KanjiStroke, KanjiStrokes, Radical } from "./lib/schemas.ts";

const vocabulary = defineCollection({
  loader: glob({ pattern: "lesson-*.json", base: "../data/vocabulary" }),
  schema: vocabLesson,
});
// Từ vựng N3 (sách N3 準備 文字語彙, 14 bài) — cùng schema, book = "n3"
const vocabularyN3 = defineCollection({
  loader: glob({ pattern: "lesson-*.json", base: "../data/vocabulary/n3" }),
  schema: vocabLesson,
});

function unwrap(key: "kanji" | "radicals" | "strokes") {
  return (text: string): Record<string, unknown>[] | Record<string, Record<string, unknown>> => {
    const doc = JSON.parse(text) as { schema_version: number } & Record<string, Record<string, unknown>[]>;
    if (doc.schema_version !== KANJI_SCHEMA_VERSION) {
      throw new Error(`${key}: schema_version ${doc.schema_version} ≠ ${KANJI_SCHEMA_VERSION}`);
    }
    const items = doc[key === "strokes" ? "kanji" : key] ?? [];
    // bộ thủ không có trường id → dùng số thứ tự làm khóa
    return key === "radicals" ? Object.fromEntries(items.map((r) => [String(r.number), r])) : items;
  };
}

const kanji = defineCollection({
  loader: file("../data/kanji/kanji.json", { parser: unwrap("kanji") }),
  schema: kanjiEntry,
});
const radicals = defineCollection({
  loader: file("../data/kanji/radicals.json", { parser: unwrap("radicals") }),
  schema: radical,
});

// Nét viết KanjiVG — tách khỏi kanji.json (≈2,5 MB), chỉ trang /kanji/字/ dùng
const strokes = defineCollection({
  loader: file("../data/kanji/strokes.json", { parser: unwrap("strokes") }),
  schema: kanjiStrokes,
});

// Chia thể — 1 file, tách 3 collection: nhóm, định nghĩa thể (khóa nhóm:thể), từ (khóa vocab_id)
function conj(key: "groups" | "forms" | "entries") {
  return (text: string): Record<string, Record<string, unknown>> => {
    const doc = JSON.parse(text) as { schema_version: number } & Record<string, Record<string, unknown>[]>;
    if (doc.schema_version !== CONJ_SCHEMA_VERSION) {
      throw new Error(`conjugation: schema_version ${doc.schema_version} ≠ ${CONJ_SCHEMA_VERSION}`);
    }
    const id = (x: Record<string, unknown>): string =>
      key === "forms" ? `${String(x.group)}:${String(x.id)}` : key === "entries" ? String(x.vocab_id) : String(x.id);
    return Object.fromEntries((doc[key] ?? []).map((x, i) => [id(x), { ...x, order: i }]));
  };
}
const conjGroups = defineCollection({
  loader: file("../data/conjugation.json", { parser: conj("groups") }),
  schema: conjGroupDef.extend({ order: z.number().int() }),
});
const conjForms = defineCollection({
  loader: file("../data/conjugation.json", { parser: conj("forms") }),
  schema: conjFormDef.extend({ order: z.number().int() }),
});
const conjEntries = defineCollection({
  loader: file("../data/conjugation.json", { parser: conj("entries") }),
  schema: conjEntry.extend({ order: z.number().int() }),
});

export const collections = { vocabulary, vocabularyN3, kanji, radicals, strokes, conjGroups, conjForms, conjEntries };
