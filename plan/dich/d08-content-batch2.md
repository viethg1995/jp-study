# D8 — Nội dung đoạn văn đợt 2 (soạn theo đợt, hướng A)

Bối cảnh: tạo đoạn trực tiếp trên web (D5–D6) thử thật 2026-11-17 không đạt — model qua server trung gian bỏ furigana và viết rời rạc. User chọn **hướng A**: tiếp tục soạn theo đợt như [D4](d04-content.md) (AI soạn ngoại tuyến → `build-translation` + `check-passages` → user duyệt). Code D5–D6 giữ trên nhánh `feat/dich-tao` (không merge).

## Spec

### Số lượng (user chốt 2026-11-17: "tạm thời triển khai như đề xuất")

18 đoạn: **N5 6 · N4 6 · N3 6**, ID nối tiếp: `p-n5-007…012`, `p-n4-007…012`, `p-n3-007…012`. Sau đợt này mỗi cấp có 12 đoạn (tổng 36).

### Chủ đề — ưu tiên chủ đề đợt 1 chưa có

Đợt 1 đã có: chủ nhật/tennis, thư gửi mẹ, sinh nhật, dã ngoại (thông báo), ngắm hoa, hỏi đường · homestay, làm thêm, đổ rác, smartphone, xin nghỉ ốm, quên túi · sống một mình, thư thầy giáo, thư viện, leo Phú Sĩ, đổi ngày họp, tiết kiệm.

| Cấp | 6 đoạn đợt 2 (thể loại — chủ đề) |
|---|---|
| N5 | Thư — kỳ nghỉ hè ở quê · Nhật ký — đi mua quần áo · Thông báo — lớp nấu ăn · Bài viết — gia đình tôi · Email — mời bạn đến nhà chơi · Hội thoại — gọi món ở nhà hàng |
| N4 | Thư — kể với bạn ở Việt Nam về mùa đông Nhật · Nhật ký — bị cảm, đi bệnh viện · Thông báo — lễ hội mùa hè của khu phố · Bài viết — sở thích chụp ảnh · Email — hỏi về lớp học thử · Hội thoại — mua vé Shinkansen |
| N3 | Thư — cảm ơn đồng nghiệp cũ khi chuyển việc · Nhật ký — động đất nhỏ đêm qua · Thông báo — đổi giờ chạy xe buýt · Bài viết — học tiếng Nhật qua phim hoạt hình · Email — xin dời lịch phỏng vấn · Hội thoại — bàn kế hoạch du lịch Hokkaido |

### Luật soạn, văn phong, độ dài

Giữ nguyên [D4](d04-content.md) (văn phong có thán từ / từ nối / lời thoại 「」 / diễn biến; mọi kanji có furigana; N5 Minna 1–25, N4 1–50, N3 thêm ngữ pháp N3; `source: "ai-draft"`, `review: "auto"`). Rút kinh nghiệm đợt 1:

- **Độ dài nhắm cao hơn đợt 1** (đợt 1 thấp hơn mục tiêu 10–20%): N5 250–300, N4 300–360, N3 330–380 ký tự Nhật; giữ tiếng Việt ≤ 900 (thông báo / email dịch ra tiếng Việt dài ~2,5 lần → viết gọn hơn).
- Thêm `vi_alt` / `ja_alt` cho câu có cách dịch khác thường gặp (đợt 1 chỉ `p-n5-001` có).
- Từ vượt cấp do `check-passages` báo → thay; cảnh báo chấp nhận được ghi vào phần sai khác (như đợt 1).

### Quy trình

```
AI soạn (bản dòng → convert) → passages/nX.json (nối cuối) → build-translation → check-passages
  → sửa từ vượt cấp → web build + e2e translation → user duyệt → deploy worker (đề mới) + merge
```

## Sai khác so với spec

Soạn xong 2026-11-17: 18 đoạn (N5 6 · N4 6 · N3 6), tất cả `ai-draft` / `review: auto` — **chờ user duyệt**. Tổng bộ đề: 36 đoạn (mỗi cấp 12).

