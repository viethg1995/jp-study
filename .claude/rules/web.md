---
paths:
  - "web/**"
---

# Frontend (`web/`, Astro + TypeScript)

- Mặc định là HTML tĩnh. Phần tương tác (flashcard, quiz) dùng **script thường** (`<script>` + TS module trong `lib/`), không Preact — quyết định D1 ở `plan/quiz/README.md` (nhẹ hơn ~6KB gzip, không hydrate). Preact island chỉ cân nhắc khi state phức tạp (SRS).
- TypeScript strict, không dùng `any`.
- Font tiếng Nhật: `"Noto Sans JP"`. Mobile-first.
- `astro.config.mjs` phải có `site` và `base` đúng với đường dẫn GitHub Pages — lấy từ biến môi trường `SITE_URL`, `BASE_PATH` (mặc định localhost, `/`). Link nội bộ luôn ghép `import.meta.env.BASE_URL`.
- **Astro ghim 7.3.8** (bản 7.4+ đòi Node ≥ 22.23.4, máy đang Node 22.21). Nâng Node rồi mới nâng Astro.
- Schema zod ở `web/src/lib/schemas.ts` (chỉ import `astro/zod`, để Node chạy được gate) phải khớp `schemas.py` — `npm run check:schema` so với `data/_schema/`; gate **không** so ràng buộc (min/max/regex) và danh sách `POS_CODES`, phần đó vẫn phải tự giữ khớp. `content.config.ts` chỉ khai báo collection. Parser ruby ở `web/src/lib/ruby.ts` phải khớp `transform/examples.py`.
- **SEO:** mỗi trang truyền `description` cho `Base` (trang động tự soạn từ dữ liệu, cắt bằng `clip()` ở `lib/seo.ts`); `Base` tự sinh canonical (bỏ query), Open Graph, favicon. Mỗi trang đúng một `<h1>`. `sitemap.xml` do integration trong `astro.config.mjs` ghi lúc build (bỏ 404 và endpoint `.json`); `robots.txt` ở `pages/robots.txt.ts`. Trang không cần index → `noindex`.
- Công tắc hiển thị (ẩn furigana, che bản dịch, lọc chờ duyệt) làm bằng CSS `:has()` + checkbox — không cần JS.
- Stack: script thường (tương tác), Tailwind CSS, Pagefind (tìm kiếm), `@vite-pwa/astro` (offline), `localStorage` (trạng thái).

## localStorage

Mọi truy cập `localStorage`/`sessionStorage` đi qua `src/lib/storage.ts`. Mọi key phải có prefix `jp:` và được liệt kê trong bảng dưới (gate `npm run check:storage` đọc bảng này — giữ đúng định dạng: key trong backtick ở cột đầu, phần biến viết `{id}`, vd `` `jp:srs:{id}` ``).

| Key | Nội dung |
|-----|----------|
| `jp:ui:sidebar` | Trạng thái menu trái trên desktop: `collapsed` hoặc `expanded` (đọc trước khi vẽ trang bằng `SIDEBAR_BOOT_SCRIPT`) |

## Lệnh

```bash
cd web
npm run dev                        # http://localhost:4321
npm run build                      # check:gates + test + astro check + build — phải pass trước khi push
npm run check:gates                # chỉ chạy gate schema + localStorage (nhanh)
npm run test                       # unit test (node --test, không thư viện ngoài)
npm run test:e2e                   # e2e Playwright trên dist/ (chạy sau build)
```

## Test

- File `src/**/*.test.ts`, chạy bằng `node:test` + `node:assert/strict`; `npm run build` đã gồm `npm run test`.
- `scripts/register-ts.mjs` thêm đuôi `.ts` cho import tương đối (Vite cho phép bỏ đuôi, Node thì không). Module được test chỉ `import type` từ `content.config`/`astro:*` — import giá trị từ `astro:content` sẽ không chạy được dưới Node.
- Đọc `data/` trong test qua `src/test/data.ts` (parse bằng zod ở `lib/schemas.ts`, như content collection). Test chạy trên **dữ liệu thật**: kiểm bất biến (vd đáp án đúng không lọt vào đáp án nhiễu), không chụp snapshot cả file.
- **E2E** (`e2e/*.spec.ts`, Playwright ghim **1.64.1**): chạy trên bản build tĩnh `dist/` qua `scripts/serve-dist.mjs` (server tĩnh nhỏ, hỗ trợ `BASE_PATH`; không dùng `astro preview` vì bản này chạy nền và từ chối khi đã có server khác). Hai project: `desktop` 1280px, `mobile` 375px. Fixture `e2e/fixtures.ts`: chặn mạng ngoài (Google Fonts trả CSS rỗng) và tự fail khi trang có lỗi JS/console.
  - Máy mới: `npx playwright install --only-shell chromium` (tải vào `~/.cache/ms-playwright`, ngoài repo).
  - Thử với đường dẫn GitHub Pages: `BASE_PATH=/jp-study/ npx astro build && BASE_PATH=/jp-study/ npm run test:e2e`, xong build lại bản thường.
  - Mỗi trang quiz mới (Q4–Q8) phải có file spec e2e; checklist kiểm tay ở `plan/quiz/README.md` (mục Checklist) làm tự động hết mức có thể.

