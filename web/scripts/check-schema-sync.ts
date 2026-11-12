// Gate: schema zod (web/src/lib/schemas.ts) phải khớp JSON Schema Pydantic (data/_schema/*.schema.json).
// So: tập trường, kiểu, nullable, giá trị enum/const, phần tử mảng. Không so ràng buộc (min/max/regex)
// vì Pydantic không xuất hết, và không so `required` (data luôn được dump đủ trường).
// Chạy: npm run check:schema  (exit 1 nếu lệch)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "astro/zod";
import { conjugationFile, counterFile, kanjiFile, radicalFile, strokeFile, translationFile, vocabLesson } from "../src/lib/schemas.ts";

type Json = Record<string, unknown>;
type Shape =
  | { kind: "string" | "integer" | "number" | "boolean"; nullable: boolean; default?: unknown }
  | { kind: "const"; nullable: boolean; value: unknown }
  | { kind: "enum"; nullable: boolean; values: string[] }
  | { kind: "array"; nullable: boolean; items: Shape }
  | { kind: "object"; nullable: boolean; props: Record<string, Shape> }
  | { kind: "unknown"; nullable: boolean; raw: string };

function normalize(node: Json, root: Json, nullable = false): Shape {
  const ref = node.$ref as string | undefined;
  if (ref) {
    const target = ref.replace(/^#\//, "").split("/").reduce<unknown>((o, k) => (o as Json)[k], root);
    return normalize(target as Json, root, nullable);
  }
  const anyOf = (node.anyOf ?? node.oneOf) as Json[] | undefined;
  if (anyOf) {
    const rest = anyOf.filter((n) => n.type !== "null");
    const isNull = rest.length < anyOf.length;
    if (rest.length === 1) return normalize(rest[0], root, nullable || isNull);
    return { kind: "unknown", nullable: nullable || isNull, raw: JSON.stringify(anyOf) };
  }
  let type = node.type as string | string[] | undefined;
  if (Array.isArray(type)) {
    if (type.includes("null")) nullable = true;
    const rest = type.filter((t) => t !== "null");
    type = rest.length === 1 ? rest[0] : undefined;
  }
  if (node.const !== undefined) return { kind: "const", nullable, value: node.const };
  if (Array.isArray(node.enum)) {
    const values = (node.enum as unknown[]).filter((v) => v !== null).map(String).sort();
    return { kind: "enum", nullable: nullable || (node.enum as unknown[]).includes(null), values };
  }
  switch (type) {
    case "object": {
      const props: Record<string, Shape> = {};
      for (const [k, v] of Object.entries((node.properties ?? {}) as Record<string, Json>)) {
        props[k] = normalize(v, root);
      }
      return { kind: "object", nullable, props };
    }
    case "array":
      return { kind: "array", nullable, items: normalize((node.items ?? {}) as Json, root) };
    case "string":
    case "integer":
    case "number":
    case "boolean":
      return { kind: type, nullable, default: node.default };
    default:
      return { kind: "unknown", nullable, raw: JSON.stringify(node) };
  }
}

function compare(py: Shape, zd: Shape, path: string, out: string[]): void {
  if (py.nullable !== zd.nullable) {
    out.push(`${path}: nullable — pydantic=${py.nullable}, zod=${zd.nullable}`);
  }
  // Pydantic xuất `schema_version: int = 2` thành {type: integer, default: 2}; zod dùng z.literal(2).
  if (zd.kind === "const" && (py.kind === "integer" || py.kind === "number")) {
    if (py.default !== zd.value) out.push(`${path}: const zod=${String(zd.value)} ≠ default pydantic=${String(py.default)}`);
    return;
  }
  if (py.kind !== zd.kind) {
    out.push(`${path}: kiểu — pydantic=${py.kind}, zod=${zd.kind}`);
    return;
  }
  if (py.kind === "const" && zd.kind === "const" && py.value !== zd.value) {
    out.push(`${path}: const — pydantic=${String(py.value)}, zod=${String(zd.value)}`);
  }
  if (py.kind === "enum" && zd.kind === "enum") {
    const a = py.values.join(","), b = zd.values.join(",");
    if (a !== b) out.push(`${path}: enum — pydantic=[${a}], zod=[${b}]`);
  }
  if (py.kind === "array" && zd.kind === "array") compare(py.items, zd.items, `${path}[]`, out);
  if (py.kind === "object" && zd.kind === "object") {
    for (const k of new Set([...Object.keys(py.props), ...Object.keys(zd.props)])) {
      const p = py.props[k], q = zd.props[k];
      if (!p) out.push(`${path}.${k}: có ở zod, thiếu ở pydantic`);
      else if (!q) out.push(`${path}.${k}: có ở pydantic, thiếu ở zod`);
      else compare(p, q, `${path}.${k}`, out);
    }
  }
  if (py.kind === "unknown" || zd.kind === "unknown") {
    out.push(`${path}: không chuẩn hóa được (pydantic=${JSON.stringify(py)}, zod=${JSON.stringify(zd)})`);
  }
}

const pairs: [string, z.ZodType][] = [
  ["vocabulary.schema.json", vocabLesson],
  ["kanji.schema.json", kanjiFile],
  ["radicals.schema.json", radicalFile],
  ["strokes.schema.json", strokeFile],
  ["conjugation.schema.json", conjugationFile],
  ["counters.schema.json", counterFile],
  ["translation.schema.json", translationFile],
];

let failed = 0;
for (const [file, schema] of pairs) {
  const url = new URL(`../../data/_schema/${file}`, import.meta.url);
  const pyJson = JSON.parse(readFileSync(fileURLToPath(url), "utf-8")) as Json;
  const zodJson = z.toJSONSchema(schema, { unrepresentable: "any" }) as Json;
  const diffs: string[] = [];
  compare(normalize(pyJson, pyJson), normalize(zodJson, zodJson), file.replace(".schema.json", ""), diffs);
  if (diffs.length) {
    failed += diffs.length;
    console.error(`✗ ${file}`);
    for (const d of diffs) console.error(`   ${d}`);
  } else {
    console.log(`✓ ${file}`);
  }
}
if (failed) {
  console.error(`\n${failed} chỗ lệch giữa web/src/lib/schemas.ts và pipeline/jp_pipeline/schemas.py — sửa CẢ HAI phía.`);
  process.exit(1);
}
