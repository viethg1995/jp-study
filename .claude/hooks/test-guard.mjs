// Kiểm thử guard-sources.mjs: node .claude/hooks/test-guard.mjs
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const hook = join(here, "guard-sources.mjs");
const root = join(here, "..", "..").replace(/\\/g, "/");
const P = "." + "pdf"; // tránh chuỗi đuôi PDF trong lệnh shell gọi file này

const cases = [
  ["Read", { file_path: "D:\\VietH\\JP\\sources\\books\\N5\\x" + P }, 2, "Read PDF (đường dẫn \\)"],
  ["Read", { file_path: `${root}/sources/kanji/a${P}` }, 2, "Read PDF (đường dẫn /)"],
  ["Read", { file_path: `${root}/sources/audio/N5/a.mp3` }, 2, "Read audio"],
  ["Read", { file_path: `${root}/sources/_extracted/x/images/a.png` }, 2, "Read ảnh ngoài ai_queue"],
  ["Read", { file_path: `${root}/sources/_extracted/x/ai_queue/p0021.png` }, 0, "Read ảnh trong ai_queue"],
  ["Read", { file_path: `${root}/sources/_extracted/books/N5/Nhập môn/content.md` }, 2, "Read content.md lớn, không limit"],
  ["Read", { file_path: `${root}/sources/_extracted/books/N5/Nhập môn/content.md`, limit: 50 }, 0, "Read content.md có limit"],
  ["Read", { file_path: `${root}/sources/vocabulary/bai_1.json` }, 0, "Read JSON từ vựng"],
  ["Read", { file_path: `${root}/CLAUDE.md` }, 0, "Read file ngoài sources"],
  ["Grep", { pattern: "x", path: `${root}/sources`, glob: "*" + P }, 2, "Grep vào PDF"],
  ["Grep", { pattern: "x", path: `${root}/sources/vocabulary` }, 0, "Grep JSON"],
  ["Bash", { command: `python -c "import fitz; fitz.open('a${P}')"` }, 2, "Bash mở PDF"],
  ["Bash", { command: `.venv/Scripts/python -I -m jp_pipeline extract-pdf --only a${P}` }, 0, "Bash qua jp_pipeline"],
  ["Bash", { command: "cat sources/_extracted/a/content.md" }, 2, "cat content.md"],
  ["PowerShell", { command: "Get-Content sources/_extracted/a/content.md" }, 2, "Get-Content content.md"],
  ["Bash", { command: "ls sources" }, 0, "ls"],
];

let fail = 0;
for (const [tool_name, tool_input, want, label] of cases) {
  const r = spawnSync("node", [hook], { input: JSON.stringify({ tool_name, tool_input }) });
  const ok = r.status === want;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  exit=${r.status} want=${want}  ${label}`);
}
console.log(fail ? `\n${fail} FAIL` : "\nTất cả PASS");
process.exit(fail ? 1 : 0);
