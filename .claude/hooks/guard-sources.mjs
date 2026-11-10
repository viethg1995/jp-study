#!/usr/bin/env node
// PreToolUse guard — chặn AI đọc trực tiếp tài liệu gốc trong sources/ (tốn token + bản quyền).
// AI phải đi qua pipeline: score-pdf → extract-pdf → status / show / export-queue.
// Exit 2 = chặn tool call, stderr được gửi lại cho Claude làm lý do.

import { readFileSync, statSync } from "node:fs";

const BINARY_EXT = /\.(pdf|mp3|m4a|mp4|wav|zip|rar|7z|skill|xlsx)$/i;
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i;
const BIG_MD_BYTES = 40_000;

const HINT =
  "Dùng pipeline thay thế (cd pipeline):\n" +
  "  .venv/Scripts/python -I -m jp_pipeline status                      # tóm tắt route mọi PDF\n" +
  '  .venv/Scripts/python -I -m jp_pipeline show "<tên>" --page 21      # đọc vài trang đã trích\n' +
  '  .venv/Scripts/python -I -m jp_pipeline export-queue "<tên>"        # ảnh trang cho AI (cần user duyệt)';

function block(reason) {
  process.stderr.write(`[guard-sources] CHẶN: ${reason}\n${HINT}\n`);
  process.exit(2);
}

const norm = (p) => String(p ?? "").replace(/\\/g, "/").toLowerCase();
const inSources = (p) => /(^|\/)sources(\/|$)/.test(norm(p));

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0); // không parse được input → không can thiệp
}
const tool = input.tool_name ?? "";
const ti = input.tool_input ?? {};

if (tool === "Read") {
  const p = norm(ti.file_path);
  if (inSources(p)) {
    if (BINARY_EXT.test(p)) block(`không đọc trực tiếp file gốc: ${ti.file_path}`);
    if (IMAGE_EXT.test(p) && !p.includes("/ai_queue/"))
      block(`chỉ được xem ảnh trong ai_queue/ (đã qua export-queue): ${ti.file_path}`);
    if (p.endsWith("/content.md") && ti.limit === undefined) {
      let size = 0;
      try {
        size = statSync(ti.file_path).size;
      } catch {}
      if (size > BIG_MD_BYTES)
        block(`content.md ${Math.round(size / 1024)}KB — không đọc cả file, dùng "show --page".`);
    }
  }
}

if (tool === "Grep") {
  const target = `${norm(ti.path)} ${norm(ti.glob)} ${norm(ti.type)}`;
  if (inSources(ti.path) && /pdf/.test(target)) block("không grep vào PDF trong sources/.");
}

if (tool === "Bash" || tool === "PowerShell") {
  const cmd = norm(ti.command);
  const viaPipeline = cmd.includes("jp_pipeline");
  if (!viaPipeline && /\.(pdf)\b/.test(cmd))
    block("lệnh shell chạm tới file .pdf ngoài jp_pipeline.");
  if (!viaPipeline && /(cat|type|get-content|less|more)\s[^|;&]*content\.md/.test(cmd))
    block("không in cả content.md ra console — dùng \"show --page\".");
}

process.exit(0);
