// Gate: chỉ dùng design token (src/styles/tokens.css), không dùng màu thô.
//  E1  Class màu của bảng Tailwind mặc định (text-red-500, bg-stone-100, border-sky-200…) trong src/.
//  E2  Mã màu hex / rgb() / hsl() viết thẳng ngoài src/styles/tokens.css.
// Chạy: npm run check:tokens  (exit 1 nếu có lỗi)
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const webDir = fileURLToPath(new URL("..", import.meta.url));
const srcDir = join(webDir, "src");
const TOKENS_FILE = join(srcDir, "styles", "tokens.css");

const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const RAW_CLASS = new RegExp(
  `\\b(?:text|bg|border|ring|outline|fill|stroke|accent|decoration|from|via|to|divide|shadow)-(?:${PALETTE})-\\d{2,3}\\b`,
  "g",
);
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/g;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = join(dir, d.name);
    if (d.isDirectory()) return walk(p);
    return /\.(astro|ts|tsx|css)$/.test(d.name) ? [p] : [];
  });
}

const errors: string[] = [];
for (const file of walk(srcDir)) {
  if (file === TOKENS_FILE) continue;
  const lines = readFileSync(file, "utf-8").split(/\r?\n/);
  lines.forEach((line, i) => {
    const where = `${relative(webDir, file)}:${i + 1}`;
    for (const m of line.matchAll(RAW_CLASS)) errors.push(`E1 ${where}: màu thô "${m[0]}" → dùng token (text-ink, bg-primary-soft…)`);
    if (/\.(astro|css)$/.test(file) && !line.trim().startsWith("//")) {
      for (const m of line.matchAll(RAW_COLOR)) errors.push(`E2 ${where}: mã màu "${m[0]}" → khai báo trong tokens.css`);
    }
  });
}

if (errors.length) {
  console.error(errors.join("\n"));
  console.error(`\ncheck:tokens FAIL — ${errors.length} lỗi`);
  process.exit(1);
}
console.log("check:tokens OK");
