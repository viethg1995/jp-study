// Kiểm thử approval-gate.mjs: node .claude/hooks/test-approval-gate.mjs
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const hook = join(here, "approval-gate.mjs");
const root = join(here, "..", "..");
const SID = `test-${process.pid}`;

process.env.APPROVAL_GATE_NO_MAIN = "1";
const { stateFile } = await import(`file:///${hook.replace(/\\/g, "/")}`);
delete process.env.APPROVAL_GATE_NO_MAIN;

const run = (payload) =>
  spawnSync("node", [hook], {
    input: JSON.stringify({ session_id: SID, cwd: root, ...payload }),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
  }).status;

const prompt = (text) => run({ hook_event_name: "UserPromptSubmit", prompt: text });
const pre = (tool_name, tool_input) => run({ hook_event_name: "PreToolUse", tool_name, tool_input });
const ask = (answer) =>
  run({
    hook_event_name: "PostToolUse",
    tool_name: "AskUserQuestion",
    tool_input: { questions: [{ question: "Sửa file?", options: [{ label: "APPLY" }, { label: "Hủy" }] }], answers: { "Sửa file?": answer } },
    tool_response: {},
  });

const EDIT = ["Edit", { file_path: join(root, "CLAUDE.md"), old_string: "a", new_string: "b" }];
const cases = [];
const expect = (name, got, want) => cases.push([name, got, want]);

// 1. Chưa duyệt → chặn mọi kiểu sửa file
prompt("sửa giúp tôi lỗi chính tả trong CLAUDE.md");
expect("Edit khi chưa duyệt", pre(...EDIT), 2);
expect("Write khi chưa duyệt", pre("Write", { file_path: "web/src/x.ts", content: "" }), 2);
expect("Bash redirect", pre("Bash", { command: "echo hi > a.txt" }), 2);
expect("Bash sed -i", pre("Bash", { command: "sed -i 's/a/b/' x.md" }), 2);
expect("PowerShell Set-Content", pre("PowerShell", { command: "Set-Content x.txt 'a'" }), 2);
expect("git commit", pre("Bash", { command: 'git commit -m "x"' }), 2);
expect("jp_pipeline build", pre("Bash", { command: ".venv/Scripts/python -I -m jp_pipeline build" }), 2);
expect("python write_text", pre("Bash", { command: "python -c \"open('a','w').write('x')\"" }), 2);
// Lệnh chỉ đọc vẫn chạy được
expect("Bash 2>/dev/null | head", pre("Bash", { command: "ls sources 2>/dev/null | head" }), 0);
expect("Bash 2>&1", pre("Bash", { command: "npm run build 2>&1 | tail -5" }), 0);
expect("git status/diff", pre("Bash", { command: "git status && git diff --stat" }), 0);
expect("jp_pipeline status", pre("Bash", { command: ".venv/Scripts/python -I -m jp_pipeline status" }), 0);
expect("node -e arrow =>", pre("Bash", { command: "node -e \"[1].map(x => x)\"" }), 0);
expect("Write ngoài dự án (scratchpad)", pre("Write", { file_path: join(root, "..", "tmp-scratch", "a.txt"), content: "" }), 0);
expect("Read không bị gate", pre("Read", { file_path: join(root, "CLAUDE.md") }), 0);

// 2. Từ khóa duyệt
prompt("APPLY");
expect("Edit sau APPLY", pre(...EDIT), 0);
expect("git commit sau APPLY", pre("Bash", { command: 'git commit -m "x"' }), 0);
prompt("ok, tôi đồng ý phương án 2");
expect("Edit sau 'đồng ý'", pre(...EDIT), 0);
prompt("Đồng Ý");
expect("Edit sau 'Đồng Ý'", pre(...EDIT), 0);

// 3. Duyệt hết hiệu lực ở tin nhắn kế tiếp; phủ định / chữ thường không tính
prompt("thêm một câu hỏi nữa");
expect("Edit ở lượt sau (hết hiệu lực)", pre(...EDIT), 2);
prompt("tôi không đồng ý");
expect("Edit sau 'không đồng ý'", pre(...EDIT), 2);
prompt("chưa đồng ý đâu");
expect("Edit sau 'chưa đồng ý'", pre(...EDIT), 2);
prompt("how to apply this?");
expect("Edit sau 'apply' chữ thường", pre(...EDIT), 2);

// 4. Duyệt qua AskUserQuestion
prompt("đề xuất cách sửa");
ask("Hủy");
expect("Edit sau khi chọn 'Hủy'", pre(...EDIT), 2);
ask("APPLY");
expect("Edit sau khi chọn APPLY trong AskUserQuestion", pre(...EDIT), 0);

rmSync(stateFile(SID), { force: true });

let fail = 0;
for (const [name, got, want] of cases) {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  [${want === 2 ? "chặn" : "cho  "}] ${name}${ok ? "" : ` (exit ${got})`}`);
}
console.log(`\n${cases.length - fail}/${cases.length} pass`);
process.exit(fail ? 1 : 0);
