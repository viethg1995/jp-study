# Máy chấm luyện dịch (Cloudflare Worker)

Web trên GitHub Pages là trang tĩnh, nên không giữ được API key. Worker này đứng giữa: nhận bài dịch, gọi AI, rồi trả kết quả chấm dạng JSON.

```
/dich/<id>/ (trình duyệt) ──POST /grade──▶ Worker ──▶ Gemini → Workers AI → Claude
                                             │  (nhà trước lỗi / hết quota / trả JSON sai → thử nhà sau)
                                             └─ cache KV · giới hạn 6 lần/phút/IP · Turnstile (tùy chọn)
```

- Đề và bản dịch mẫu lấy từ `data/translation.json` (output pipeline), được đóng gói vào worker lúc deploy. **Sửa đề → chạy `build-translation` → deploy lại worker và push web.**
- Prompt chấm bài nằm ở `src/prompt.ts`. Đổi prompt thì tăng `PROMPT_VERSION`, để cache cũ không còn khớp.
- Kết quả chấm: `src/result.ts` (zod). Web giữ một bản interface tương ứng ở `web/src/lib/translation.ts`, hai bên phải sửa cùng nhau.
- Mỗi nhà cung cấp chỉ dùng **một tài khoản chính chủ**, trong hạn mức của nhà đó. Không xoay vòng nhiều key của cùng một nhà để cộng dồn hạn mức free, vì như vậy vi phạm điều khoản sử dụng.

## Deploy lần đầu

Cần một tài khoản Cloudflare (gói Free là đủ).

```bash
cd worker
npm install
npx wrangler login                       # mở trình duyệt để đăng nhập Cloudflare

# 1. Key AI (secret — không ghi vào file)
npx wrangler secret put GEMINI_API_KEY   # tạo key tại https://aistudio.google.com/apikey
npx wrangler secret put ANTHROPIC_API_KEY   # tùy chọn: tầng cuối, trả phí theo token

# 2. Cache (khuyên dùng): tạo KV rồi dán id vào wrangler.jsonc (khối kv_namespaces)
npx wrangler kv namespace create CACHE

# 3. Sửa wrangler.jsonc → vars.ALLOWED_ORIGINS, thêm origin GitHub Pages:
#    "https://viethg1995.github.io,http://localhost:4321"   (origin không có đường dẫn /jp-study)

npm run deploy                           # in ra URL, vd https://jp-translation-grader.<tên>.workers.dev
curl https://jp-translation-grader.<tên>.workers.dev/health   # → {"ok":true,"providers":["gemini","workers-ai",…]}
```

Sau đó vào GitHub repo → **Settings → Secrets and variables → Actions → Variables**, thêm:

| Variable | Giá trị |
|---|---|
| `GRADER_URL` | URL worker ở trên (không có `/` cuối) |
| `TURNSTILE_SITE_KEY` | (tùy chọn) site key Turnstile — xem dưới |

Push `main` (hoặc chạy lại workflow Deploy) để web build với URL máy chấm.

### Chống spam bằng Turnstile (tùy chọn)

1. Cloudflare dashboard → **Turnstile** → Add site, domain `viethg1995.github.io` (thêm `localhost` khi test).
2. Site key đặt vào GitHub Variable `TURNSTILE_SITE_KEY`; secret key đặt vào worker: `npx wrangler secret put TURNSTILE_SECRET`.
3. Khi worker có `TURNSTILE_SECRET`, mọi yêu cầu chấm phải kèm token hợp lệ.

## Chạy thử ở máy

```bash
cd worker
# .dev.vars (gitignored):  GEMINI_API_KEY=...
npm run dev                     # http://localhost:8787 — binding Workers AI cần đã wrangler login
cd ../web
PUBLIC_GRADER_URL=http://localhost:8787 npm run dev   # PowerShell: $env:PUBLIC_GRADER_URL="http://localhost:8787"; npm run dev
```

Kiểm tra kiểu dữ liệu: `npm run check` (`wrangler types` + `tsc`).

## Cấu hình (`wrangler.jsonc` → `vars`)

| Biến | Ý nghĩa |
|---|---|
| `PROVIDERS` | Thứ tự thử, mặc định `gemini,workers-ai,anthropic`. Nhà nào thiếu key hoặc binding thì tự bỏ qua. |
| `GEMINI_MODEL` / `WORKERS_AI_MODEL` / `ANTHROPIC_MODEL` | Tên model. Tên model và hạn mức free **thay đổi theo thời gian**, nên kiểm tra trang của từng nhà trước khi deploy. |
| `ALLOWED_ORIGINS` | Origin được phép gọi (CORS). Trang khác gọi vào sẽ bị trả 403. |
| `MAX_ANSWER_CHARS` | Độ dài bài làm tối đa, phải khớp `MAX_ANSWER_CHARS` ở `web/src/lib/translation.ts`. |

Giới hạn tần suất: khối `ratelimits` (6 lần / 60 giây / IP).

## Lưu ý quyền riêng tư

Ở gói free, Google có thể dùng dữ liệu gửi lên để cải thiện sản phẩm. Hãy dặn học viên không nhập thông tin cá nhân vào bài dịch. Worker không ghi bài làm vào log, chỉ ghi lỗi của nhà cung cấp.
