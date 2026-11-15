# Q3 — QuizRunner + chuyển quiz đếm số

> Phần chung (quyết định D1–D6, kiến trúc, bất biến, luồng làm bài, checklist): [README.md](README.md). File này chỉ chứa riêng task Q3.

Trạng thái: ✅ xong 2026-11-12

## Nội dung

**`QuizRunner`** (component + `lib/quiz/runner.ts`): tải deck JSON, bộ lọc, phím tắt, phản hồi, số câu/lượt, màn tổng kết + làm lại câu sai. **Chuyển `/dem-so/quiz/` sang engine** (deck `n-ctr`), hành vi không đổi

## Tiêu chí xong / kết quả

Unit test test-được phần thuần của runner (trạng thái lượt, điểm); kiểm tay theo checklist ([README](README.md#checklist)) trên desktop + mobile; số câu "Cần nhớ" vẫn 149, "Tất cả" vẫn 366 — **Xong 2026-11-12**: `components/quiz/QuizRunner.astro` + `lib/quiz/runner.ts` (DOM) + `lib/quiz/session.ts` (trạng thái lượt, 7 test); `/dem-so/quiz/` dùng runner, bộ lọc lên URL (`tro`, `nhom`, `o`). Sửa lỗi cũ: màu đúng/sai của nút không bao giờ hiện (style scoped Astro không áp vào nút do script tạo) → class Tailwind `data-[state=…]:`. Kiểm bằng Chromium headless 23/23 mục; sau đó thành test chính thức `web/e2e/counter-quiz.spec.ts` (Playwright 1.64.1, 11 test × desktop/mobile = 22, lặp 3 lần 66/66, cả `BASE_PATH=/jp-study/`) (desktop, mobile 375px, URL, làm lại câu sai, kết thúc lượt, bộ lọc rỗng, URL rác)

## Loại câu đếm số

| Loại | Hỏi → chọn |
|---|---|
| `n-ctr` | Số + trợ số từ → cách đọc (**giữ nguyên logic hiện tại**) |
| `n-num` (→ [Q7](q07-numbers.md)) | Số (vd 3.600, 0,5, 1/3) → cách đọc |
| `n-pick` (→ [Q7](q07-numbers.md)) | Đồ vật / tình huống → trợ số từ phù hợp (本 hay 枚 hay 台) — làm sau, cần dữ liệu "dùng cho cái gì" |
