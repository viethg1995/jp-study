---
paths:
  - "web/**"
---

# Frontend (`web/`, Astro + TypeScript)

- Mặc định là HTML tĩnh; chỉ dùng island (Preact) cho phần cần tương tác: flashcard, quiz, SRS, tìm kiếm.
- TypeScript strict, không dùng `any`.
- Font tiếng Nhật: `"Noto Sans JP"`. Mobile-first.
- `astro.config.mjs` phải có `site` và `base` đúng với đường dẫn GitHub Pages — lấy từ biến môi trường `SITE_URL`, `BASE_PATH` (mặc định localhost, `/`). Link nội bộ luôn ghép `import.meta.env.BASE_URL`.
- **Astro ghim 7.3.8** (bản 7.4+ đòi Node ≥ 22.23.4, máy đang Node 22.21). Nâng Node rồi mới nâng Astro.
- Schema zod ở `web/src/lib/schemas.ts` (chỉ import `astro/zod`, để Node chạy được gate) phải khớp `schemas.py` — `npm run check:schema` so với `data/_schema/`; gate **không** so ràng buộc (min/max/regex) và danh sách `POS_CODES`, phần đó vẫn phải tự giữ khớp. `content.config.ts` chỉ khai báo collection. Parser ruby ở `web/src/lib/ruby.ts` phải khớp `transform/examples.py`.
- **SEO:** mỗi trang truyền `description` cho `Base` (trang động tự soạn từ dữ liệu, cắt bằng `clip()` ở `lib/seo.ts`); `Base` tự sinh canonical (bỏ query), Open Graph, favicon. Mỗi trang đúng một `<h1>`. `sitemap.xml` do integration trong `astro.config.mjs` ghi lúc build (bỏ 404 và endpoint `.json`); `robots.txt` ở `pages/robots.txt.ts`. Trang không cần index → `noindex`.
- Công tắc hiển thị (ẩn furigana, che bản dịch, lọc chờ duyệt) làm bằng CSS `:has()` + checkbox — không cần JS.
- Stack: Preact (island), Tailwind CSS, Pagefind (tìm kiếm), `@vite-pwa/astro` (offline), `localStorage` (trạng thái).

## localStorage

Mọi truy cập `localStorage`/`sessionStorage` đi qua `src/lib/storage.ts`. Mọi key phải có prefix `jp:` và được liệt kê trong bảng dưới (gate `npm run check:storage` đọc bảng này — giữ đúng định dạng: key trong backtick ở cột đầu, phần biến viết `{id}`, vd `` `jp:srs:{id}` ``).

| Key | Nội dung |
|-----|----------|
| `jp:ui:sidebar` | Trạng thái menu trái trên desktop: `collapsed` hoặc `expanded` (đọc trước khi vẽ trang bằng `SIDEBAR_BOOT_SCRIPT`) |

## Lệnh

```bash
cd web
npm run dev                        # http://localhost:4321
npm run build                      # check:gates + astro check + build — phải pass trước khi push
npm run check:gates                # chỉ chạy gate schema + localStorage (nhanh)
```

## Hệ thống thiết kế (chi tiết: `plan/design-system.md`)

- Màu chỉ qua token ở `src/styles/tokens.css` (class `text-ink`, `bg-surface`, `border-line`, `text-primary`…). Gate `npm run check:tokens` chặn màu thô Tailwind (`text-red-500`) và mã hex ngoài `tokens.css`.
- Xanh dương = hành động/nhấn mạnh; **đỏ chỉ cho lỗi + logo** (không dùng để đánh dấu nội dung học); nhãn meta (loại từ, Hán-Việt) dạng chữ xám, không tô màu.
- Thư mục component: `ui/` (cơ bản, không biết tiếng Nhật) → `jp/` (Furigana…) → feature (`vocab/`, `kanji/`…); `layout/` cho khung trang (Sidebar). Menu cấu hình ở `lib/nav.ts` — thêm phần học mới: thêm mục ở đây (href null = Sắp có). Phụ thuộc một chiều `pages → feature → jp → ui`; chỉ `pages/` gọi `getCollection`.
- **Không hiển thị thông tin biên tập** (provenance `ai-draft`/`user`, `review`, trạng thái duyệt) trên web — người học chỉ thấy nội dung học. Theo dõi duyệt bằng pipeline (`build`, `check-examples`).
