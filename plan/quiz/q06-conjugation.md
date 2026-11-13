# Q6 — Quiz chia thể /chia-the/quiz/

> Phần chung (quyết định D1–D6, kiến trúc, bất biến, luồng làm bài, checklist): [README.md](README.md). File này chỉ chứa riêng task Q6.

Trạng thái: ✅ xong 2026-11-12

## Nội dung

**Quiz chia thể** (spec bên dưới): `lib/quiz/conjugation.ts` (quy tắc sinh lỗi nhóm/biến âm), `c-to`, `c-which`, `c-group`; endpoint theo nhóm; trang `/chia-the/quiz/` lọc nhóm từ + thể + bài; mục 6 trong STATUS hết TODO

## Tiêu chí xong / kết quả

**Xong 2026-11-12** — `lib/quiz/conjugation.ts` (bảng chia gọn `buildConjTable`, bộ chia sai `godan`/`ichidan`/biến âm て/い↔な, `conjItems` chạy trên trình duyệt), endpoint `/chia-the/quiz/<dong-tu|tinh-tu-i|tinh-tu-na>.json`, runner `setFilter(filter, decks, toItems)`, `checkDeck` cho phép câu 3 lựa chọn (`MIN_POOL_BY_KIND`), trang `/chia-the/quiz/` (nhóm từ, sách, đã học tới bài / bài N3, nhóm động từ, thể + Chọn hết/Bỏ chọn, loại câu, Furigana), nút "Luyện tập" ở trang thể + bảng chia, menu. Test: unit 23 (toàn bộ dữ liệu × checkDeck, 書きます/行きます/帰ります/食べます/いい/長い/きれい, 154 cặp khả năng = bị động, lọc bài 15/50, N3, 3 lựa chọn; thử bỏ bước loại trùng → 6 test đỏ), e2e `conjugation-quiz.spec.ts` 10 × 2 màn hình (cả `BASE_PATH`)

## Spec (đã chốt Q6-1…Q6-5 theo đề xuất, 2026-11-12)

**Số liệu** (`data/conjugation.json`, đo 2026-11-12):

| Mục | Số |
|---|---|
| Từ | 714: động từ 531 (nhóm I 279, II 156, III 96), tính từ い 86, tính từ な 95, danh từ 2 (あめ, がくせい — chỉ làm mẫu). Minna 445, N3 269 (bài N3 1–14) |
| Thể | Động từ 20 thể (ます bài 4 … sai khiến bài 48; bị bắt làm `lesson` = null), tính từ い 11, な 12. Tổng 12.697 ô chia, 1.422 ô bất quy tắc (V3 1.344, V1 50 — 行きます…, い 27 — いい, V2 1) |
| Trùng kana | 154 từ có thể khả năng = bị động (V2 たべられる) — chỉ cặp này |
| Thiếu thể | 9 từ: わかります/できます/みえます/きこえます không có khả năng; あります thiếu 9 thể; kính ngữ (くださいます, いらっしゃいます, おっしゃいます, なさいます) thiếu 5 thể |
| Duyệt | Quy tắc `enrichment/conjugation/forms.json` là `ai`, chờ duyệt (D4: vẫn đưa vào quiz) |
| Dung lượng | File bảng tra hiện có `/chia-the/dong-tu/te.json` (531 từ × 1 thể) = 33KB gốc / **5,6KB gzip** |

**Loại câu:**