| Đoạn | Thể loại | Câu | Ký tự Nhật / Việt | Câu có alt |
|---|---|---|---|---|
| p-n3-007 Gửi những người đã giúp đỡ tôi | Thư | 13 | 342 / 838 | 0 |
| p-n3-008 Trận động đất lúc nửa đêm | Nhật ký | 14 | 343 / 803 | 0 |
| p-n3-009 Thông báo thay đổi giờ xe buýt | Thông báo | 12 | 313 / 774 | 0 |
| p-n3-010 Tiếng Nhật học qua phim hoạt hình | Bài viết | 12 | 338 / 765 | 0 |
| p-n3-011 Xin đổi ngày phỏng vấn | Email | 13 | 342 / 785 | 0 |
| p-n3-012 Kế hoạch du lịch Hokkaido | Hội thoại | 12 | 335 / 710 | 0 |
| p-n4-007 Mùa đông ở Nhật | Thư | 16 | 316 / 706 | 0 |
| p-n4-008 Ngày bị cảm | Nhật ký | 14 | 302 / 699 | 0 |
| p-n4-009 Thông báo lễ hội mùa hè | Thông báo | 15 | 298 / 723 | 0 |
| p-n4-010 Chụp ảnh | Bài viết | 12 | 311 / 642 | 0 |
| p-n4-011 Về buổi học thử | Email | 13 | 319 / 600 | 0 |
| p-n4-012 Vé Shinkansen | Hội thoại | 14 | 330 / 700 | 0 |
| p-n5-007 Lá thư kỳ nghỉ hè | Thư | 14 | 252 / 515 | 1 |
| p-n5-008 Ngày đi mua quần áo | Nhật ký | 13 | 250 / 586 | 1 |
| p-n5-009 Thông báo lớp dạy nấu ăn | Thông báo | 15 | 260 / 576 | 0 |
| p-n5-010 Gia đình tôi | Bài viết | 14 | 251 / 599 | 0 |
| p-n5-011 Đến nhà tớ chơi không? | Email | 15 | 256 / 496 | 0 |
| p-n5-012 Ở nhà hàng | Hội thoại | 13 | 261 / 490 | 0 |

- **Độ dài đạt mục tiêu** (đợt 1 thiếu 10–20%): N5 250–261, N4 298–330, N3 313–343 ký tự Nhật. Bản đầu cũng thiếu → đã thêm 1–3 câu khớp mạch truyện cho 14/18 đoạn. Tiếng Việt cao nhất 838/900 (`p-n3-007`).
- **`vi_alt` / `ja_alt` vẫn ít** (chỉ vài câu) — câu nào thật sự có 2 cách dịch phổ biến mới thêm; prompt chấm đã coi bản mẫu là tham khảo.
- `check-passages` toàn bộ 36 đoạn: 383 W (đợt 2 thêm ~200), đã xem hết. Đã thay từ vượt cấp: N5 材料, 連絡; N3 日程 (N2). Còn lại chấp nhận như đợt 1: Sudachi đọc sai (九月 くがつ, 二十日 はつか, 一日 ついたち, 八千円 はっせんえん, 一階 いっかい, 四時 よじ, 七時 しちじ, 辛く からく, 町 ちょう, 御社 おんしゃ, 富士山 ふじさん, (水) すい); từ cơ bản không có mục riêng trong dữ liệu Minna (夜, 最初, 場合, 気持ち…); từ cấp N4 dùng tự nhiên trong đoạn N5 (市場, 東口, 高校生); thán từ / câu chào; từ thường viết kana.
- Script chuyển bản dòng → JSON viết lại (thư mục tạm bị dọn) với cột `vi_alt` / `ja_alt`, **nối thêm** vào `nX.json` (không ghi đè đợt 1), chạy lại thì thay đúng đoạn cùng id.
- Kiểm tra: `build-translation` pass; pytest 243; `npm run build` pass (236 unit test, 36 trang `/dich/doan/<id>/`); e2e `translation.spec.ts` 10/10.
- Chưa deploy worker / merge: chờ user duyệt nội dung (worker phải deploy lại để chấm được 18 đoạn mới).
