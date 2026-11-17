# Q4b — Điền từ cho từ đích đã biến đổi

> Phần chung (quyết định D1–D6, kiến trúc, bất biến, luồng làm bài, checklist): [README.md](README.md). File này chỉ chứa riêng task Q4b.

Trạng thái: ✅ xong 2026-11-13 — spec duyệt cùng ngày (Q4b-4: có trộn dạng chia sai; ~115 câu bỏ qua để sau, ghi ở [README.md](README.md) mục Lỗi dữ liệu). 2026-11-16: gỡ 54 câu N3 rồi 30 câu nhóm B/C (mục Bổ sung) — còn **66** câu bỏ qua

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
| C | 26 | Câu ví dụ viết khác cách viết của từ vựng: 点けて / つけます, 噛んで / かみます, 診て / 見ます, 量って / 測ります… (web so mặt chữ). Trong đó 2 câu thật ra do **lỗi từ loại** 連れて来ます / 帰って来ます (V1 → chia sai) | ✅ sửa 2026-11-16 (Bổ sung 2) |
| E | 43 | Thể ghép chưa có trong bảng (bị động + ました bài 37, なければなりません / なくても bài 17, なかったら bài 25, sai khiến + ます); thân ます / gốc tính từ trước そう (bài 43: 切れ, 落ち, 美味, 優し); danh từ hóa (迎え, 買い物) | ⏸ pipeline |
| — | 24 | Không có trong bảng chia: danh từ (本, 国, 山…), trường `kanji` nhiều cách viết (mn-09-033, mn-09-035, mn-24-009/010), mẫu câu, phó từ N3 `ずいぶん～なる` | ⏸ pipeline (tách cách viết thứ hai ra `variants`) |
| B | 1 | mn-08-016: `[[悪く]]ないです` chỉ bao 悪く → khớp "dạng trạng từ" (bài 19) > bài 8 của câu | ✅ sửa 2026-11-16 (Bổ sung 2) |

Sửa nhóm A:
- `ConjRow.aliases` (chỉ ghi khi không rỗng) — `chia-the/quiz/dong-tu.json` 742KB → 744KB.
- `conjIndex`: ID → `same_word` → **`aliases`** → cùng dạng gốc. `same_word` phải đứng trước: alias gộp theo kana nên có thể trỏ sang từ khác nghĩa — mn-22-004 掛けます "đeo kính" là alias của mn-07-009 かけます "gọi điện"; đặt alias trước thì mất 2 câu cũ (mn-22-004-e1, mn-34-005-e1).
- Nhiễu "từ khác cùng thể" cho câu N3: thêm từ Minna (mọi bài — người học N3 đã học hết Minna), ưu tiên từ cùng sách trước → câu N3 cũ giữ nguyên nhiễu.

Kết quả: N3 162 → **216** câu chia thể; N5 81, N4 141 không đổi; bỏ qua 148 → **96**; câu cũ giữ nguyên ID và nhiễu (so bản build trước/sau). `n3-dien.json` 380KB → 415KB gốc, ~69KB gzip (**sát mốc 70KB** của test). Test: mốc `skipped <= 100`, N3 ≥ 200, thêm test n3-101/108/117/333 có câu và mn-22-004 vẫn tra qua `same_word`.

## Bổ sung 2 — 2026-11-16: nhóm B + C (30 câu) và 2 lỗi dữ liệu

**Dữ liệu (pipeline, rồi `apply-all-reviews` + `apply-all-examples` + `build`):**
- **Lỗi từ loại** — mn-17-009 持って来ます, mn-24-004 連れて来ます, mn-46-002 帰って来ます ghi V1 → bảng chia (cả trang `/chia-the/`) hiện もってく / つれてかない / かえっていて. Sửa thành V3 ở `_decisions/15-conjugation-pos.txt`; engine chia đúng phần 来る đứng sau (持ってくる, 持ってこない, 持ってきて, 持ってこられる).
- **B** — `_examples/lesson-08.txt` (bài đã duyệt `by: user`, chỉ nới phạm vi đánh dấu): `この店は[[悪くないです]]。` → khớp "phủ định lịch sự" (bài 8).

