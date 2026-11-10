# Hệ thống thiết kế — JP N5–N4

## 1. Nguyên tắc

Lấy cảm hứng từ **デジタル庁デザインシステム** (Hệ thống thiết kế của Cục Kỹ thuật số Nhật Bản) và cách trình bày sách giáo khoa Nhật:

| Nguyên tắc | Áp dụng |
| --- | --- |
| **Nền trắng, nhiều khoảng trống** | Thẻ trắng trên nền xám rất nhạt (`canvas`), viền mảnh, không đổ bóng |
| **Xanh dương = hành động, điểm nhấn** | Link, nút, từ đang học trong câu ví dụ, thanh tiến độ |
| **Đỏ = chỉ lỗi và dấu nhận diện** | Logo (chấm đỏ như hinomaru), thông báo lỗi. **Không** dùng đỏ để nhấn mạnh nội dung học, vì người học sẽ hiểu là "sai" |
| **Chữ màu mực (sumi), không đen tuyệt đối** | `ink` #1a1a1c cho nội dung chính, `ink-muted` cho nội dung bổ trợ, `ink-faint` cho meta |
| **Màu tiết chế** | Nhãn (loại từ, Hán-Việt) dạng chữ xám, không tô màu. Màu chỉ dùng khi mang ý nghĩa trạng thái |
| **Thứ bậc bằng cỡ chữ và độ đậm**, không bằng màu | Từ chính 28px đậm → nghĩa 16px → meta 12px xám |
| **Tương phản WCAG AA** | Chữ nội dung ≥ 4.5:1 trên nền trắng |

## 2. Design token (2 tầng)

File: [web/src/styles/tokens.css](../web/src/styles/tokens.css)

```text
Tầng 1 — Primitive (--p-blue-700, --p-gray-900…)   bảng màu thô, KHÔNG dùng trong component
        │
        ▼
Tầng 2 — Semantic (@theme: --color-ink, --color-primary…)   theo VAI TRÒ → Tailwind sinh class
        │
        ▼
Component dùng class: text-ink, bg-surface, border-line, text-primary, bg-primary-soft…
```

| Token | Vai trò |
| --- | --- |
| `canvas` / `surface` / `surface-sunken` | nền trang / thẻ / khối phụ trong thẻ |
| `line` / `line-strong` | viền, đường kẻ |
| `ink` / `ink-muted` / `ink-faint` | chữ chính / bổ trợ / meta |
| `primary` / `primary-strong` / `primary-soft` / `primary-line` | xanh dương: hành động, nhấn |
| `brand` | đỏ nhận diện (logo) |
| `danger` / `danger-soft` | lỗi |
| `success`, `notice` / `notice-soft` | trạng thái (dành cho quiz/SRS sau này) |

**Gate `npm run check:tokens`** (chạy trong `npm run build`): chặn màu thô Tailwind (`text-red-500`, `bg-stone-100`…) và mã hex viết thẳng ngoài `tokens.css`.

## 3. Cấu trúc thư mục `web/src`

```text
src/
├─ styles/
│  ├─ tokens.css          # design token (nguồn duy nhất về màu/chữ)
│  └─ global.css          # base + style cho ruby/furigana + công tắc CSS
├─ components/
│  ├─ ui/                 # Thành phần cơ bản, KHÔNG biết gì về tiếng Nhật: Tag, Tooltip, (Button, Card…)
│  ├─ jp/                 # Hiển thị tiếng Nhật dùng lại được: Furigana, (KanjiStroke, ConjugationTable…)
│  └─ vocab/  kanji/ …    # Theo lĩnh vực (feature): WordCard, ExampleBlock, (KanjiCard…)
├─ layouts/               # Khung trang: Base
├─ pages/                 # Định tuyến + lấy dữ liệu (getCollection) → truyền props xuống component
└─ lib/                   # TypeScript thuần: schemas (zod), ruby parser, storage, srs
```

Quy tắc phụ thuộc (chỉ một chiều): `pages → feature (vocab/kanji…) → jp → ui → tokens`. `ui/` không import từ `jp/` hay feature; component không gọi `getCollection`.

## 4. Design pattern

