# Q4 — Quiz từ vựng /vocabulary/quiz/

> Phần chung (quyết định D1–D6, kiến trúc, bất biến, luồng làm bài, checklist): [README.md](README.md). File này chỉ chứa riêng task Q4.

Trạng thái: ✅ xong 2026-11-12

## Nội dung

**Quiz từ vựng** `/vocabulary/quiz/`

## Tiêu chí xong / kết quả

**Xong 2026-11-12** — `lib/quiz/kana.ts` (lỗi đọc máy sinh: trường âm, っ, âm nhỏ, đục; giữ đuôi ます/です), `lib/quiz/vocab.ts` (5 loại: đọc, nghĩa, từ, Hán-Việt, điền từ; gộp từ lặp → tag `lesson` nhiều giá trị; "Cũng đúng" theo tiêu chí chặt, loại nhiễu theo tiêu chí rộng), 15 file `/vocabulary/quiz/<cấp>-<loại>.json` (200–400KB gốc, ≤ 47KB gzip), trang lọc cấp / khoảng bài / loại câu (URL `cap`, `tu`, `den`, `loai`), nút "Luyện tập bài này", menu "Luyện tập". Đọc: 942/1.604 câu đủ 3 nhiễu máy sinh, còn lại bù cách đọc từ thật. Điền từ: bỏ danh từ riêng (câu dịch lộ tên). Test: unit 94 (15 deck × checkDeck, kích thước, trường hợp đã biết), e2e `vocab-quiz.spec.ts` 11 test × 2 màn hình; mẫu 100 câu đã soát

## Loại câu

| Loại | Hỏi → chọn | Nhiễu | Lưu ý loại trừ |
|---|---|---|---|
| `v-read` | Từ có kanji (không furigana) → cách đọc | Đọc của từ khác cùng bài/cùng độ dài; biến đổi dài/ngắn (おばさん/おばあさん), っ, đục | Chỉ từ có `kanji`; `accepted` gồm `variants` |
| `v-mean` | Từ tiếng Nhật → nghĩa VI | Nghĩa của từ cùng từ loại, cùng bài hoặc bài lân cận | Loại nhiễu có nghĩa trùng (từ đồng nghĩa, `same_word`) |
| `v-word` | Nghĩa VI → từ tiếng Nhật | Từ cùng từ loại | Như trên, hướng ngược |
| `v-hv` | Từ Hán → âm Hán-Việt | Âm Hán-Việt của từ khác có chung 1 chữ | Chỉ từ có `han_viet` |
| `v-cloze` | Câu ví dụ, cụm `[[…]]` thành chỗ trống → điền từ | Từ cùng từ loại cùng bài | Dùng `vi` làm gợi ý; giai đoạn sau vì cần chọn nhiễu cẩn thận |

## Q4 — quyết định (chốt 2026-11-12)

| # | Nội dung | Chốt |
|---|---|---|
| Q4-1 | Chia file câu hỏi | **Theo cấp × loại câu**: `/vocabulary/quiz/<n5\|n4\|n3>-<doc\|nghia\|tu\|hv\|dien>.json` (15 file). Đo N5: 196–335KB gốc, 26–52KB gzip mỗi file (1 file/cấp sẽ là 1MB / 175KB gzip). |
| Q4-2 | Điền chỗ trống (`v-cloze`) | **Làm ngay phần từ đích giữ nguyên dạng** (1.731/2.257 câu ví dụ: danh từ, tính từ な, trạng từ…); **hoãn** 526 câu từ đích đã biến đổi (chủ yếu động từ) sang sau Q6 — khi đó chia luôn đáp án nhiễu. |
| Q4-3 | Nhiễu câu hỏi đọc (`v-read`) | **4 lựa chọn = 1 đúng + 3 nhiễu máy sinh** (trường âm, っ, dấu đục, âm nhỏ ゃゅょ) — kiểu bẫy JLPT 漢字読み. Chỉ khi máy sinh không đủ 3 dạng hợp lệ mới bù bằng cách đọc của từ thật. Dạng máy sinh trùng một cách đọc đúng của chính chữ đó bị loại. |

