# Q8 — Trang tổng /luyen-tap/

> Phần chung (quyết định D1–D6, kiến trúc, bất biến, luồng làm bài, checklist): [README.md](README.md). File này chỉ chứa riêng task Q8.

Trạng thái: 📝 spec chờ duyệt

## Nội dung

**Trang tổng `/luyen-tap/`** + mục menu + thẻ trang chủ; trộn nhiều deck

## Tiêu chí xong / kết quả

Test trộn deck không trùng `id`; kiểm tay; SEO (`description`, 1 `<h1>`)

## Spec (chờ duyệt)

**Mục tiêu:** một trang `/luyen-tap/` ôn tổng hợp theo tiến độ học Minna: chọn tới bài nào + phần nào → trộn câu của nhiều phần trong cùng một lượt. Trang từng phần vẫn giữ nguyên cho luyện sâu (đủ mọi loại câu, N3, bộ thủ).

**Hiện trạng dùng lại được:**
- Runner đã nhận nhiều file + `toItems` (Q6) → trang tổng tải file của các phần rồi gộp câu, không sinh deck mới.
- Mọi phần đều có tag bài theo Minna 1–50: từ vựng `lesson`, Kanji xếp theo **bài từ vựng** (`tv-…`) `lesson`, chia thể "đã học tới bài". Đếm số không có bài.
- ID câu có tiền tố theo loại (`v-`, `k-`, `c-`, `n-`) → gộp không trùng `id` (test vẫn kiểm).

**Bố cục trang** (khung "Tùy chọn luyện tập" như các trang khác):

```
Bài:      [ 1 ▾ ] – [ 25 ▾ ]            (Minna 1–50)
Phần:     (✓ Từ vựng) (✓ Kanji) (✓ Chia thể) (✓ Đếm số)
Số câu:   [10] [20] [100] [Tự nhập]
Furigana: [Hiện] [Ẩn]
                                         [ Bắt đầu → ]
```

Thẻ câu hỏi có nhãn góc "Từ vựng · Đọc", "Kanji · Hán-Việt"… để biết đang hỏi phần nào; link sau khi trả lời dẫn về trang chi tiết như ở trang từng phần.

| # | Vấn đề | Đề xuất | Phương án khác |
|---|---|---|---|
| Q8-1 | Phạm vi bài: mỗi phần lọc bài một kiểu | **Một ô "Bài từ – đến" (Minna 1–50)** áp cho mọi phần: từ vựng và Kanji (xếp theo bài từ vựng) lấy câu có bài trong khoảng; chia thể lấy **từ** thuộc các bài trong khoảng, **thể** đã học tới bài "đến" (thêm `from` cho sách Minna trong `conjItems`); đếm số không theo bài → lấy nhóm "Cần nhớ" (149 câu). Mặc định 1–25. URL `tu`, `den`, `phan`, `so` (như các trang khác). **N3 không vào trang tổng** (bài N3 không cùng thang với Minna) | "Đã học tới bài B" (luôn từ bài 1): đơn giản hơn nhưng không ôn riêng được vài bài gần nhất |
| Q8-2 | Mỗi phần có 3–5 loại câu; cho chọn hết thì bảng tùy chọn dài 15 dòng chip | **Chỉ chọn phần; mỗi phần dùng bộ loại câu cố định** — Từ vựng: Đọc, Nghĩa, Điền từ · Kanji: Hán-Việt, Nghĩa, Cách đọc · Chia thể: Chia, Nhận thể · Đếm số: Đọc số + trợ số từ. Bỏ "Từ" (vựng), "Chữ"/"Bộ thủ" (Kanji), "Nhóm động từ" vì gần trùng loại khác hoặc nặng thuộc lòng; muốn loại đó → trang từng phần | Lưới chọn loại câu theo từng phần (linh hoạt nhưng rối, URL dài) |
| Q8-3 | Trộn: phần nhiều câu (Kanji ~3.000) lấn phần ít (đếm số 149) | **Chia đều theo phần**, trong mỗi phần chia đều theo loại câu (runner thêm cách chia nhóm 2 tầng; 20 câu × 4 phần = 5 câu/phần) | Bốc ngẫu nhiên trên tổng: lượt 20 câu gần như toàn Kanji/từ vựng |
| Q8-4 | Tải dữ liệu: bài 1–50 đủ 4 phần ≈ 15 file, **~550KB gzip** (Kanji đọc 82KB, bảng động từ 72KB…) | **Dùng lại đúng file của trang từng phần** (trình duyệt và PWA nhớ đệm chung: đã luyện ở trang Kanji thì trang tổng không tải lại); chỉ tải file của phần + cấp đã chọn (bài 1–25 chỉ tải file N5, khoảng ~250KB gzip); có dòng "Đang tải…" như hiện tại. Đếm số: thêm endpoint `/luyen-tap/dem-so.json` (đang nhúng thẳng vào trang `/dem-so/quiz/`) | Sinh deck "trộn" riêng theo bài lúc build (nhẹ hơn mỗi lần tải nhưng thêm 50+ file, mất nhớ đệm chung) |
| Q8-5 | Vị trí trong menu và trang chủ | **Mục menu cấp 1 "Luyện tập"** (icon 練 — luyện) đặt sau "Đếm số", không có menu con; tự có **thẻ ở trang chủ** (thẻ sinh từ `lib/nav.ts`), mô tả "Ôn tổng hợp từ vựng, Kanji, chia thể, đếm số theo bài đã học". Các mục "Luyện tập" trong từng phần giữ nguyên | Chỉ thêm nút trên hero trang chủ, không vào menu |

**Test:**
- Unit: hàm gộp chạy trên dữ liệu thật — mọi `id` duy nhất, `checkDeck` 0 lỗi trên tập gộp bài 1–50, mọi câu nằm trong khoảng bài (trừ đếm số), lọc phần đúng, chia đều theo phần (lượt 20 câu × 4 phần → 5/5/5/5).
- E2E `luyen-tap.spec.ts` (desktop + mobile, cả `BASE_PATH`): mặc định 1–25 đủ 4 phần, URL ↔ bộ lọc, chỉ tải file N5 khi bài ≤ 25, nhãn góc đúng phần, tắt hết phần → Bắt đầu báo rỗng, khóa/thu gọn khi làm bài, menu + thẻ trang chủ dẫn tới trang, không cuộn ngang, điều khiển 32px; SEO: `description`, đúng 1 `<h1>`.
