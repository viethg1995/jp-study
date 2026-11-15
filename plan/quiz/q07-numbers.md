# Q7 — Quiz số đếm `n-num`

> Phần chung (quyết định D1–D6, kiến trúc, bất biến, luồng làm bài, checklist): [README.md](README.md). File này chỉ chứa riêng task Q7.

Trạng thái: ✅ xong 2026-11-13 — spec duyệt cùng ngày (đồng ý cả 3 đề xuất: loại câu riêng chọn một; đưa vào trang tổng; chưa làm số ngẫu nhiên)

## Khảo sát dữ liệu (2026-11-13)

`data/counters.json` → `numbers` (trang `/dem-so/so-dem/`): 5 tab, **106 số**, mỗi số có `display` (cách viết kiểu Nhật), `kanji`, `kana`, `alt[]` (cách đọc khác cũng đúng), `irregular` (biến âm cần nhớ), `note`.

| Tab | Số mục | Ví dụ |
|---|---|---|
| 0 – 99 | 25 | 4 よん (alt し), 7 なな (alt しち), 19 じゅうきゅう (alt じゅうく), 40 よんじゅう |
| Trăm · nghìn | 22 | 300 さんびゃく, 600 ろっぴゃく, 3,000 さんぜん, 3,800 さんぜんはっぴゃく |
| Vạn · ức | 12 | 10,000 いちまん, 12,345, 10,000,000 せんまん (alt いっせんまん) |
| Thập phân · % | 18 | 3.14 さんてんいちよん, 8.2 はってんに (alt はちてんに), 2/3 さんぶんのに, 50% ごじゅっパーセント |
| Số khác | 9 | -2.5 マイナスにてんご, 第1 だいいち, 090-1234-5678 |

`n-pick` (đồ vật → chọn trợ số từ) **không làm** trong Q7: chưa có dữ liệu "trợ số từ dùng cho cái gì" dạng hỏi được.

## Spec

| # | Mục | Đề xuất |
|---|---|---|
| Q7-1 | Vị trí | Trang `/dem-so/quiz/` (đổi tiêu đề thành "Luyện đếm số" giữ nguyên). Thêm dòng **Loại câu** (chọn một, Segmented): **Đếm đồ vật** (`n-ctr`, mặc định — như hiện tại) · **Số** (`n-num`). URL `?loai=so`. Chọn "Số" → ẩn 3 dòng lọc của trợ số từ (Trợ số từ, Nhóm âm, Ô hỏi), hiện dòng **Nhóm số**. |
| Q7-2 | Bộ lọc Nhóm số | Chọn một: Tất cả · 0–99 · Trăm·nghìn · Vạn·ức · Thập phân·% · Số khác (= tab của trang Số đếm). URL `?loai=so&nhom-so=tram-nghin`. |
| Q7-3 | Câu hỏi | Đề = `display` (3,800 · 1/2 · 0.5% · 第1), câu hỏi "Đọc thế nào?". Đáp án = `kana`; **`accepted` = `alt`** (4 → よん, し cũng đúng; 1,000 → せん, いっせん cũng đúng) → "Cũng đúng" sau khi trả lời, và không cách đọc đúng nào lọt vào nhiễu. Chỉ dùng 106 số có trong dữ liệu (không tự sinh cách đọc — luật 5). ID `n-num:<tab>-<display>` cố định (vd `n-num:hundreds-3,800`). |
| Q7-4 | Đáp án nhiễu (máy sinh, chắc chắn sai) | Ưu tiên **lỗi người học hay mắc**: (a) **biến âm sai / thiếu**: さんびゃく → さんひゃく, ろっぴゃく → ろくひゃく, はっせん → はちせん, さんぜん → さんせん; thêm biến âm vào chỗ không có: ごびゃく, よんぜん, ろっせん (6,000 không biến âm); (b) **bỏ いち** trước 万/億: いちまん → まん; (c) **phân số đảo tử/mẫu**: 1/3 さんぶんのいち → いちぶんのさん; (d) **thập phân đọc liền**: 3.14 → さんてんじゅうよん. Thiếu thì bù bằng cách đọc của **số gần trong cùng mục** (300 → よんひゃく, にひゃく). **Không** dùng đổi 4/7/9 (しひゃく, しちひゃく) — có cách đọc cũ/hiếm, không chắc là sai. Mọi nhiễu loại `kana` + `alt`. |
| Q7-5 | Thông tin | `info` (icon ⓘ): cách viết chữ Hán (三千八百) + tên nhóm ("Trăm · nghìn"). Giải thích sau khi trả lời: `note` nếu có (vd "ろく + ひゃく → ろっぴゃく"). Link "Xem bảng số đếm →" tới `/dem-so/so-dem/` đúng tab. |
| Q7-6 | Trang tổng `/luyen-tap/` | Phần **Đếm số** gồm cả `n-num` (106 câu) bên cạnh `n-ctr` (149 ô cần nhớ), chia đều theo loại câu như các phần khác. Nhãn góc thẻ: "Đếm số · Đồ vật" / "Đếm số · Số". File `/luyen-tap/dem-so.json` thêm câu `n-num`. |
| Q7-7 | Dữ liệu | Câu hỏi sinh lúc build (hàm thuần mới `lib/quiz/numbers.ts`), nhúng HTML như `n-ctr` hiện tại (106 câu, nhỏ). |