**Sai khác so với spec Q4 (ghi nhận khi triển khai 2026-11-12):**

| # | Spec | Thực tế | Lý do / xử lý |
|---|---|---|---|
| 1 | Câu đọc: 3 nhiễu máy sinh (Q4-3) | 942/1.604 câu (59%) đủ 3 nhiễu máy sinh; còn lại máy sinh 0–2 dạng, bù bằng cách đọc của từ thật | Từ ngắn / toàn âm n, m, r, y, w (なに, いま, でんわ) ít biến thể. Đã bỏ dạng vô lý (よせいる, たべまっす, いじょうでいす) — chấp nhận tỉ lệ thấp hơn. Test giữ mốc ≥ 900 để bắt hồi quy. Muốn tăng: thêm loại lỗi mới trong `kana.ts` (vd bỏ ん giữa từ) |
| 2 | File câu hỏi < 350KB gốc | 200–403KB gốc (5 file > 350KB: n5-nghia, n5-tu, n5-dien, n4-nghia, n4-tu); gzip ≤ 47KB | Dung lượng thực tải về khớp ước tính (26–52KB gzip); phần vượt chỉ tốn thêm vài ms parse JSON. Giữ định dạng `Deck` đơn giản. Test: < 450KB gốc, < 60KB gzip. Cách giảm nếu cần: đưa `question`/`kind` lên cấp Deck (~-8%) hoặc bảng chuỗi dùng chung (~-55%) |
| 3 | Điền từ: mọi từ đích giữ nguyên dạng | Bỏ thêm danh từ riêng (`PN`) | Câu dịch giữ nguyên tên → lộ đáp án (新神戸 / "ga Shin-Kobe"), phát hiện khi soát ảnh chụp |
| 4 | (spec không nêu) | Câu điền từ có thể có nhiều đáp án hợp ngữ pháp ("＿は学生です": わたし / あなた) | Câu dịch tiếng Việt luôn hiện làm gợi ý → đáp án xác định theo nghĩa. **Cần user kiểm tay** vài lượt loại "Điền từ"; nếu gây nhầm thì thêm luật loại nhiễu cùng nhóm đại từ / cùng nghĩa ngữ cảnh |

**Chỉnh sau khi user test tay Q4 (2026-11-12):**
- Loại câu chọn nhiều trước đây trông như nút chọn một và tỉ lệ trộn lệch theo số câu mỗi loại (N5: Nghĩa 844, Đọc 557) → nút bo tròn nền nhạt + ✓, dòng "Chọn nhiều để trộn"; nhãn loại câu ở góc thẻ; **trộn đều**: `createQueue(…, groupOf)` bốc lần lượt từng loại (20 câu / 5 loại = 4 câu mỗi loại; loại hết câu thì nghỉ đến vòng mới).
- Bộ lọc đặt trong khung nền "Tùy chọn luyện tập", nhãn thẳng cột, dòng ngăn cách (áp dụng cả quiz đếm số).
- Số câu thêm **"Tự nhập"** (1–100; bỏ "Không giới hạn", thêm nút 100; số sai báo lỗi, giữ lượt đang làm; gõ số trong ô không bị coi là chọn đáp án).
- Thêm dòng **"Furigana: Hiện / Ẩn"** (prop `furiganaToggle` của QuizRunner, thuần CSS): ẩn cách đọc ở câu hỏi + lựa chọn; phản hồi, giải thích, tổng kết vẫn hiện. Chỉ bật ở quiz từ vựng (quiz đếm số không có furigana). Không lưu URL/localStorage.
- Test: unit +5 (trộn đều), e2e +4 (trộn đều 4/4/4/4/4, ✓, tự nhập, nhãn loại) → unit 99, e2e 26 × 2 màn hình.
