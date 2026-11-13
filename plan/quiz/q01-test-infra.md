# Q1 — Hạ tầng test web

> Phần chung (quyết định D1–D6, kiến trúc, bất biến, luồng làm bài, checklist): [README.md](README.md). File này chỉ chứa riêng task Q1.

Trạng thái: ✅ xong 2026-11-12

## Nội dung

**Hạ tầng test web**: `npm run test` = `node --import ./scripts/register-ts.mjs --test "src/**/*.test.ts"` (hook resolve thêm đuôi `.ts`, không thêm thư viện; module trong `lib/quiz/` chỉ được `import type` từ `content.config`/`astro:*`); file test đầu cho `counter-quiz.ts` kiểm 5 bất biến ở [README §Kiến trúc](README.md#kiến-trúc) trên dữ liệu thật `data/counters.json`; thêm `test` vào `npm run build`

## Tiêu chí xong / kết quả

`npm run test` xanh; cố ý sửa sai `distractors()` thì test đỏ — **Xong 2026-11-12**: `scripts/register-ts.mjs` (`registerHooks`), `src/test/data.ts`, `lib/counter-quiz.test.ts` 7 test; thử làm hỏng `distractors()` → 3 test đỏ
