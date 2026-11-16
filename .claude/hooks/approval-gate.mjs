#!/usr/bin/env node
// Approval gate — Claude chỉ được sửa file sau khi user chat "APPLY" hoặc "đồng ý".
//
// Một script, xử lý 3 sự kiện hook:
//   UserPromptSubmit          → mỗi tin nhắn mới của user: đặt lại cờ duyệt (true nếu có từ khóa, false nếu không)
//   PostToolUse AskUserQuestion → user chọn/gõ đáp án "APPLY"/"đồng ý" trong hộp hỏi → bật cờ
//   PreToolUse Edit|Write|NotebookEdit|Bash|PowerShell → chưa duyệt mà sửa file → exit 2 (CHẶN)
//
// Phạm vi duyệt: từ tin nhắn có từ khóa tới tin nhắn kế tiếp của user (một lượt).
// Cờ lưu ở thư mục tạm của OS theo session_id, không nằm trong repo.

import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, relative, isAbsolute } from "node:path";

// ---- Từ khóa duyệt ---------------------------------------------------------
// "APPLY" phải viết HOA (tránh nhầm với từ "apply" trong câu thường).
// "đồng ý" / "dong y" không phân biệt hoa thường, nhưng không tính khi đứng sau phủ định.
const APPLY_RE = /(^|[^A-Za-z])APPLY([^A-Za-z]|$)/;
const AGREE_RE = /(^|[^\p{L}])(đồng ý|dong y)([^\p{L}]|$)/iu;
const NEGATED_AGREE_RE = /(không|khong|chưa|chua|ko|k|đừng|dung)\s+(đồng ý|dong y)/iu;

export function isApproval(text) {
  const s = String(text ?? "").normalize("NFC");
  if (APPLY_RE.test(s)) return true;
  if (AGREE_RE.test(s) && !NEGATED_AGREE_RE.test(s)) return true;
  return false;
}

// ---- Nhận diện lệnh shell có sửa file ----------------------------------------
// jp_pipeline: lệnh chỉ đọc thì cho qua, còn lại (build, apply-*, extract-*...) đều ghi file.
const PIPELINE_READONLY = new Set([
  "check", "status", "show", "check-passages", "check-n3-examples",
  "check-examples", "inspect-zip", "layout-dump",
]);

const SHELL_WRITE_PATTERNS = [
  // redirect ra file: >, >> (bỏ qua 2>&1, >/dev/null, >$null, >nul, =>, ->)
  [/(^|[^0-9&=\-<>])>{1,2}(?!\s*(&|\/dev\/null|\$null\b|nul\b))/, "redirect > ra file"],
  [/(^|[\s;&|(])(sed|perl)\s+(-[a-z]*\s+)*-i/, "sed/perl -i"],
  [/(^|[\s;&|(])(tee|rm|rmdir|mv|cp|mkdir|touch|truncate|dd|ln|unlink|chmod|install)\s/, "lệnh shell ghi/xóa file"],
  [/(^|[\s;&|(])(set-content|add-content|out-file|new-item|remove-item|move-item|copy-item|rename-item|clear-content|ni|del|erase|ren|move|copy|rd|md)\s/, "lệnh PowerShell ghi/xóa file"],
  [/\[(system\.)?io\.(file|directory)\]::(write|append|create|delete|move|copy)/, "[IO.File] ghi file"],
  [/\bgit\s+(-c\s+\S+\s+)*(add|commit|checkout|switch|restore|reset|revert|stash|merge|rebase|cherry-pick|apply|am|pull|push|rm|mv|clean|tag|branch\s+-[dDmM])\b/, "git thay đổi working tree/repo"],
  [/\b(npm|pnpm|yarn)\s+(i|install|add|remove|uninstall|update|ci|init)\b/, "cài/gỡ package"],
  [/\bpip\s+(install|uninstall)\b/, "cài/gỡ package"],
  [/--write\b|--fix\b/, "công cụ tự sửa file (--write/--fix)"],
  [/write_text|write_bytes|\.write\(|writefilesync|appendfilesync|open\([^)]*['"][wax]\+?b?['"]/, "script ghi file"],
];

export function shellWriteReason(command) {
  const cmd = String(command ?? "").toLowerCase();
  const m = cmd.match(/jp_pipeline\s+([a-z0-9-]+)/);
  if (m && !PIPELINE_READONLY.has(m[1])) return `jp_pipeline ${m[1]} (ghi data/)`;
  for (const [re, why] of SHELL_WRITE_PATTERNS) if (re.test(cmd)) return why;
  return null;
}

// ---- Trạng thái duyệt (theo session) ----------------------------------------
export const stateFile = (sid) => join(tmpdir(), `claude-approval-${String(sid || "default").replace(/[^\w-]/g, "_")}.json`);

function setApproved(sid, approved, via) {
  try {
    writeFileSync(stateFile(sid), JSON.stringify({ approved, via, at: new Date().toISOString() }), "utf8");
  } catch {}
}

function isApproved(sid) {
  try {
    return JSON.parse(readFileSync(stateFile(sid), "utf8")).approved === true;
  } catch {
    return false;
  }
}

// File ngoài dự án (scratchpad, memory của Claude) không thuộc phạm vi gate.
function insideProject(filePath, cwd) {
  if (!filePath) return true;
  const root = resolve(process.env.CLAUDE_PROJECT_DIR || cwd || process.cwd());
  const abs = resolve(root, filePath);
  const rel = relative(root, abs);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function block(reason) {
  process.stderr.write(
    `[approval-gate] CHẶN: ${reason}\n` +
      "Luật dự án: chỉ sửa file khi user đã chat \"APPLY\" hoặc \"đồng ý\" trong tin nhắn gần nhất.\n" +
      "Hãy dừng lại, trình bày thay đổi dự định (file nào, sửa gì) và hỏi user xác nhận " +
      "(gợi ý dùng AskUserQuestion với lựa chọn \"APPLY\"). Không tìm cách lách gate.\n",
  );
  process.exit(2);
}

// ---- Main -------------------------------------------------------------------
function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    process.exit(0);
  }
  const event = input.hook_event_name ?? "";
  const sid = input.session_id;
  const tool = input.tool_name ?? "";
  const ti = input.tool_input ?? {};

  if (event === "UserPromptSubmit") {
    const ok = isApproval(input.prompt);
    setApproved(sid, ok, ok ? "prompt" : null);
    process.exit(0);
  }

  if (event === "PostToolUse" && tool === "AskUserQuestion") {
    const answers = { ...(ti.answers ?? {}), ...(input.tool_response?.answers ?? {}) };
    if (Object.values(answers).some(isApproval)) setApproved(sid, true, "ask-user-question");
    process.exit(0);
  }

  if (event === "PreToolUse") {
    if (isApproved(sid)) process.exit(0);
    if (tool === "Edit" || tool === "Write" || tool === "NotebookEdit") {
      const p = ti.file_path ?? ti.notebook_path;
      if (insideProject(p, input.cwd)) block(`${tool} ${p ?? ""} khi chưa được duyệt.`);
    }
    if (tool === "Bash" || tool === "PowerShell") {
      const why = shellWriteReason(ti.command);
      if (why) block(`lệnh ${tool} có sửa file (${why}) khi chưa được duyệt.`);
    }
  }
  process.exit(0);
}

// Cho phép test import hàm thuần mà không chạy main.
if (!process.env.APPROVAL_GATE_NO_MAIN) main();
