// Đọc data/*.json cho test — cùng schema zod với content collection (content.config.ts),
// nhưng không đi qua astro:content nên chạy được bằng `node --test`.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type Counter, counterFile, type VocabEntry, vocabLesson } from "../lib/schemas.ts";

const DATA = fileURLToPath(new URL("../../../data/", import.meta.url));

function readJson(rel: string): unknown {
  return JSON.parse(readFileSync(DATA + rel, "utf-8"));
}

/** Trợ số từ theo thứ tự trong file — giống collection `counterItems` (thêm `order`). */
export function loadCounters(): (Counter & { order: number })[] {
  return counterFile.parse(readJson("counters.json")).counters.map((c, order) => ({ ...c, order }));
}

/** Toàn bộ từ vựng Minna (data/vocabulary/lesson-*.json) + N3 (data/vocabulary/n3/), như collection vocabulary + vocabularyN3. */
export function loadVocab(): VocabEntry[] {
  const out: VocabEntry[] = [];
  for (const dir of ["vocabulary/", "vocabulary/n3/"]) {
    const files = readdirSync(DATA + dir).filter((f) => /^lesson-\d+\.json$/.test(f)).sort();
    for (const f of files) out.push(...vocabLesson.parse(readJson(dir + f)).entries);
  }
  return out;
}