## Test

- Unit (`numbers.test.ts`, dữ liệu thật): đủ 106 câu, ID duy nhất, `checkDeck` 0 lỗi; mỗi câu ≥ 3 nhiễu; không nhiễu nào trùng `kana`/`alt`; câu đã biết: 4 → accepted có し, nhiễu không có し; 300 → nhiễu có さんひゃく; 600 → ろくひゃく; 10,000 → まん; 1/3 → いちぶんのさん; 3.14 → さんてんじゅうよん; 6,000 → ろっせん.
- E2E (`counter-quiz.spec.ts`): `?loai=so` → câu hỏi là số, 3 dòng lọc trợ số từ ẩn, dòng Nhóm số hiện; `?loai=so&nhom-so=thap-phan` → chỉ số thập phân / phân số / %; chọn 4 → trả lời し được chấm đúng (nếu lượt có câu 4); mặc định (không `loai`) vẫn như cũ; trang tổng có nhãn "Đếm số · Số".

## Tiêu chí xong

106 câu `n-num` trên `/dem-so/quiz/` và trang tổng, build + unit + e2e xanh, mẫu đủ 106 câu đã soát (nhiễu chắc chắn sai).

## Quyết định của user (2026-11-13)

1. "Số" là loại câu riêng (chọn một) trên trang Luyện đếm số.
2. Câu số vào phần Đếm số của trang tổng `/luyen-tap/`.
3. Chưa làm chế độ số ngẫu nhiên.

## Sai khác so với spec

| # | Spec | Thực tế | Lý do / ghi chú |
|---|---|---|---|
| 1 | 106 số | **86 số** (25 + 22 + 12 + 18 + 9) | Khảo sát cộng nhầm; dữ liệu không đổi |
| 2 | Nhiễu: biến âm, bỏ いち, phân số đảo, thập phân đọc liền | Thêm: **thêm いち trước 十/百 đứng đầu** (10 → いちじゅう, 100 → いちひゃく, 100,000 → いちじゅうまん) | Lỗi người học hay mắc, chắc chắn sai. Không làm với 千 vì いっせん cũng đúng |
| 3 | ID `n-num:hundreds-3,800` | Đúng như spec: `n-num:<tab>-<display>` | — |
| 4 | Link tới đúng tab | `/dem-so/so-dem/#hundreds` + script nhỏ ở trang Số đếm chọn tab theo hash | Tab vốn là radio + CSS, không có JS |
| 5 | Dòng tóm tắt khi làm bài | Có thêm "Loại câu: …" ở đầu (cả loại Đồ vật) | Hành vi chung của runner (mọi dòng lọc đang hiện) |
| 6 | — | Nhóm "Số khác" (số âm, thứ tự, số điện thoại) nhiễu yếu: chỉ bù bằng cách đọc số khác trong cùng tab | Chưa có lỗi hay gặp nào chắc chắn sai cho nhóm này; xem lại nếu user thấy quá dễ |

Dung lượng: trang `/dem-so/quiz/` 206KB gốc / 23KB gzip (câu nhúng HTML); `/luyen-tap/dem-so.json` 177KB / 14KB.

Kiểm tra: unit 194 (thêm `numbers.test.ts` 5 test: đủ 86 câu + checkDeck; không cách đọc đúng nào lọt vào nhiễu; 4/7/9 nhận し/しち/く; 12 lỗi hay gặp có trong 6 mục đầu pool; ⓘ + link tab), `mix.test.ts` đếm thêm 86 câu số; e2e 148 (thêm 4 test loại "Số" × 2 màn hình: ẩn/hiện dòng lọc + URL, lọc nhóm thập phân, câu 4 hiện "Cũng đúng: し" + link mở đúng tab; trang tổng nhãn "Đếm số · Đồ vật / Số").
