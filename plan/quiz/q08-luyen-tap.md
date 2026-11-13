# Q8 — Trang tổng /luyen-tap/

> Phần chung (quyết định D1–D6, kiến trúc, bất biến, luồng làm bài, checklist): [README.md](README.md). File này chỉ chứa riêng task Q8.

Trạng thái: ✅ xong 2026-11-13 (spec duyệt toàn bộ Q8-1…Q8-5 theo đề xuất)

## Nội dung

**Trang tổng `/luyen-tap/`** + mục menu + thẻ trang chủ; trộn nhiều deck

## Tiêu chí xong / kết quả

Test trộn deck không trùng `id`; kiểm tay; SEO (`description`, 1 `<h1>`)

**Xong 2026-11-13** — `lib/quiz/mix.ts` (`mixFiles` chọn file theo phần + cấp có bài trong khoảng, `mixItems` gộp + lọc bài, `MIX_KIND_LABELS`), `createQueue(…, groupOf, subOf)` trộn đều 2 tầng (`interleave` trong `core.ts`, `partOf` = tiền tố kind), prop `balanceParts` của QuizRunner, `conjItems` Minna nhận `from`, endpoint `/luyen-tap/dem-so.json`, trang `/luyen-tap/` (Bài từ–đến, Phần, Số câu, Furigana; link luyện sâu từng phần), mục menu cấp 1 "Luyện tập" (練) + thẻ trang chủ. Test: unit +9 (`mix.test.ts` 8 trên dữ liệu thật: file theo cấp, id duy nhất + `checkDeck` bài 1–50, lọc bài 10–12 + thể đã học, gợi ý nhóm từ, đếm số 149, chia đều 5/5/5/5 và loại câu chênh ≤ 1 qua 10 seed; `core.test.ts` +1 nhóm con nhỏ không bị dồn cuối) → 185; e2e `luyen-tap.spec.ts` 9 × 2 màn hình → tổng 130

## Spec (đã chốt 2026-11-13)

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

## Sai khác so với spec Q8 (khi triển khai)

| # | Spec | Thực tế | Lý do |
|---|---|---|---|
| 1 | Bài 1–25 tải ~250KB gzip, 1–50 ~550KB | **377KB** (10 file) / **599KB** (16 file) gzip | Ước cũ thiếu file "Điền từ" (53KB) và Kanji "Cách đọc" (82KB). Chấp nhận: file dùng chung nhớ đệm với trang từng phần; muốn nhẹ hơn thì bỏ bớt loại câu nặng ở Q8-2 |
| 2 | URL có `so` (số câu) | Không ghi số câu lên URL | Không trang quiz nào ghi số câu (runner tự quản); giữ thống nhất |
| 3 | (spec không nêu) | Gợi ý câu chia thể thêm nhóm từ ở đầu: "Động từ · …", "Tính từ い · …" | Trộn động từ + tính từ trong một lượt, cần biết đang chia loại từ nào |
| 4 | (spec không nêu) | Trộn 2 tầng: trong mỗi phần, câu xếp **xen kẽ theo loại câu rồi đảo ngược** (hàng đợi bốc từ cuối) | Không đảo thì loại câu nhiều nhất (Từ vựng · Nghĩa) chiếm hết 5 câu của phần — test bắt được |
| 5 | (spec không nêu) | Sửa lỗi tiềm ẩn ở `/chia-the/quiz/`: chỉ truyền `from`/`to` khi sách N3 | `conjItems` Minna giờ dùng `from` (Q8-1); trang chia thể trước đó luôn truyền `from` của ô N3 |
