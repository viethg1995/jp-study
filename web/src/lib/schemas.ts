// Schema zod của dữ liệu data/ — ĐỒNG BỘ với pipeline/jp_pipeline/schemas.py.
// Đổi schema → sửa CẢ HAI phía. Gate: `npm run check:schema` so file này với data/_schema/*.schema.json.
// File này chỉ được import "astro/zod" (không import astro:content) để chạy được bằng Node thuần.
import { z } from "astro/zod";

// ---------------------------------------------------------------- Từ vựng (VocabLesson)
export const SCHEMA_VERSION = 4; // v4: sách N3 (book, id n3-NNN, particle/transitivity/variants/antonyms/related)

// Phải khớp POS_LABELS trong schemas.py
export const POS_CODES = [
  "N", "PN", "Pro", "V1", "V2", "V3", "Ai", "An", "Adv", "Det", "Conj",
  "Int", "QW", "QP", "Pre", "Suf", "Cnt", "Phr", "Conv", "Greet",
] as const;
const posCode = z
  .string()
  .refine((c) => c.split("/").every((p) => (POS_CODES as readonly string[]).includes(p)), "mã từ loại lạ");

const provenance = z
  .enum(["source", "jmdict", "derived", "unihan", "mixed", "ai-draft", "user", "none"])
  .nullable();
const reviewStatus = z.enum(["auto", "ai", "user"]);

export const vocabExample = z.object({
  id: z.string(),
  ruby: z.string(),
  vi: z.string(),
  max_lesson: z.number().int().min(1).max(50),
  source: z.enum(["ai-draft", "tatoeba", "user"]),
  review: reviewStatus,
});

export const vocabSense = z.object({
  text: z.string(),
  context: z.string().nullable(),
});

export const vocabEntry = z.object({
  id: z.string().regex(/^(mn-\d{2}-\d{3}|n3-\d{3})$/),
  legacy_id: z.string(),
  book: z.enum(["minna", "n3"]).default("minna"),
  lesson: z.number().int().min(1).max(50),
  kana: z.string().min(1),
  kanji: z.string().regex(/[㐀-䶿一-鿿豈-﫿々]/u).nullable(), // phải có chữ Hán
  display: z.enum(["kanji", "kana"]),
  han_viet: z.string().nullable(),
  meaning_vi: z.string().min(1),
  senses: z.array(vocabSense),
  pos: z.object({ code: posCode, label: z.string() }),
  kanji_refs: z.array(z.string()),
  same_word: z.array(z.string().regex(/^(mn-\d{2}-\d{3}|n3-\d{3})$/)), // liên kết cả Minna ↔ N3
  examples: z.array(vocabExample),
  particle: z.string().nullable().default(null),
  transitivity: z.string().nullable().default(null),
  variants: z.array(z.string()).default([]),
  antonyms: z.array(z.string()).default([]),
  related: z.array(z.string()).default([]),
  provenance: z.object({
    kanji: provenance,
    han_viet: provenance,
    pos: z.enum(["source", "jmdict", "ai-draft", "user"]),
    meaning: z.enum(["source", "ai-draft", "user"]),
  }),
  review: reviewStatus,
});

export const vocabLesson = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  book: z.enum(["minna", "n3"]).default("minna"),
  lesson: z.number().int().min(1).max(50),
  entries: z.array(vocabEntry),
});

// ---------------------------------------------------------------- Kanji & bộ thủ (KanjiFile / RadicalFile)
export const KANJI_SCHEMA_VERSION = 8; // v8: n3_lessons; v7: story (mẹo nhớ), components (thành phần KanjiVG)

export const kanjiExample = z.object({
  word: z.string().min(1),
  kana: z.string().min(1),
  reading_type: z.enum(["on", "kun"]).nullable(),
  reading: z.string().nullable(),
  meaning_vi: z.string().nullable(),
  meaning_vi_source: z.enum(["vocab", "ai-draft", "user"]).nullable(),
  meaning_en: z.string().nullable(),
  vocab_id: z.string().regex(/^(mn-\d{2}-\d{3}|n3-\d{3})$/).nullable(),
  source: z.enum(["vocab", "jmdict"]),
});

export const kanjiLessonRef = z.object({
  lesson: z.number().int().min(1).max(50),
  order: z.number().int().min(1).max(20),
});

