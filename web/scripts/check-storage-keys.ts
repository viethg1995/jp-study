// Gate: key localStorage (CLAUDE.md luật 7).
//  E1  `localStorage` / `sessionStorage` chỉ được dùng trong src/lib/storage.ts (mọi nơi khác gọi qua module này).
//  E2  Trong storage.ts, key literal truyền thẳng vào getItem/setItem/removeItem phải có prefix `jp:`.
//  E3  Mọi chuỗi `jp:…` trong src/ phải được đăng ký trong bảng "## localStorage" ở .claude/rules/web.md.
//      Template `jp:srs:${id}` ↔ bảng `jp:srs:{id}` (phần biến so như ký tự đại diện).
//  W   Key có trong bảng nhưng không còn dùng.
// Chạy: npm run check:storage  (exit 1 nếu có lỗi E)
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const webDir = fileURLToPath(new URL("..", import.meta.url));
const srcDir = join(webDir, "src");
const registryFile = join(webDir, "..", ".claude", "rules", "web.md");
const STORAGE_MODULE = ["src", "lib", "storage.ts"].join(sep);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = join(dir, d.name);
    if (d.isDirectory()) return walk(p);
    return /\.(ts|tsx|js|mjs|jsx|astro)$/.test(d.name) ? [p] : [];
  });
}

const wildcard = (key: string): string => key.replace(/\$\{[^}]*\}/g, "*").replace(/\{[^}]*\}/g, "*");

function readRegistry(): Set<string> {
  const text = readFileSync(registryFile, "utf-8");
  const section = text.split(/^## localStorage\s*$/m)[1]?.split(/^## /m)[0] ?? "";
  const keys = new Set<string>();
  for (const line of section.split("\n")) {
    const m = /^\|\s*`(jp:[^`]+)`\s*\|/.exec(line);
    if (m) keys.add(wildcard(m[1]));
  }
  return keys;
}

const errors: string[] = [];
const used = new Map<string, string>(); // key (wildcard) → nơi dùng đầu tiên

for (const file of walk(srcDir)) {
  const rel = relative(webDir, file);
  const text = readFileSync(file, "utf-8");
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    const at = `${rel}:${i + 1}`;
    if (/\b(localStorage|sessionStorage)\b/.test(line) && rel !== STORAGE_MODULE && !/^\s*(\/\/|\*)/.test(line)) {
      errors.push(`E1 ${at}: dùng storage trực tiếp — gọi qua src/lib/storage.ts`);
    }
    if (rel === STORAGE_MODULE) {
      for (const m of line.matchAll(/(?:get|set|remove)Item\(\s*(["'`])([^"'`]*)\1/g)) {
        if (!m[2].startsWith("jp:")) errors.push(`E2 ${at}: key "${m[2]}" thiếu prefix jp:`);
      }
    }
    for (const m of line.matchAll(/(["'`])(jp:[^"'`\s]*)\1/g)) {
      const key = wildcard(m[2]);
      if (!used.has(key)) used.set(key, at);
    }
  });
}

const registry = readRegistry();
for (const [key, at] of used) {
  if (!registry.has(key)) errors.push(`E3 ${at}: key "${key}" chưa đăng ký trong .claude/rules/web.md (## localStorage)`);
}
for (const key of registry) {
  if (!used.has(key)) console.warn(`W  key "${key}" có trong bảng nhưng không thấy dùng trong src/`);
}

if (errors.length) {
  for (const e of errors) console.error(e);
  console.error(`\n${errors.length} lỗi key localStorage.`);
  process.exit(1);
}
console.log(`✓ localStorage: ${used.size} key, tất cả đã đăng ký`);
