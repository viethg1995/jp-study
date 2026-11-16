# Q12 — Chia nhỏ file deck (chunk) để tăng hiệu năng tải

> Phần chung (quyết định D1–D6, kiến trúc, bất biến, luồng làm bài, checklist): [README.md](README.md). File này chỉ chứa riêng task Q12.

Trạng thái: ⬜ **theo dõi** — lên kế hoạch chi tiết **sau khi xong mọi chức năng quiz** (Q7, Q9, Q10, Q11 và phần dữ liệu bỏ qua của Q4b). Trước đó: mỗi task làm tăng dung lượng deck thì cập nhật bảng đo dưới.

## Vì sao

Mỗi deck là **một file JSON cho cả cấp** (vd `vocabulary/quiz/n5-dien.json` = bài 1–25), tải lười khi bấm Bắt đầu. Người học chọn bài 3–5 vẫn tải cả cấp. Trang tổng `/luyen-tap/` tải nhiều file cùng lúc. File đang lớn dần theo từng task, và sẽ còn tăng khi sửa dữ liệu của Q4b (~115 câu) và thêm Q7, Q11.

## Số đo (bản build, gốc / gzip)

Cập nhật mỗi khi một task làm deck lớn thêm. Mốc giới hạn trong unit test: deck từ vựng < 450KB gốc / < 70KB gzip (`vocab.test.ts`).

| Ngày | File | Gốc | Gzip | Ghi chú |
|---|---|---|---|---|
| 2026-11-13 | `chia-the/quiz/dong-tu.json` | 742KB | 72KB | bảng chia gọn, câu sinh trên trình duyệt |
| 2026-11-13 | `kanji/quiz/tv-n5-doc.json` | 547KB | 82KB | lớn nhất theo gzip |
| 2026-11-13 | `vocabulary/quiz/n5-dien.json` | 440KB | 62KB | **sát mốc 450KB** sau Q4b (+82 câu) |
| 2026-11-13 | `vocabulary/quiz/n4-dien.json` | 397KB | 64KB | Q4b +142 câu |
| 2026-11-13 | `vocabulary/quiz/n3-dien.json` | 380KB | 64KB | Q4b +162 câu |
| 2026-11-16 | `vocabulary/quiz/n3-dien.json` | 415KB | 69KB | +54 câu N3 (tra `aliases` bảng chia) — **sát mốc 70KB gzip** |
| 2026-11-16 | `chia-the/quiz/dong-tu.json` | 744KB | 72KB | thêm `aliases` vào hàng |
| 2026-11-16 | `chia-the/quiz/dong-tu.json` | 753KB | 73KB | +10 hàng tách khỏi alias gộp theo kana (bước 1.1) |
| 2026-11-16 | `vocabulary/quiz/n5-dien.json` | 445KB | 63KB | +8 câu (khớp theo cách đọc) — **sát mốc 450KB gốc** |
| 2026-11-16 | `vocabulary/quiz/n4-dien.json` | 409KB | 66KB | +22 câu |
| 2026-11-13 | `vocabulary/quiz/n5-tu.json` | 409KB | 54KB | |
| 2026-11-13 | `kanji/quiz/tv-n4-doc.json` | 370KB | 54KB | |
| 2026-11-13 | `/luyen-tap/dem-so.json` | 177KB | 14KB | Q7 thêm 86 câu số |
| 2026-11-13 | `/luyen-tap/` bài 1–25, đủ 4 phần | — | ~380KB | 10 file; đo ở Q8 trước Q4b (377KB) |
| 2026-11-13 | `/luyen-tap/` bài 1–50, đủ 4 phần | — | ~600KB | 19 file; đo ở Q8 trước Q4b (599KB) |

Lệnh đo (sau `npm run build`):

```bash
cd web/dist && for f in vocabulary/quiz/*.json kanji/quiz/*.json chia-the/quiz/*.json luyen-tap/*.json; do
  printf "%s %s %s\n" "$f" $(wc -c <"$f") $(gzip -c "$f" | wc -c); done | sort -k2 -n -r | head
```

## Hướng xử lý (ghi ban đầu)