| Pattern | Ở đâu | Vì sao |
| --- | --- | --- |
| **Design tokens** (2 tầng) | `tokens.css` + `@theme` | Đổi màu/thương hiệu một chỗ; gate chặn màu tùy tiện |
| **Atomic design rút gọn** (ui → jp → feature) | `components/` | Thành phần nhỏ dùng lại; thẻ từ, thẻ kanji, bảng chia thể ghép từ cùng một bộ `ui/` |
| **Feature folder** | `components/vocab/`, `kanji/`… | Khi thêm "chia thể", "đếm số", "từ nối" chỉ cần thêm một thư mục, không đụng phần khác |
| **Container / Presentational** | `pages/` lấy data, component chỉ nhận props | Component thuần, dễ test và dùng lại; dữ liệu chỉ đi một chiều |
| **Islands architecture** (Astro) | Mặc định HTML tĩnh; Preact island cho flashcard/quiz/SRS | Trang nhẹ, nhanh, chạy được trên GitHub Pages |
| **Progressive enhancement** | Công tắc hiển thị bằng CSS `:has()` | Không cần JS vẫn dùng được |
| **Schema-first** | `lib/schemas.ts` (zod) khớp `schemas.py` | UI không bao giờ nhận dữ liệu sai hình dạng |

## 5. Thẻ từ vựng — thứ bậc thông tin

```text
┌────────────────────────────────────┐
│ めいし                        [N]  │ ← chữ phụ (14px, xám) · mã loại từ góc phải, hover/focus → "Danh từ"
│ 名刺                               │ ← chữ được NHẤN MẠNH (28px, đậm)
│ danh thiếp                         │ ← nghĩa (16px)
│ DANH THÍCH                         │ ← âm Hán-Việt (12px, xám)
│ ────────────────────────────────── │ ← đường kẻ: phần dưới là bổ trợ
│ これは私の名刺です。                │ ← từ đang học: chữ xanh, đậm (không gạch chân, không tô nền)
│ Đây là danh thiếp của tôi.         │
└────────────────────────────────────┘
```

Công tắc **Nhấn mạnh từ vựng: Kanji | Hiragana** (CSS `:has()`, không JS) đổi vai trò hai dòng đầu: chữ được chọn to + đậm ở dưới, chữ còn lại nhỏ ở trên. Chỉ áp cho tiêu đề thẻ, câu ví dụ giữ nguyên.

> Thông tin biên tập (nguồn `ai-draft`/`user`, trạng thái duyệt) **không hiển thị** trên web — chỉ nằm trong `data/` và pipeline. Người học chỉ thấy nội dung học.

## 6. Chế độ Từng thẻ (flashcard)

- Bật bằng **Chế độ xem: Lưới | Từng thẻ**. Mỗi lần hiện 1 thẻ (CSS `:target` theo URL `#mn-LL-NNN`), nút Trước/Sau là link `#id`; thẻ đầu/cuối dẫn sang bài trước/sau.
- **Thẻ 2 mặt**: mặt trước = từ (kanji + kana, chữ 44px, giữa thẻ) + mã loại từ; mặt sau = nghĩa · Hán-Việt · câu ví dụ. Click trái bất kỳ đâu trên thẻ (hoặc Tab + Space) để lật — checkbox ẩn `.flip-toggle` + `<label>` bao thẻ, hiệu ứng `rotateY` (tắt khi `prefers-reduced-motion`).
- Chế độ Lưới hiện cả 2 mặt xếp dọc (xem tổng quan). Không dùng JS.

## 7. Khung trang, menu và trang chủ

- **Menu trái** (`components/layout/Sidebar.astro`, cấu hình ở `lib/nav.ts`, nguồn chung cho menu và các thẻ ở trang chủ):
  - Icon là **chữ Hán** mang nghĩa phần học: 家 Trang chủ · 語 Từ vựng · 字 Kanji · 活 Chia thể (活用) · 数 Đếm số · 接 Từ nối (接続詞). Sau này: 文 Ngữ pháp, 復 Ôn tập.
  - Desktop: nút « » thu gọn thành cột icon 4rem; trạng thái lưu ở `jp:ui:sidebar` (qua `storage.ts`), áp trước khi vẽ trang để không nháy.
  - Điện thoại: menu trượt mở bằng ☰ (checkbox `#nav-open`, thuần CSS), bấm nền mờ hoặc một mục để đóng.
  - Mục chưa có trang: mờ + nhãn "Sắp có". Mục đang mở: nền xanh nhạt, icon nền xanh.
