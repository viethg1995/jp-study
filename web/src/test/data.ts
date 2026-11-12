// Đọc data/*.json cho test — cùng schema zod với content collection (content.config.ts),
// nhưng không đi qua astro:content nên chạy được bằng `node --test`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type Counter, counterFile } from "../lib/schemas.ts";

const DATA = fileURLToPath(new URL("../../../data/", import.meta.url));

function readJson(rel: string): unknown {
  return JSON.parse(readFileSync(DATA + rel, "utf-8"));
}

/** Trợ số từ theo thứ tự trong file — giống collection `counterItems` (thêm `order`). */
export function loadCounters(): (Counter & { order: number })[] {
  return counterFile.parse(readJson("counters.json")).counters.map((c, order) => ({ ...c, order }));
}