| Loại | Hỏi → chọn | Nhiễu (sinh bằng quy tắc "lỗi hay gặp", luôn loại mọi dạng đúng) |
|---|---|---|
| `c-to` Chia | {書|か}きます · **Thể て** → {書|か}いて | V1: biến âm て/た sai (かって, かんで, かして) + chia như V2 (かきて). V2: chia như V1 (たべって, たべらない, たべれる) — bẫy 帰ります/食べます. V3: dạng chia theo quy tắc thường (きない ← こない, しれる ← できる). い: chia như な (たかいでした, たかいじゃない, たかじゃない); いい → いくない. な: chia như い (しずかかった, しずかくない). Bù: thể khác của chính từ (て ↔ た, ない ↔ なかった) |
| `c-which` Nhận thể | たべさせる → **Thể nào?** | Tên thể khác cùng nhóm từ, ưu tiên thể có đuôi giống (られる / させる / させられる; たら / ば). Khả năng ↔ bị động trùng kana → **cả hai đều đúng** (`accepted`). Không hỏi thể dùng làm đề (ます với Minna) |
| `c-group` Nhóm động từ | かえります → **Nhóm I / II / III** | Chỉ động từ. **3 lựa chọn** (Q6-3). Bẫy hay gặp: かえります/はいります/きります (I, trông như II), おきます/みます/かります (II, hàng い) |

Đề `c-to`: từ ở dạng gốc của giáo trình — Minna: thể ます; N3: thể từ điển. Gợi ý: nghĩa + bài. Sau khi trả lời: quy tắc của ô (`rule`, vd "き → いて"), ô bất quy tắc ghi "Bất quy tắc". Có dòng **Furigana: Hiện / Ẩn** (đáp án là chữ có furigana).

**Trang `/chia-the/quiz/`** — bộ lọc (URL):
- **Nhóm từ** (chọn một): Động từ · Tính từ い · Tính từ な. Danh từ bỏ (2 từ). `?nhom=dong-tu`
- **Sách** (chọn một): Minna · N3.
  - Minna → **Đã học tới bài** B (1–50, mặc định 50): chỉ từ có bài ≤ B **và** thể có bài ≤ B (thể bị bắt làm chỉ khi B = 50). `?sach=minna&bai=20`
  - N3 → **Bài** từ–đến (1–14), mọi thể. `?sach=n3&tu=1&den=5`
- **Nhóm động từ** (chọn nhiều, chỉ khi Động từ): I · II · III. `?dt=1,2`
- **Thể** (chọn nhiều): chỉ hiện thể đã học tới bài B; mặc định tất cả. `?the=te,ta,nai`
- **Loại câu** (chọn nhiều, trộn đều): Chia · Nhận thể · Nhóm động từ.
- Nút "Luyện tập thể này →" ở trang `/chia-the/the/<nhóm>/<thể>/` và "Luyện tập →" ở bảng tra `/chia-the/dong-tu|tinh-tu-i|tinh-tu-na/`; menu "Luyện tập" dưới Chia thể.

**Quyết định cần chốt:**