- **Trang chủ** `/`: tiêu đề 日本へ行きたい。将来はお金持ちになりたい。 (có furigana) · dòng "Học theo giáo trình みんなの日本語" (mô tả, không dùng tên giáo trình làm tiêu đề vì là tên thương mại của 3A Corporation) · câu chào ngẫu nhiên (`lib/quotes.ts`, khẩu hiệu Việt + câu Nhật N5–N4 + nghĩa) · nút "Bắt đầu học từ vựng" · thẻ các phần học.
- Danh sách 50 bài chuyển sang `/vocabulary/`, chia N5 (#n5) / N4 (#n4).
- Lưu ý kỹ thuật: CSS viết ở `global.css` nằm ngoài layer của Tailwind nên **đè class tiện ích** (vd `md:hidden`) — muốn ẩn/hiện theo màn hình cho class tự viết thì viết media query trong `global.css`.
- **Nền trang chủ: họa tiết 青海波 (seigaiha)** — sóng truyền thống Nhật vẽ bằng CSS `radial-gradient` (0KB, không lo bản quyền ảnh). Màu token `--color-pattern-wave` (xanh rất nhạt) / `--color-pattern-gap` (trắng); bật bằng `<Base pattern>` → lớp `.bg-seigaiha` phủ ~44rem đầu trang, mờ dần bằng `mask-image`. Tiêu đề có quầng trắng `.hero-glow` để luôn đọc rõ. Cỡ chữ tiêu đề dùng đơn vị container (`cqi`) để không tràn khi có menu bên trái.
- Menu: nhóm có mục con (Từ vựng → N5/N4) có nút ▾ thu/xổ (checkbox ẩn `.nav-group-toggle`, thuần CSS).
- **Flashcard (bổ sung):** ở chế độ Lưới, click một thẻ → tự chuyển sang Từng thẻ và mở đúng thẻ đó (mặt trước). Nút Trước/Sau **quay vòng trong bài** (cuối → đầu, đầu → cuối); chuyển bài dùng nút ở header. Lựa chọn **Thứ tự: Tuần tự | Ngẫu nhiên** — ngẫu nhiên xáo trộn lại mỗi lần bật, số thứ tự `n / tổng` theo thứ tự đang dùng. Phần này dùng một script nhỏ trong `LessonView.astro`; tắt JS thì Trước/Sau vẫn chạy tuần tự + quay vòng (link `#id`).
- **Chống co giật (chế độ Từng thẻ):** thẻ có chiều cao cố định `clamp(24rem, 62vh, 34rem)`; nội dung mặt sau dài thì cuộn bên trong thẻ. Khi có JS, thẻ đang xem đánh dấu bằng `.is-current` và URL đổi qua `history.pushState` (không cuộn trang); `:target` chỉ dùng khi tắt JS. Nút Back/Forward vẫn chuyển thẻ (sự kiện `popstate`).

## 8. Kanji

- `/kanji/`: lưới ô chữ (chữ 3xl + Hán-Việt nhỏ), nhóm **N5 / N4** theo bài Minna đầu tiên có chữ, **N3** theo bài sách Kanji N3 (có thể trùng chữ N5–N4), **Khác** = chữ chỉ gặp trong từ vựng N3. Nút nhảy nhanh tới từng nhóm. Logic nhóm ở `lib/kanji.ts`.
- `/kanji/字/` (URL dùng chính chữ Hán): ô chữ 96px · Hán-Việt · nghĩa · nghĩa EN (xám) · bảng On / Kun (okurigana trong ngoặc: まか(せる)) / số nét / bài xuất hiện / bộ thủ (chữ + tên + nghĩa, số bộ, số nét) · danh sách từ vựng chứa chữ (chữ đang xem tô xanh, link tới đúng thẻ `#id` trong bài) · header: chữ trước / Danh sách / chữ sau.