## Hệ thống thiết kế (chi tiết: `plan/design-system.md`)

- Màu chỉ qua token ở `src/styles/tokens.css` (class `text-ink`, `bg-surface`, `border-line`, `text-primary`…). Gate `npm run check:tokens` chặn màu thô Tailwind (`text-red-500`) và mã hex ngoài `tokens.css`.
- Xanh dương = hành động/nhấn mạnh; **đỏ chỉ cho lỗi + logo** (không dùng để đánh dấu nội dung học); nhãn meta (loại từ, Hán-Việt) dạng chữ xám, không tô màu.
- Thư mục component: `ui/` (cơ bản, không biết tiếng Nhật) → `jp/` (Furigana…) → feature (`vocab/`, `kanji/`…); `layout/` cho khung trang (Sidebar). Menu cấu hình ở `lib/nav.ts` — thêm phần học mới: thêm mục ở đây (href null = Sắp có). Phụ thuộc một chiều `pages → feature → jp → ui`; chỉ `pages/` gọi `getCollection`.
- **Trang quiz** (`components/quiz/QuizRunner.astro`): luồng thiết lập → "Bắt đầu" → làm bài (tùy chọn khóa, trừ dòng `[data-q-keep]` = Furigana) → tổng kết → "Đổi tùy chọn"; `setFilter` chỉ ghi nhận bộ lọc, tải deck khi bấm Bắt đầu (e2e: helper `startQuiz` / `finishRound` (tự xác nhận "Kết thúc") / `backToSetup` ở `e2e/fixtures.ts`). Tùy chọn mới đặt trong slot sẽ tự bị khóa (runner disable mọi input/select/button trong `.quiz-options`). bộ lọc đặt trong slot `filters`, mỗi dòng một phần tử, nhãn dòng có class `seg-label` (Segmented có sẵn) để thẳng cột trong khung "Tùy chọn luyện tập". **Chọn một** = Segmented nền đặc; **chọn nhiều** = nút bo tròn nền nhạt + ✓ (`has-checked:bg-primary-soft`) kèm dòng giải thích. Nhiều loại câu → truyền `kindLabels` (nhãn loại ở góc thẻ) và `balanceKinds` (chia đều số câu mỗi loại); trộn nhiều phần (trang tổng `/luyen-tap/`) → `balanceParts` (chia đều theo phần = tiền tố kind `v-`/`k-`/`c-`/`n-`, trong phần theo loại câu). Trang tổng dùng lại đúng file deck của trang từng phần (`lib/quiz/mix.ts`) — đổi tên/đường dẫn file deck phải sửa cả `mixFiles`. Đề có `[[…]]` (vd `[[大]]学`) → runner tô xanh + gạch chân phần đó. Deck quá lớn để đóng gói sẵn (chia thể) → tải dữ liệu gọn rồi sinh câu trên trình duyệt: `setFilter(filter, urls, toItems)`; unit test phải chạy hàm sinh trên toàn bộ dữ liệu + `checkDeck`. Câu ít hơn 4 lựa chọn: khai báo ở `MIN_POOL_BY_KIND` (validate.ts). Ẩn/hiện dòng lọc bằng thuộc tính `hidden` (không dùng class `hidden` trên phần tử có `flex` — hai class xung đột). Câu hỏi: `hint` chỉ cho gợi ý **cần để trả lời** (câu dịch của câu điền từ, "nghĩa: …" của từ nhiều cách đọc) — luôn hiện dưới đề; thông tin phụ (bài, loại từ, nghĩa ở chia thể, số nét…) ghi vào `info` (mỗi ý một dòng bằng `\n`) → icon ⓘ (màu `primary`) sau nhãn loại câu: hover trên máy có chuột (click chuột không ghim — runner bỏ qua `pointerType === "mouse"`), chạm/Enter để bật tắt. Câu hỏi có furigana → truyền `furiganaToggle` (dòng Hiện/Ẩn; chỉ ẩn ở câu hỏi + lựa chọn, phản hồi vẫn hiện).
- **Không hiển thị thông tin biên tập** (provenance `ai-draft`/`user`, `review`, trạng thái duyệt) trên web — người học chỉ thấy nội dung học. Theo dõi duyệt bằng pipeline (`build`, `check-examples`).