export const kanjiEntry = z.object({
  id: z.string().regex(/^k-.$/u),
  char: z.string().length(1),
  han_viet: z.array(z.string()),
  han_viet_source: z.enum(["vocab", "n3book", "ai-draft", "user", "unihan"]).nullable(),
  meaning_vi: z.string().nullable(),
  meaning_vi_source: z.enum(["ai-draft", "user"]).nullable(),
  meanings_en: z.array(z.string()),
  on: z.array(z.string()),
  kun: z.array(z.string()),
  strokes: z.number().int().nullable(),
  grade: z.number().int().nullable(),
  jlpt_old: z.number().int().nullable(),
  radical: z.number().int().min(1).max(214).nullable(),
  first_lesson: z.number().int().min(1).max(50).nullable(),
  n3_lesson: z.number().int().min(1).max(50).nullable().default(null),
  n4_lesson: z.number().int().min(1).max(50).nullable().default(null),
  n5_lesson: z.number().int().min(1).max(50).nullable().default(null),
  n4_order: z.number().int().min(1).max(20).nullable().default(null),
  n5_order: z.number().int().min(1).max(20).nullable().default(null),
  n3_lessons: z.array(kanjiLessonRef).default([]),
  vocab_refs: z.array(z.string().regex(/^(mn-\d{2}-\d{3}|n3-\d{3})$/)),
  examples: z.array(kanjiExample).default([]),
  story: z.string().nullable().default(null),
  story_source: z.enum(["ai-draft", "user"]).nullable().default(null),
});

export const radical = z.object({
  number: z.number().int().min(1).max(214),
  char: z.string(),
  variants: z.array(z.string()),
  strokes: z.number().int().min(1).max(17),
  name_vi: z.string(),
  meaning_vi: z.string().nullable(),
});

// Lớp vỏ file — content collection chỉ nạp mảng bên trong, nhưng gate cần so cả vỏ.
export const kanjiFile = z.object({
  schema_version: z.literal(KANJI_SCHEMA_VERSION),
  kanji: z.array(kanjiEntry),
});
export const radicalFile = z.object({
  schema_version: z.literal(KANJI_SCHEMA_VERSION),
  source: z.string(),
  radicals: z.array(radical),
});

// Nét viết KanjiVG (CC BY-SA 3.0) — data/kanji/strokes.json, viewBox 0 0 109 109
export const kanjiStroke = z.object({
  d: z.string().min(1),
  type: z.string().nullable(),
  num: z.array(z.number()).min(2).max(2),
});
export const kanjiComponent = z.object({
  char: z.string().min(1),
  original: z.string().nullable(),
  strokes: z.array(z.number().int()).min(1),
  name_vi: z.string().nullable(),
  meaning_vi: z.string().nullable(),
});
export const kanjiStrokes = z.object({
  id: z.string().regex(/^k-.$/u),
  char: z.string().length(1),
  strokes: z.array(kanjiStroke).min(1),
  components: z.array(kanjiComponent).default([]),
});
export const strokeFile = z.object({
  schema_version: z.literal(KANJI_SCHEMA_VERSION),
  source: z.string(),
  license: z.string(),
  kanji: z.array(kanjiStrokes),
});

// Chia thể — data/conjugation.json (gốc thể ます; quy tắc enrichment/conjugation/forms.json)
export const CONJ_SCHEMA_VERSION = 2; // v2: aliases
export const conjKind = z.enum(["V1", "V2", "V3", "Ai", "An", "N"]);
export const conjGroup = z.enum(["verb", "adj-i", "adj-na", "noun"]);
export const conjRule = z.object({
  kind: z.enum(["V", "V1", "V2", "V3", "Ai", "An", "N"]),
  text: z.string(),
  examples: z.array(z.string()),
});
export const conjFormDef = z.object({
  id: z.string(),
  group: conjGroup,
  name_vi: z.string(),
  name_ja: z.string(),
  lesson: z.number().int().min(1).max(50).nullable(),
  use_vi: z.string(),
  rules: z.array(conjRule),
});
export const conjGroupDef = z.object({
  id: conjGroup,
  name_vi: z.string(),
  intro_vi: z.array(z.string()),
});
export const conjValue = z.object({
  form: z.string(),
  kana: z.string(),
  ruby: z.string(),
  rule: z.string(),
  irregular: z.boolean(),
});
export const conjEntry = z.object({
  vocab_id: z.string().regex(/^(mn-\d{2}-\d{3}|n3-\d{3})$/),
  book: z.enum(["minna", "n3"]),
  lesson: z.number().int().min(1).max(50),
  kind: conjKind,
  kana: z.string(),
  ruby: z.string(),
  meaning_vi: z.string(),
  han_viet: z.string().nullable(),
  aliases: z.array(z.string().regex(/^(mn-\d{2}-\d{3}|n3-\d{3})$/)).default([]),
  forms: z.array(conjValue),
});
export const conjugationFile = z.object({
  schema_version: z.literal(CONJ_SCHEMA_VERSION),
  groups: z.array(conjGroupDef),
  forms: z.array(conjFormDef),
  entries: z.array(conjEntry),
});

export type ConjKind = z.infer<typeof conjKind>;
export type ConjGroup = z.infer<typeof conjGroup>;
export type ConjFormDef = z.infer<typeof conjFormDef>;
export type ConjGroupDef = z.infer<typeof conjGroupDef>;
export type ConjEntry = z.infer<typeof conjEntry>;
export type ConjValue = z.infer<typeof conjValue>;
export type ConjugationFile = z.infer<typeof conjugationFile>;