**Web:**
- `matchForm`: không khớp mặt chữ → khớp theo **cách đọc**. Câu ví dụ luôn viết kanji (rule `vocab-examples.md`) còn bảng chia theo `display` (点けて ↔ つけて, 噛んで ↔ かんで), hoặc chữ khác cùng âm (診て ↔ 見て, 量って ↔ 測って, 吐く ↔ hàng つきます).
- Khi khớp theo cách đọc, dạng chia sai của chính từ được **viết theo chữ của câu** (`inTargetScript`: つけって → {点|つ}けって) — nếu để kana trần thì đáp án là cụm duy nhất có kanji, lộ đáp án. Dạng sai không ghép được → bỏ; dạng có cách đọc trùng một thể đúng → bỏ.
- **Lỗi nhiễu có sẵn từ Q6** (lộ ra ở câu 悪くないです): bộ "chia sai" của tính từ い sinh `～くありません(でした)` — đây là cách nói phủ định lịch sự **đúng** → quiz chia thể và điền từ có thể chấm sai một đáp án đúng. Giờ chỉ dùng làm nhiễu khi ô bất quy tắc (いい → いくありません). Test mới quét mọi tính từ い.
- Hệ quả của sửa dữ liệu: câu có 連れて来ます / 帰って来ます làm nhiễu đổi pool (trước đây có dạng sai つれていて, かえってく); quiz chia thể: từ có khả năng = bị động 154 → 157.

Kết quả: bỏ qua 96 → **66**; câu chia thể N5 81 → 89, N4 141 → 163, N3 216. Mốc test: `skipped <= 70`, N5 ≥ 85, N4 ≥ 155. Dung lượng: n5-dien 445KB / 63KB gzip (**sát mốc 450KB gốc**), n4-dien 409KB / 66KB, n3-dien 415KB / 69KB.

Còn lại (66): thể ghép (~43: bị động + ました, なければなりません, なかったら, thân ます + そう…) và không phải chia thể (~24) — xem README mục Lỗi dữ liệu.

## Kế hoạch bước 2.1 — thể ghép (~43 câu) · ✅ xong 2026-11-17 (user duyệt spec: APPLY)