- **Chunk theo nhóm bài** (vd 5 bài/file: `n5-dien-01-05.json`) → bộ lọc bài chỉ tải chunk cần; trang tổng tải ít file hơn khi khoảng bài hẹp. Cần: `mixFiles` (Q8) và trang từng phần biết danh sách chunk; nhớ đệm PWA theo chunk.
- **Gọn dữ liệu lặp**: `explain`, `href`, `info` lặp nhiều giữa các câu cùng từ → bảng tra theo ID từ, câu chỉ giữ khóa.
- **Sinh câu trên trình duyệt** (như chia thể) cho deck có quy luật, đổi lấy CPU lúc bắt đầu lượt.
- Đo trước/sau: tổng dung lượng tải cho các bộ lọc thường dùng (1 cấp đủ bài, 3 bài, trang tổng 1–25 và 1–50), thời gian tới câu đầu tiên trên mobile 3G giả lập.

## Tiêu chí xong (dự kiến)

Không file deck nào vượt mốc thống nhất khi lập kế hoạch; bộ lọc hẹp (≤ 5 bài) tải ít hơn hẳn hiện tại; e2e + unit xanh; ID câu không đổi (khóa của Q10).

## Kế hoạch bước 3 · chờ duyệt spec

Ghi 2026-11-17 ([README.md](README.md#kế-hoạch-tiếp-theo-chốt-2026-11-16)) — làm **sau bước 2** (2.1 thêm ~40 câu vào `n4-dien`/`n5-dien`).

1. **Đo lại** toàn bộ deck (lệnh ở mục Số đo) + tổng tải cho 4 bộ lọc thường dùng: 1 cấp đủ bài; 3 bài (vd N5 bài 3–5); `/luyen-tap/` bài 1–25 và 1–50 đủ 4 phần. Ghi bảng "trước".
2. **Spec** (user duyệt) — đề xuất:

| # | Mục | Đề xuất |
|---|---|---|
| 3-1 | Cách chia | **Theo nhóm bài, 5 bài/file** cho deck từ vựng + Kanji: `vocabulary/quiz/n5-dien-01.json` (bài 1–5), `-06` (6–10)…; N3 14 bài → 3 file (1–5, 6–10, 11–14). Kanji theo cùng trục bài của bộ lọc. Deck nhỏ (bộ thủ, đếm số, số đếm) giữ 1 file |
| 3-2 | Chia thể | `chia-the/quiz/dong-tu.json` (753KB / 73KB gzip) sinh câu trên trình duyệt từ cả bảng → chia theo **sách** (Minna / N3) trước; theo bài nếu vẫn lớn |
| 3-3 | Danh sách file | Hàm thuần `deckChunks(level, kind, from, to)` (`lib/quiz/chunks.ts`) → danh sách URL; trang từng phần và `mixFiles` (trang tổng) cùng dùng → đổi tên file chỉ sửa một chỗ |
| 3-4 | Runner | `setFilter` nhận nhiều URL (đã có cho trang tổng) → trang từng phần truyền danh sách chunk; đếm "/ N câu" (Số câu "Tự nhập") cộng các chunk |
| 3-5 | Gọn dữ liệu (nếu còn lớn) | `href`, `info`, `explain` lặp giữa các câu cùng từ → bảng tra theo ID từ trong file, câu giữ khóa. Chỉ làm khi 3-1 chưa đủ |
| 3-6 | PWA | Cache theo từng chunk (kiểm `@vite-pwa/astro` đang precache hay runtime caching cho `*/quiz/*.json`); chunk đã tải dùng được offline |
| 3-7 | Bất biến | **ID câu không đổi** (khóa `jp:quiz:wrong`); một câu nằm ở đúng một chunk (theo `tags.lesson` nhỏ nhất); "Câu hay sai" (Q10) tải đủ chunk chứa các câu sai |
| 3-8 | Mốc test | Mỗi chunk < 150KB gốc / < 25KB gzip (thay mốc 450KB / 70KB); test: hợp các chunk = deck đầy đủ (cùng tập ID) |

3. **Làm** → unit (chunks, hợp chunk = deck đầy đủ) + e2e (bộ lọc hẹp chỉ tải chunk cần — đếm request bằng `page.route`; trang tổng; Câu hay sai; mạng chậm) + đo "sau" → ghi bảng Số đo.

Tiêu chí xong: như mục trên + bộ lọc ≤ 5 bài tải ≤ 1/3 dung lượng hiện tại.
