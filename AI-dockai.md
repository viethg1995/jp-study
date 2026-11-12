# Việc còn làm dở: Luyện dịch (AI chấm)

Cập nhật 2026-11-12, branch `feat/dem-so`. Trạng thái tổng của dự án: [plan/STATUS.md](plan/STATUS.md), mục 14.

## Đã có

- **Dữ liệu:** schema `TranslationFile` v1 (`pipeline/jp_pipeline/schemas.py` + zod `web/src/lib/schemas.ts`, gate `check:schema`).
  Đề soạn ở `pipeline/enrichment/translation/exercises/lesson-LL.json` → `python -m jp_pipeline build-translation` → `data/translation.json`. ID đề `t-LL-NN`.
- **Web:** `/dich/` (danh sách đề) và `/dich/<id>/` (form chấm, kết quả từng câu, bản dịch mẫu). Mục 訳 trong menu.
- **Worker:** `worker/` (Cloudflare Worker). Fallback Gemini → Workers AI → Claude Haiku 5.5, cache KV, rate limit 6 lần/phút/IP, Turnstile tùy chọn.
  Đã chạy thử ở local: kiểm origin, đề không tồn tại, 503 khi chưa có key, 429 khi vượt rate limit. **Chưa chấm thử với AI thật.**

## Còn phải làm

### 1. Deploy, cần user làm (có tài khoản)

- [ ] `cd worker && npm install && npx wrangler login`
- [ ] `npx wrangler secret put GEMINI_API_KEY`. Tùy chọn thêm `ANTHROPIC_API_KEY` (tầng cuối, trả phí).
- [ ] Tạo KV cache: `npx wrangler kv namespace create CACHE`, dán id vào `worker/wrangler.jsonc` rồi bỏ comment khối `kv_namespaces`.
- [ ] Sửa `ALLOWED_ORIGINS` trong `wrangler.jsonc`, thêm `https://viethg1995.github.io`.
- [ ] Kiểm tra tên model còn dùng được: `GEMINI_MODEL` (đang để `gemini-2.5-flash`, chưa xác minh), `WORKERS_AI_MODEL`.
- [ ] `npm run deploy`, sau đó `curl <url>/health` phải liệt kê các provider.
- [ ] GitHub → Settings → Variables: `GRADER_URL` = URL worker. Tùy chọn `TURNSTILE_SITE_KEY`, đi kèm `wrangler secret put TURNSTILE_SECRET`.
- [ ] Push `main` để web build với `PUBLIC_GRADER_URL`. Khi chưa có biến này, nút "Chấm bài" bị tắt.

Hướng dẫn chi tiết: [worker/README.md](worker/README.md).

### 2. Nội dung đề

- [ ] 3 đề mẫu (`t-01-01`, `t-01-02`, `t-02-01`) do AI soạn: `source: ai-draft`, `review: auto`. **User duyệt** câu đề và bản dịch mẫu.
- [ ] Soạn đề thật cho các bài tiếp theo. Mỗi câu nên có nhiều bản mẫu khi có nhiều cách dịch đúng, và dùng `note_vi` để báo cho AI biết chỗ nào được chấp nhận.
- [ ] Trường `grammar_refs` hiện để trống. Điền ID `g-LL-N` khi pipeline ngữ pháp xong (STATUS mục 9).

### 3. Kiểm tra chất lượng chấm (sau khi deploy)

- [ ] Thử với bài làm thật: câu đúng nhưng khác bản mẫu, sai trợ từ, sai thể, thiếu câu, viết toàn hiragana.
- [ ] So kết quả giữa Gemini và Workers AI (đặt `PROVIDERS` chỉ còn một nhà để thử riêng). Nếu Workers AI chấm kém, bỏ nó khỏi chuỗi.
- [ ] Gemini `responseSchema` đang dùng bản đã bỏ `additionalProperties` (`geminiSchema()` trong `worker/src/result.ts`). Nếu API báo lỗi schema thì sửa ở đó.
- [ ] Mỗi lần chỉnh prompt (`worker/src/prompt.ts`) phải tăng `PROMPT_VERSION`.

### 4. Có thể làm thêm

- [ ] Lưu nháp bài làm (key mới, ví dụ `jp:dich:draft:{id}`, đăng ký trong `.claude/rules/web.md`, đi qua `lib/storage.ts`).
- [ ] Gate đồng bộ kết quả chấm giữa `worker/src/result.ts` và `web/src/lib/translation.ts` (hiện phải tự giữ khớp, kể cả `MAX_ANSWER_CHARS`).
- [ ] Unit test cho `worker/` (`parseGrade`, `userPrompt`). Hiện chỉ có `tsc` (`npm run check`).

## Lưu ý

- Mỗi nhà cung cấp AI chỉ dùng **một tài khoản chính chủ**. Không xoay vòng nhiều key của cùng một nhà để lách hạn mức free.
- Gói free của Gemini có thể dùng dữ liệu gửi lên để cải thiện sản phẩm. Dặn học viên không nhập thông tin cá nhân.
- Thêm hoặc sửa đề: chạy `build-translation`, **deploy lại worker** (đề được đóng gói trong worker), rồi push web.
- `worker/worker-configuration.d.ts` không commit (file sinh, khoảng 600 KB). `npm run check` sẽ tạo lại.
