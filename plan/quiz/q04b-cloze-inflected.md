# Q4b — Điền từ cho từ đích đã biến đổi

> Phần chung (quyết định D1–D6, kiến trúc, bất biến, luồng làm bài, checklist): [README.md](README.md). File này chỉ chứa riêng task Q4b.

Trạng thái: ✅ xong 2026-11-13 — spec duyệt cùng ngày (Q4b-4: có trộn dạng chia sai; ~115 câu bỏ qua để sau, ghi ở [README.md](README.md) mục Lỗi dữ liệu). 2026-11-16: gỡ 54 câu N3 (mục Bổ sung) — còn 96 câu bỏ qua

Bối cảnh: [q04-vocab.md](q04-vocab.md) quyết định Q4-2 — loại "Điền từ" (`v-cloze`) hiện chỉ hỏi câu có từ đích **giữ nguyên dạng**. Q4b thêm câu có từ đích **đã chia** (`[[行きました]]`, `[[教えて]]`). Bộ chia dùng lại: `lib/quiz/conjugation.ts` ([q06-conjugation.md](q06-conjugation.md)).

## Khảo sát dữ liệu (2026-11-13)

525 câu ví dụ có từ đích đã biến đổi (bỏ danh từ riêng): động từ 497 (V1 269, V2 172, V3 56), tính từ い 13, trạng từ 9, khác 6.
So cụm `[[…]]` với bảng chia (`data/conjugation.json`) của đúng từ đó:

| Nhóm | Số câu | Ví dụ | Xử lý |
|---|---|---|---|
| Khớp đúng một thể | 380 | て 187, ました 124, từ điển 26, ます 12, ましょう 7, た 6… | ✅ làm |
| Từ không có hàng trong bảng chia, nhưng từ cùng chữ (`same_word`/cùng dạng gốc) có | 20 | 休みました (mn-11-004 → hàng của 休みます bài 4) | ✅ làm (tra hàng theo dạng gốc) |
| Thể + đuôi cố định | 10 | 忘れ**ないで** (ない + で), 掃除し**たり** (た + り) | ✅ làm: đáp án nhiễu cùng thể + cùng đuôi |
| Thể ghép không có trong bảng | ~40 | 褒められました (bị động + ました), 払わなければなりません, 出かけなくても, 足りなかったら | ⏸ bỏ qua |
| Từ N3 chưa có trong bảng chia | ~60 | 倒れました, 決めて (n3-101, n3-117…) | ~~⏸ bỏ qua — lỗi dữ liệu~~ → **chẩn đoán sai, đã sửa 2026-11-16**: các động từ này **có** trong `conjugation.json`, dưới dạng `aliases` của hàng Minna (n3-101 → mn-39-002); web chỉ tra theo `row.id` nên không thấy. Xem mục Bổ sung |
| Không phải chia thể | ~15 | 迎え / 切れ (danh từ hóa), 夫 /主人 (trường `kanji` chứa "/"), こちらは～さんです | ⏸ bỏ qua |

→ **~410 câu mới** (78%), N5 + N4 là chủ yếu. Câu bị bỏ qua được đếm trong unit test để thấy khi dữ liệu thay đổi.

## Spec

