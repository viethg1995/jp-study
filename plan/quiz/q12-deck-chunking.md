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

## Hướng xử lý (chưa chốt — lập kế hoạch khi tới lượt)

- **Chunk theo nhóm bài** (vd 5 bài/file: `n5-dien-01-05.json`) → bộ lọc bài chỉ tải chunk cần; trang tổng tải ít file hơn khi khoảng bài hẹp. Cần: `mixFiles` (Q8) và trang từng phần biết danh sách chunk; nhớ đệm PWA theo chunk.
- **Gọn dữ liệu lặp**: `explain`, `href`, `info` lặp nhiều giữa các câu cùng từ → bảng tra theo ID từ, câu chỉ giữ khóa.
- **Sinh câu trên trình duyệt** (như chia thể) cho deck có quy luật, đổi lấy CPU lúc bắt đầu lượt.
- Đo trước/sau: tổng dung lượng tải cho các bộ lọc thường dùng (1 cấp đủ bài, 3 bài, trang tổng 1–25 và 1–50), thời gian tới câu đầu tiên trên mobile 3G giả lập.

## Tiêu chí xong (dự kiến)

Không file deck nào vượt mốc thống nhất khi lập kế hoạch; bộ lọc hẹp (≤ 5 bài) tải ít hơn hẳn hiện tại; e2e + unit xanh; ID câu không đổi (khóa của Q10).