export type VocabEntry = z.infer<typeof vocabEntry>;
export type VocabSense = z.infer<typeof vocabSense>;
export type VocabExample = z.infer<typeof vocabExample>;
export type KanjiEntry = z.infer<typeof kanjiEntry>;
export type Radical = z.infer<typeof radical>;
export type KanjiStroke = z.infer<typeof kanjiStroke>;
export type KanjiStrokes = z.infer<typeof kanjiStrokes>;
export type KanjiExample = z.infer<typeof kanjiExample>;
export type KanjiComponent = z.infer<typeof kanjiComponent>;

// Số đếm & trợ số từ — data/counters.json (bảng cách đọc ghi cứng ở pipeline/enrichment/counters/)
export const COUNTER_SCHEMA_VERSION = 2; // v2: số đếm chia tab, display chuỗi
export const soundGroup = z.enum(["h", "k", "s", "t", "none", "native", "special"]);
export const counterCategory = z.enum([
  "general", "people", "animals", "objects", "place", "time", "date", "frequency", "money", "age", "order",
]);
export const counterReading = z.object({
  n: z.number().int().min(1),
  kana: z.string(),
  alt: z.array(z.string()),
  irregular: z.boolean(),
  note: z.string().nullable(),
});
export const counterQuestion = z.object({
  kana: z.string(),
  alt: z.array(z.string()),
  note: z.string().nullable(),
});
export const counterExample = z.object({
  id: z.string(),
  ruby: z.string(),
  vi: z.string(),
  source: z.enum(["ai-draft", "user"]),
  review: reviewStatus,
});
export const numberReading = z.object({
  display: z.string(),
  kanji: z.string(),
  kana: z.string(),
  alt: z.array(z.string()),
  irregular: z.boolean(),
  note: z.string().nullable(),
});
export const numberSection = z.object({
  id: z.string(),
  title_vi: z.string(),
  intro_vi: z.array(z.string()),
  items: z.array(numberReading),
});
export const numberTab = z.object({
  id: z.string(),
  label: z.string(),
  sections: z.array(numberSection),
  examples: z.array(counterExample),
});
export const numberSystem = z.object({
  intro_vi: z.array(z.string()),
  tabs: z.array(numberTab),
});
export const soundRule = z.object({
  group: soundGroup,
  name_vi: z.string(),
  summary_vi: z.string(),
  rule_vi: z.array(z.string()),
  counters: z.array(z.string()),
});
export const counter = z.object({
  id: z.string().regex(/^c-[a-z0-9]+(-[a-z0-9]+)*$/),
  char: z.string(),
  kana: z.string(),
  name_vi: z.string(),
  use_vi: z.string(),
  items_vi: z.array(z.string()),
  category: counterCategory,
  lesson: z.number().int().min(1).max(50).nullable(),
  vocab_refs: z.array(z.string()),
  kanji_refs: z.array(z.string()),
  sound_group: soundGroup,
  sound_note_vi: z.string(),
  readings: z.array(counterReading),
  question: counterQuestion,
  large_vi: z.array(z.string()),
  notes_vi: z.array(z.string()),
  examples: z.array(counterExample).min(10),
});
export const counterFile = z.object({
  schema_version: z.literal(COUNTER_SCHEMA_VERSION),
  numbers: numberSystem,
  sound_rules: z.array(soundRule),
  counters: z.array(counter),
});

export type SoundGroup = z.infer<typeof soundGroup>;
export type CounterReading = z.infer<typeof counterReading>;
export type CounterExample = z.infer<typeof counterExample>;
export type NumberSection = z.infer<typeof numberSection>;
export type NumberTab = z.infer<typeof numberTab>;
export type NumberSystem = z.infer<typeof numberSystem>;
export type SoundRule = z.infer<typeof soundRule>;
export type Counter = z.infer<typeof counter>;
export type CounterFile = z.infer<typeof counterFile>;

// ---------------------------------------------------------------- Luyện dịch (TranslationFile)
export const TRANSLATION_SCHEMA_VERSION = 1;

export const translationSentence = z.object({
  prompt: z.string().min(1),
  references: z.array(z.string()).min(1),
  note_vi: z.string().nullable(),
});

export const translationExercise = z.object({
  id: z.string().regex(/^t-\d{2}-\d{2}$/),
  lesson: z.number().int().min(1).max(50),
  title_vi: z.string().min(1),
  prompt_lang: z.enum(["vi", "en"]),
  focus_vi: z.array(z.string()),
  grammar_refs: z.array(z.string()),
  sentences: z.array(translationSentence).min(1).max(12),
  source: z.enum(["ai-draft", "user"]),
  review: reviewStatus,
});

export const translationFile = z.object({
  schema_version: z.literal(TRANSLATION_SCHEMA_VERSION),
  exercises: z.array(translationExercise),
});

export type TranslationSentence = z.infer<typeof translationSentence>;
export type TranslationExercise = z.infer<typeof translationExercise>;
export type TranslationFile = z.infer<typeof translationFile>;