| # | Mục | Đề xuất |
|---|---|---|
| Q4b-1 | Loại câu | Vẫn là **`v-cloze`** ("Điền từ"), cùng file `/vocabulary/quiz/<cấp>-dien.json` → tự có trên trang Từ vựng và trang tổng `/luyen-tap/`, không đổi bộ lọc/URL. ID câu giữ dạng `v-cloze:<id câu ví dụ>` (ID mới, không đụng ID cũ). |
| Q4b-2 | Đáp án | Đúng cụm `[[…]]` trong câu (ruby của câu ví dụ). "Cũng đúng": không có (thể khác nhau là sai — xem Q4b-4). |
| Q4b-3 | Đáp án nhiễu — **từ khác, cùng thể** (chính) | Động từ/tính từ khác chia **đúng cùng thể** (+ cùng đuôi nếu có): `[[行きました]]` → 来ました, 帰りました, 買いました. Chọn như `v-cloze` hiện tại: cùng từ loại, gần bài, đã học tới bài của câu (`lesson ≤ max_lesson`), bỏ từ đồng nghĩa (`synonymous`). Lấy ruby từ bảng chia để furigana đúng. Câu dịch luôn hiện làm gợi ý → xác định được từ nào. |
| Q4b-4 | Đáp án nhiễu — **chính từ đó, chia sai** (phụ) | Thêm tối đa 1–2 dạng **chia sai** từ `wrongForms` của Q6 (行きて, 食べって, たかいでした) — chắc chắn không phải tiếng Nhật đúng nên không bao giờ chấm oan. **Không** dùng thể đúng khác của chính từ đó (行って vs 行きました) vì nhiều câu cả hai đều hợp ngữ pháp (ý câu dịch tiếng Việt không phân biệt thì quá khứ rõ ràng). Pool: 2 chia sai + 4 từ khác → `makeOptions` bốc ngẫu nhiên 3 trong 6 → mỗi câu thường có 0–2 dạng chia sai. |
| Q4b-5 | Thể chưa học | Chỉ hỏi khi thể đó đã học tới bài của câu (`forms[].lesson ≤ max_lesson` — câu ví dụ đã được giới hạn bài nên hầu như luôn đúng; kiểm tra để chắc chắn). |
| Q4b-6 | Giải thích sau khi trả lời | `行きました — thể ました của 行きます (đi)` (tên thể lấy từ bảng chia). `info` như hiện tại: "Bài N". |
| Q4b-7 | Dữ liệu lúc build | Endpoint `[deck].json.ts` đọc thêm `data/conjugation.json` (chỉ lúc build, không tải về trình duyệt). Hàm sinh thuần trong `lib/quiz/vocab.ts` nhận bảng chia làm tham số. |
| Q4b-8 | Dung lượng | Thêm ~410 câu vào các file `-dien` → nâng giới hạn kích thước trong `vocab.test.ts` theo số đo thực (hiện n5-dien ~59KB gzip / giới hạn 60KB). Ghi số đo vào "Sai khác". |

## Test

- Unit (`vocab.test.ts`, dữ liệu thật): mọi câu biến đổi qua `checkDeck`; đáp án nhiễu không trùng đáp án và không trùng **bất kỳ thể đúng nào** của chính từ đó; mọi nhiễu "từ khác" cùng thể với đáp án (so theo bảng chia); câu đã biết: `[[行きました]]` có nhiễu dạng `…ました`, `[[忘れないで]]` có nhiễu dạng `…ないで`; số câu bỏ qua ≤ mốc khảo sát (bắt hồi quy).
- E2E (`vocab-quiz.spec.ts`): loại "Điền từ" bài 4–6 có câu đáp án `…ました` và 4 lựa chọn đều kết thúc `ました` hoặc là dạng chia sai.

## Tiêu chí xong

~410 câu mới trong "Điền từ", build + unit + e2e xanh, mẫu 30 câu đã soát tay (nhiễu không hợp câu dịch).

## Quyết định của user (2026-11-13)

1. Q4b-4: **có** trộn dạng chia sai vào nhiễu.
2. ~115 câu bỏ qua: để sau, sửa dữ liệu nguồn — tồn đọng ghi ở [README.md](README.md) mục "Lỗi dữ liệu phát hiện qua quiz".

## Sai khác so với spec

| # | Spec | Thực tế | Lý do / ghi chú |
|---|---|---|---|
| 1 | ~410 câu mới | **386 câu** (N5 82, N4 142, N3 162); 0 câu bị bỏ vì thiếu nhiễu | Phần chênh: câu tự lộ đáp án (`leaks`) và thể chưa học tới bài của câu bị loại. Mốc trong test: bỏ qua ≤ 150 câu (đo 148, gồm cả câu Q4 bị loại vì lộ đáp án) |
| 2 | Dung lượng: nâng theo số đo | `-dien`: n5 440KB gốc / 62KB gzip, n4 397KB / 64KB, n3 380KB / 64KB → giới hạn gzip trong test 60KB → **70KB** | n5-dien gốc sát giới hạn 450KB của test — nếu thêm câu (sau khi sửa dữ liệu) cần tách file hoặc nâng giới hạn |
| 3 | Nhiễu "từ khác" cùng từ loại | Cùng **nhóm bảng chia** (động từ / tính từ い / な), cùng sách, đã học tới bài của câu, gần bài trước; bỏ từ đồng nghĩa | Không xếp theo vị trí trong bài (như `v-mean`) vì nhiễu cùng chủ đề dễ cũng hợp câu |
| 4 | Thể trùng chữ | V2 khả năng = bị động (食べられる) → lấy thể đứng trước trong bảng (khả năng); thể + đuôi: chọn đuôi ngắn nhất | Từ khác chia cùng thể đó nên nhiễu vẫn nhất quán |
| 5 | Giải thích | `来ました = Quá khứ lịch sự · 来ます（きます） — đến · LAI`; có đuôi: `入らないで = Thể ない + で · …` | — |
| 6 | Tra hàng bảng chia | Theo ID → `same_word` → cùng dạng gốc (cùng sách); **từ 2026-11-16** thêm `aliases` của bảng chia sau `same_word` | 休みます bài 11 dùng hàng bài 4 |