Ghi 2026-11-17 (kế hoạch chung: [README.md](README.md#kế-hoạch-tiếp-theo-chốt-2026-11-16)). Nguyên tắc: **sinh thể phái sinh trên web** từ ô bảng chia có sẵn, **không** thêm thể vào `conjugation.json` → trang `/chia-the/`, quiz chia thể (20 thể) và dung lượng `dong-tu.json` giữ nguyên.

| Nhóm | Số câu (ước) | Ví dụ cụm đích | Thể gốc trong bảng | Phái sinh |
|---|---|---|---|---|
| Bị động + ます | ~17 (bài 37 gần hết, 49 過ごされました, N3 盗まれました / 行われます / 含まれて) | 褒められました, 招待されました, 輸出されて | `passive` (…れる) | bỏ る → thân ます + đuôi: ます / ました / ません / て |
| Sai khiến + ます | 2 (bài 48) | 届けさせます, 録音させて | `causative` (…せる) | như trên |
| なければなりません | 6 (bài 17) | 払わなければなりません | `nai` (…ない) | bỏ い → なければなりません / なければならない |
| なくても | 1 (bài 17) | 出かけなくても | `nai` | bỏ い → なくても |
| なかったら | 1 (bài 25) | 足りなかったら | `past_neg` (…なかった) | + ら |
| Thân ます (+ そう / 方 / ながら) | ~7 (bài 43: 切れ, 取れ, 落ち, 無くなり, 滑り; 49 掛け) | 切れ(そうです) | `masu` (…ます) | bỏ ます |
| Gốc tính từ い (+ そう) | ~4 (bài 43: 美味, つまらな, 優し; 44 濃) | 優し(そうです) | `plain` (…い) | bỏ い (いい → よさ: không có trong danh sách) |
| Khác | ~5 | 与えすぎないで (すぎる + ないで), 迎え / 買い物 (danh từ hóa) | — | **không làm**: ghi vào mốc bỏ qua |

Spec đề xuất (user duyệt trước khi làm):

| # | Mục | Đề xuất |
|---|---|---|
| 2.1-1 | Nơi làm | `lib/quiz/vocab.ts`: `matchForm` thử thêm bảng `DERIVED` (id thể phái sinh → thể gốc + phép biến đổi chuỗi trên ruby: bỏ đuôi kana + nối đuôi mới). Hàm thuần, có test từng phép biến đổi |
| 2.1-2 | Bài học | Thể phái sinh chỉ hỏi khi **thể gốc** đã học tới bài của câu (Q4b-5) và cấu trúc đã học: なければなりません / なくても bài 17, なかったら bài 25 (たら), bị động + ます bài 37, sai khiến bài 48, そう bài 43 — bảng `DERIVED` ghi `lesson` riêng |
| 2.1-3 | Nhiễu | (a) dạng chia sai của chính từ → áp cùng phép phái sinh lên `badForms(thể gốc)`; (b) từ khác cùng thể gốc → cùng phép phái sinh. Vẫn loại nhiễu đọc giống đáp án và dạng đúng thay thế (なきゃ / なくちゃ không sinh) |
| 2.1-4 | Giải thích | `褒められました = Thể bị động + ました · 褒めます — khen` (tên thể gốc + phần phái sinh) |
| 2.1-5 | ID | Giữ `v-cloze:<id câu ví dụ>` (câu mới, không đổi ID cũ) |
| 2.1-6 | Dung lượng | ~+40 câu vào `n4-dien` (bài 37, 43, 48) và `n5-dien` (bài 17, 25): n5-dien đang 445KB / mốc 450KB → **có thể vượt** → tạm nâng mốc test, ghi số đo, xử lý dứt điểm ở bước 3 (Q12) |

Test: mỗi phép phái sinh 1 ca đã biết (褒める → 褒められました, 払う → 払わなければなりません, 足りる → 足りなかったら, 切れる → 切れ); nhiễu không trùng mọi dạng đúng + phái sinh đúng của chính từ; mốc bỏ qua hạ theo số đo (dự kiến ~25).

## Kế hoạch bước 2.2 — câu không phải chia thể (~24 câu) · ✅ phần web xong 2026-11-17 (còn 3 câu chờ user viết lại)

Khảo sát 2026-11-17 — các nguyên nhân:

| Nhóm | Câu | Nguyên nhân | Hướng xử lý |
|---|---|---|---|
| **Bộ lọc lộ đáp án bắt oan** | mn-44-021 量 (料理 りょうり), mn-47-015 医学 (大学 だいがく), mn-32-028 西 (に**しず**みます), mn-27-010 声 (聞こえます), mn-03-030 階 (会議室 かいぎ), mn-28-031 家 か | `leaks()` so **cách đọc** đáp án như chuỗi con của cách đọc cả câu → âm trùng ở chữ khác cũng tính là lộ | Câu điền từ: chỉ coi là lộ khi **chữ hiển thị** của đáp án có trong câu (hoặc đáp án toàn kana trùng kana trong câu); cách đọc trùng ở chữ Hán khác không lộ. Đáp án 1 kana (家 か, や) vẫn bỏ — quá dễ trùng. Chỉ đổi cho `v-cloze`, không đổi `leaks()` của loại câu khác |
| **Lộ thật** | mn-02-007 本 (日本語), mn-03-022 国 (中国), mn-08-034 山 (富士山) | Chữ đáp án nằm sẵn trong câu | ~~Viết lại~~ → user giữ câu gốc; chữ trong từ ghép không tính lộ (2026-11-17) |
| **Trường `kanji` nhiều cách viết** | mn-09-033 `夫 /主人`, mn-09-035 `妻/家内`, mn-24-009 `おじいさん／ おじいちゃん`, mn-24-010 `おばあさん／ おばあちゃん` | Cách viết thứ hai nằm trong `kanji`/`kana` thay vì `variants` → không khớp cụm đích; quiz đọc (Q9) cũng loại | `_decisions/`: tách cách viết thứ hai ra `variants` (kana cũng đang dạng "a/b": mn-09-033 `おっと/しゅじん`) |
| **Không hỏi** | mn-01-030 こちらは～さんです (mẫu câu), mn-10-043 ～や～ (trợ từ), N3 `ずいぶん～なる` / `やっと～た` / `つい～てしまった` / `けっして～ない` / `ただ～するだけ`… | Đích là mẫu câu có phần giữa tự do | Ghi rõ "không hỏi" — test đếm riêng, không tính vào mốc bỏ qua |

Kết quả mong đợi sau 2.1 + 2.2: mốc bỏ qua chỉ còn nhóm "không hỏi" + "khác" (~20).

### Bước 2.1 — sai khác so với spec / kết quả (2026-11-17)

| # | Spec | Thực tế | Lý do |
|---|---|---|---|
| 1 | Bảng `DERIVED` | `lib/quiz/vocab.ts`: `DERIVED` theo nhóm bảng chia + `cellOf` / `deriveFrom` / `formLesson`; thể có sẵn luôn thử trước | So bộ câu trước/sau: **0 câu cũ mất / đổi** do phần web (7 câu đổi nhiễu là do sửa dữ liệu, mục 3) |
| 2 | Thân ます + そう… | Thân ます / gốc tính từ chỉ nối đuôi `そう / すぎ / ながら / に` (`STEM_TAIL`) | Bản đầu nhận đuôi bất kỳ → 足りなかったら bị đọc thành 足り + なかったら, nhiễu vô nghĩa (着きなかったら) |
| 3 | (không có) | **3 lỗi nhóm động từ** lộ ra (lần rà 1.2 chỉ quét V1 đuôi -iru/-eru, không quét chiều ngược): 借ります, 足ります V1 → **V2**; 楽しみにしています V1 → **V2** (thể từ điển từng là たのしみにしてう) — `_decisions/15-conjugation-pos.txt`. n3-159 足りる giờ gộp đúng vào 足ります (bảng chia 719 → 718) | Rà tay toàn bộ ~170 động từ V1 Minna có thân ます hàng i: còn lại đều nhóm I thật |
| 4 | Thể phái sinh thêm | Ngoài bảng spec: khả năng + ます/ました/ません/ませんでした/て (bài 27), なくて (39), なければ (35) | Cùng cơ chế, không tốn thêm; chưa có câu nào dùng tới nhưng sẵn cho câu ví dụ sau |
| 5 | Dung lượng | n5-dien **451KB** / 63KB gzip (vượt mốc 450KB 632 byte), n4-dien 428KB / **69KB gzip**, n3-dien 417KB / 69KB → mốc test **tạm** 500KB / 75KB | Như dự kiến (2.1-6); bước 3 thay bằng mốc mỗi chunk |

Kết quả: **+40 câu** (N5 89 → 97, N4 163 → 191, N3 216 → 220); bỏ qua 66 → **26**. Test mới: 8 ca phái sinh (đáp án + tên thể trong giải thích + nhiễu), thân ます chỉ nối đuôi hợp lệ. Quiz chia thể: khả năng = bị động 160 → 162 (借りる, 足りる).

### Bước 2.2 — sai khác so với spec / kết quả (2026-11-17)

| # | Spec | Thực tế | Lý do |
|---|---|---|---|
| 1 | Lộ đáp án theo chữ cho `v-cloze` | Làm **trong `leaks()`** (`validate.ts`) theo `kind` — hàm sinh câu và bất biến 5 của `checkDeck` dùng chung một quy tắc. Loại câu khác giữ quy tắc cũ (chữ + cách đọc) | Làm riêng trong `vocab.ts` thì `finalizeDeck` (bất biến 5) vẫn báo lỗi |
| 2 | Đáp án 1 kana coi là lộ | **Bỏ** quy tắc này | Làm mất 2 câu cũ (と mn-04-048, か mn-34-025) |
| 3 | Tách cách viết qua `_decisions/` → `variants` | **Không đổi dữ liệu**: web tách `kana`/`kanji` theo `/` `／` khi khớp cụm đích (`splitWritings`); khi làm nhiễu chỉ hiện cách viết đầu | `variants` chỉ là chữ (không có cách đọc), dùng cho N3; 夫 / 主人 là hai cách nói khác cách đọc → đưa 主人 vào `variants` mất しゅじん |
| 4 | (không có) | **Lỗi có sẵn, 54+ câu**: nhiễu của câu điền từ mang `～` (`～から`, `{～語\|～ご}`) trong khi đáp án không có (と) → lộ đáp án. Giờ bỏ `～` khỏi mọi lựa chọn; 11 câu từng hiện nguyên "おじいさん／ おじいちゃん" làm nhiễu | Phát hiện khi xem câu mới (階: nhiễu ～円, ～歳) |
| 5 | Viết lại 3 câu lộ thật | **Không viết lại** — user giữ câu gốc, đổi quy tắc lộ (xem dưới) | `_examples/lesson-02/03/08.txt` là `# by: user`: câu AI viết ghi vào sẽ thành "đã duyệt" |

So bộ câu trước/sau: 0 câu cũ mất; +11 câu (量, 医学, 西, 声, 階, 家, 夫, 妻, おじいさん, おばあさん, 濃); 141 câu đổi nhiễu — **đã kiểm: chỉ khác ở bỏ `～` / lấy cách viết đầu**. Bỏ qua 26 → **15**: 3 câu lộ thật + 12 "không hỏi" (mn-01-030 mẫu câu, mn-10-043 や, mn-13-006 買い物 danh từ hóa, 9 phó từ N3 `～なる / ～た / ～ない`). Mốc test `skipped <= 16`.

**3 câu "lộ thật" — user quyết định giữ câu gốc (2026-11-17)**: chữ đáp án chỉ nằm trong từ ghép dài hơn (本 / {日本語|にほんご}, 国 / {中国|ちゅうごく}, 山 / {富士山|ふじさん}) → coi là tăng độ khó, không phải lộ. `leaks()` (`v-cloze`): đoạn ruby có chữ **dài hơn** và **chứa** chữ đáp án thì bỏ qua khi so. So bộ câu trước/sau: **chỉ +3 câu đúng 3 câu này**, không câu nào khác đổi. Bỏ qua 15 → **12** (toàn "không hỏi"); mốc test `skipped <= 13`. Không sửa `_examples/`.