| # | Bối cảnh | Đề xuất | Nếu không theo / phương án khác |
|---|---|---|---|
| Q6-1 | Động từ 531 × 20 thể = 10.620 câu `c-to`. Đóng gói sẵn như Q4/Q5: mỗi câu ~350B → mỗi thể ~25KB gzip, chọn đủ 20 thể ≈ **500KB gzip** | **Sinh câu trên trình duyệt** từ bảng chia gọn: 1 file mỗi nhóm từ (động từ ~110KB gzip, đủ 20 thể; tính từ ~15KB), hàm sinh câu `lib/quiz/conjugation.ts` chạy ở client (~4KB JS). Nhiễu lọc theo đúng bài đã học (không đưa thể chưa học vào `c-which`). Unit test vẫn chạy hàm sinh trên **toàn bộ** dữ liệu + `checkDeck` như Q4/Q5. Runner thêm tham số chuyển JSON → câu hỏi | Đóng gói sẵn: tải nặng gấp ~5 lần khi chọn nhiều thể; nhiễu `c-which` lấy cả thể chưa học |
| Q6-2 | Minna xếp thể theo bài (ます 4 … sai khiến 48); N3 không xếp thể theo bài | Minna: **"Đã học tới bài B"** lọc cả từ lẫn thể (D6). N3: lọc bài từ vựng, mọi thể | Chỉ lọc thể (bỏ "đã học tới bài"): người học bài 15 vẫn gặp từ bài 40 |
| Q6-3 | `c-group` chỉ có 3 đáp án (I/II/III); khung hiện tại luôn 4 lựa chọn | **Cho phép câu 3 lựa chọn** (runner hiện theo số lựa chọn, phím 1–3; `checkDeck` cho phép pool 2 với kind `c-group`) | Bỏ `c-group`; hoặc ép 4 lựa chọn bằng lựa chọn vô lý ("Tính từ い") — lộ đáp án |
| Q6-4 | Nhiễu `c-to` cần "chia sai theo nhóm khác" → phải viết bộ chia động từ/tính từ bằng TS (pipeline Python đã có, nhưng web không gọi được) | **Viết bộ "chia sai" nhỏ trong TS** chỉ cho nhiễu (đáp án đúng luôn lấy từ `data/`); test: mọi nhiễu ≠ mọi dạng đúng của từ; bảng ca đã biết (書きます→て có かって/かきて, không có かいて; 帰ります↔食べます; いい; しずか) | Chỉ dùng "thể khác của chính từ" làm nhiễu: dễ đoán (độ dài/đuôi khác hẳn) |
| Q6-5 | `c-which`: たべられる vừa khả năng vừa bị động | **Cả hai đúng**; giải thích ghi "V2: khả năng = bị động". Không hỏi `c-which` cho thể ます-family? → **vẫn hỏi** ません/ました/ませんでした/ましょう (người mới cần), chỉ bỏ ます (trùng đề) | Bỏ hẳn từ V2 ở 2 thể này: mất 154 × 2 câu dễ nhầm nhất |

**Test:** unit — sinh câu cho mọi từ × thể × loại → `checkDeck` 0 lỗi, ≤ 2% câu thiếu nhiễu; bảng ca đã biết (Q6-4); 154 cặp khả năng/bị động có `accepted`; lọc bài B: không câu nào có thể/từ bài > B; 9 từ thiếu thể không sinh câu thể đó. E2E `conjugation-quiz.spec.ts` theo checklist ([README](README.md#checklist)) + câu 3 lựa chọn (phím 4 không chọn gì) + lọc bài + nút "Luyện tập" + Furigana.

**Sai khác so với spec Q6** (khi triển khai):

| # | Spec | Thực tế | Lý do |
|---|---|---|---|
| 1 | Bảng động từ ~110KB gzip | **71KB** gzip (725KB gốc); tính từ い 7KB, な 9KB | Ước lượng cũ dư |
| 2 | Hàm sinh chạy `checkDeck` như Q4/Q5 | Trên trình duyệt **không** gọi `checkDeck` (chiếm ~60% thời gian): nhiễu đã loại trùng đáp án + kiểm ruby lúc sinh, chỉ bỏ câu thiếu nhiễu / tự lộ; unit test chạy `checkDeck` trên toàn bộ dữ liệu (0 lỗi). Trường hợp nặng nhất (531 động từ × 20 thể × 3 loại) ~0,2–0,3s | Sinh lại mỗi lần đổi bộ lọc |
| 3 | (spec không nêu) | Bỏ 5 câu Chia thể mệnh lệnh của động từ kính ngữ (くださいます → ください…) | Đáp án nằm sẵn trong đề (quy tắc 5) |
| 4 | Nhiễu bù = thể khác của chính từ | Bù theo **cùng độ lịch sự** với đáp án rồi độ dài gần nhất (hỏi thể て → する/した/しろ, không phải しません); `c-which` cũng ưu tiên tên thể cùng độ lịch sự | Bù thể lịch sự cho câu thể thường lộ ngay |
| 5 | (spec không nêu) | URL chỉ ghi `the` / `dt` khi **không** chọn đủ; mobile: dòng "Thể" đặt nhãn trên, "Nhóm từ" xuống dòng (375px tràn 20px) | URL gọn; không cuộn ngang |