Kiểm tra: unit 189 (thêm 3 test Q4b: số câu mỗi cấp + mốc bỏ qua; nhiễu không trùng thể đúng nào của chính từ + cùng đuôi ました/ません/ないで; câu 来ました), e2e 140 (thêm: bài 14 có câu thể て, 4 lựa chọn đều đuôi て/で, giải thích ghi tên thể).

## Bổ sung 2026-11-16 — từ N3 trùng Minna (54 câu)

Khảo sát lại 148 câu bỏ qua (theo cách đếm của `vocab.test.ts`):

| Nhóm | Số câu | Nguyên nhân | Trạng thái |
|---|---|---|---|
| A | 54 | Từ N3 trùng từ Minna: bảng chia chỉ có **một hàng** (của Minna), ID N3 nằm trong `aliases`. `buildConjTable` bỏ `aliases`, `conjIndex` tra theo `row.id` → không thấy hàng | ✅ sửa ở web |
| C | 26 | Câu ví dụ viết khác cách viết của từ vựng: 点けて / つけます, 噛んで / かみます, 診て / 見ます, 量って / 測ります… (web so mặt chữ) | ⏸ chờ chọn hướng: so kana ở web, hay chuẩn hóa chữ trong câu ví dụ ở pipeline |
| E | 43 | Thể ghép chưa có trong bảng (bị động + ました bài 37, なければなりません / なくても bài 17, なかったら bài 25, sai khiến + ます); thân ます / gốc tính từ trước そう (bài 43: 切れ, 落ち, 美味, 優し); danh từ hóa (迎え, 買い物) | ⏸ pipeline |
| — | 24 | Không có trong bảng chia: danh từ (本, 国, 山…), trường `kanji` nhiều cách viết (mn-09-033, mn-09-035, mn-24-009/010), mẫu câu, phó từ N3 `ずいぶん～なる` | ⏸ pipeline (tách cách viết thứ hai ra `variants`) |
| B | 1 | mn-08-016 悪く khớp mặt chữ, bị loại vì lý do khác | xem sau |

Sửa nhóm A:
- `ConjRow.aliases` (chỉ ghi khi không rỗng) — `chia-the/quiz/dong-tu.json` 742KB → 744KB.
- `conjIndex`: ID → `same_word` → **`aliases`** → cùng dạng gốc. `same_word` phải đứng trước: alias gộp theo kana nên có thể trỏ sang từ khác nghĩa — mn-22-004 掛けます "đeo kính" là alias của mn-07-009 かけます "gọi điện"; đặt alias trước thì mất 2 câu cũ (mn-22-004-e1, mn-34-005-e1).
- Nhiễu "từ khác cùng thể" cho câu N3: thêm từ Minna (mọi bài — người học N3 đã học hết Minna), ưu tiên từ cùng sách trước → câu N3 cũ giữ nguyên nhiễu.

Kết quả: N3 162 → **216** câu chia thể; N5 81, N4 141 không đổi; bỏ qua 148 → **96**; câu cũ giữ nguyên ID và nhiễu (so bản build trước/sau). `n3-dien.json` 380KB → 415KB gốc, ~69KB gzip (**sát mốc 70KB** của test). Test: mốc `skipped <= 100`, N3 ≥ 200, thêm test n3-101/108/117/333 có câu và mn-22-004 vẫn tra qua `same_word`.
