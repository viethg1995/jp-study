# Q11 — Quiz từ nối

> Phần chung (quyết định D1–D6, kiến trúc, bất biến, luồng làm bài, checklist): [README.md](README.md). File này chỉ chứa riêng task Q11.

Trạng thái: ⬜ **kế hoạch chờ duyệt** (lập 2026-11-18). Làm trên **nhánh riêng sau PR `feat/quiz`** (bước 4).

Q11 cần dữ liệu từ nối, mà dữ liệu này chưa có (STATUS mục 8: "schema mới (id, từ, nghĩa, loại, cách nối, ví dụ); nguồn: từ vựng `Conj` + tổng hợp"). Vì vậy kế hoạch gồm 3 giai đoạn: **dữ liệu → trang `/tu-noi/` → quiz**.

## Khảo sát dữ liệu hiện có (2026-11-18)

**A. Từ nối giữa hai câu (接続詞)** — có trong từ vựng, mỗi từ đã có nghĩa và 1 câu ví dụ:

| Nguồn | Từ | Ghi chú |
|---|---|---|
| Minna, pos `Conj` | それから (mn-06-045), そして (mn-08-046), でも (mn-19-019), それに (mn-28-041) | |
| Minna, pos sai | ですから (mn-17-029, ghi `N`), それで (mn-28-042, ghi `N`), ～けど (mn-20-019, ghi `Suf`) | Sửa từ loại qua `_decisions/` (từ loại `Conj`, riêng けど là trợ từ nối) |
| N3, pos `Conj` | それで (n3-682), そのうえ (n3-683), また (n3-684), または (n3-685), それとも (n3-686), 結果 (n3-281) | 結果 là danh từ, cần xét lại |
| N3, pos sai | つまり (n3-687, ghi `Adv`) | |

Tổng cộng **~16 từ**. Các từ rất thường gặp như しかし, だから, じゃ / では, ところで, ところが, すると, 例えば **không có** trong danh sách từ vựng. Muốn đưa vào thì phải **tổng hợp** và đánh dấu `ai-draft`.

**B. Mẫu nối mệnh đề (接続助詞)** — nằm trong ngữ pháp `sources/grammar/md/` (chưa vào `data/`, STATUS mục 9). Tiêu đề đã thấy:

- ～し、～し (bài 28), ながら (28), あとで (34), ～ば (35), なら (35), ように (36), ので (39), ～か (40), ために (42), 場合は (45), のに (45), けど (20), "Vì ∼ nên" (から, bài 9).
- Tiêu đề N5 viết bằng tiếng Việt, nên phải **rà từng bài**. Dự kiến thêm: て (16), ても (25), たら (25), とき (23), と (23), まえに (18), ないで (34).

Ước tính **~20–25 mẫu**.

## Giai đoạn 1 — dữ liệu (STATUS mục 8)

| # | Mục | Đề xuất |
|---|---|---|
| 1-1 | Phạm vi | **Đề xuất làm cả A và B**: người học Minna gặp B (から, のに, ても…) nhiều hơn A. Nếu chỉ làm A thì dữ liệu chỉ có ~16 từ, quiz quá mỏng |
| 1-2 | Schema `Connective` (`schemas.py` + zod, gate `check:schema`) | `id` (`cn-{slug}`, ví dụ `cn-soshite`, `cn-noni`; ghi cứng, đăng ký trong CLAUDE.md luật 2) · `word` (ruby) · `kana` · `meaning_vi` · `type`: `sentence` (A) / `clause` (B) · `function` (enum: thêm, nối tiếp thời gian, nghịch, lý do – kết quả, điều kiện, lựa chọn, chuyển đề, giải thích, mục đích, đồng thời) · `connects` (cách nối, ví dụ `V普通形 / Aい / Aな・N + な + のに`; với A là `null`) · `book` + `lesson` (bài giới thiệu) · `vocab_ref` (ID từ vựng nếu có) · `grammar_ref` (`g-45-2`, để trống khi mục 9 chưa xong) · `examples[]` {`ruby` có `[[từ nối]]`, `vi`, `source`} · `note` (phân biệt cách dùng, ví dụ それで / だから) · `substitutes[]` (ID **thay được cho nhau** trong cùng ngữ cảnh, ví dụ でも ↔ しかし; dùng cho quiz, xem 3-3) · `provenance` |
| 1-3 | Nguồn và ghi công | **A**: lấy nghĩa và câu ví dụ có sẵn từ `data/vocabulary` (pipeline tự đọc, không chép tay). **B**: tiêu đề, cách nối và câu ví dụ trích từ `sources/grammar/md` qua extractor mới (`extract/grammar_connectives.py`). **Phần thiếu** (từ ngoài từ vựng, ví dụ thêm cho đủ ≥ 3 câu/từ, `function`, `substitutes`, `note`): AI soạn vào `enrichment/connectives/*-ai.txt`, đánh dấu `ai-draft`, chờ user duyệt rồi chuyển sang file đã duyệt (cùng cơ chế `vocab-fixes-ai.txt`) |
| 1-4 | Pipeline | `enrichment/connectives/` → `build` → `data/connectives.json` (validate Pydantic, sai thì fail). Liên kết hai chiều tính trong pipeline: từ vựng → `connective_ref`, từ nối → `vocab_ref`. Liên kết ngữ pháp chờ mục 9 |
| 1-5 | Sửa từ loại | ですから, それで (mn-28-042) N → `Conj`; つまり Adv → `Conj`; ～けど giữ `Suf` nhưng liên kết sang `cn-kedo` — ghi vào `_decisions/NN-connective-pos.txt` (by ai, chờ duyệt). Đổi từ loại có thể làm đổi câu quiz từ vựng → so bộ câu trước/sau |
| 1-6 | Test | pytest: extractor B, mỗi `[[…]]` trong ví dụ đúng từ nối, `substitutes` đối xứng, ID không trùng; `check-examples` cho cú pháp ruby |

## Giai đoạn 2 — trang `/tu-noi/` (STATUS mục 11)

Quiz cần `href` dẫn tới trang chi tiết.

- Trang danh sách nhóm theo `function` (lọc A / B, theo bài), mỗi từ là một thẻ gồm nghĩa, cách nối, ví dụ có furigana, ghi chú phân biệt, link sang từ vựng / bài.
- Thêm vào menu `lib/nav.ts`; SEO `description`; một `<h1>`; e2e ở mobile 375px.

## Giai đoạn 3 — quiz `/tu-noi/quiz/`

| # | Mục | Đề xuất |
|---|---|---|
| 3-1 | Loại câu (tiền tố kind `j-`, vì `c-` đã dùng cho chia thể) | `j-mean` từ nối → nghĩa · `j-word` nghĩa → từ nối · **`j-cloze` điền từ nối vào câu ví dụ** (loại chính) · `j-func` từ nối → chức năng (thêm / nghịch / lý do…) |
| 3-2 | ID câu (khóa `jp:quiz:wrong`) | `j-mean:cn-noni`, `j-cloze:cn-noni-e1`… — ghi cứng theo ID từ nối + ID ví dụ |
| 3-3 | **Nhiễu không được cũng đúng** (rủi ro lớn nhất) | Câu điền từ: loại khỏi nhiễu các từ trong `substitutes` của đáp án, và ưu tiên lấy nhiễu khác `function` (nghịch ↔ thêm ↔ lý do). Với B, nhiễu phải **cùng cách nối**, nếu không người học nhìn thể động từ phía trước là đoán ra (～て + も ≠ ～た + ら) |
| 3-4 | Bộ lọc | Loại (A / B / cả hai) · bài Minna 1–50 + N3 · loại câu (nhiều lựa chọn) · Câu hay sai (Q10, runner có sẵn) · Furigana |
| 3-5 | File deck | ~40 từ × ~4 câu ≈ 200–300 câu, dự kiến < 100KB, nên **1 file, không chia chunk** (mốc mỗi file < 150KB / < 25KB gzip như Q12) |
| 3-6 | Trang tổng `/luyen-tap/` | Thêm phần "Từ nối" (`MIX_PARTS`, lọc bài như từ vựng), `balanceParts` tự chia đều |
| 3-7 | Lối vào "Câu hay sai" ở trang chủ | Thêm nút Từ nối (`wrong-summary.ts`) |
| 3-8 | Test | Unit: `buildConnectiveDeck` + `checkDeck` trên dữ liệu thật, không nhiễu nào nằm trong `substitutes`, nhiễu của B cùng cách nối. E2E: trang quiz (chấm, bộ lọc URL, mobile, Câu hay sai), trang tổng có phần Từ nối |

## Thứ tự làm và điểm dừng duyệt

1. **User duyệt kế hoạch này** (phạm vi 1-1, schema 1-2, tiền tố `j-`, trang `/tu-noi/` làm trước quiz).
2. Giai đoạn 1: extractor + schema + file AI nháp → **dừng cho user duyệt dữ liệu** (nghĩa, `substitutes`, ví dụ AI). Quiz điền từ dựa vào `substitutes`, dữ liệu sai thì sinh câu có hai đáp án đúng.
3. Giai đoạn 2 → giai đoạn 3 → cập nhật README / STATUS → PR riêng.

## Câu hỏi cần user chốt

1. **Phạm vi**: chỉ A (~16 từ trong từ vựng) hay **A + B** (~40)? Có thêm các từ phổ biến ngoài danh sách từ vựng (しかし, だから, ところで…) dưới dạng `ai-draft` không?
2. **Trang `/tu-noi/` trước quiz** (đề xuất), hay chỉ làm quiz với `href` trỏ về trang từ vựng / ngữ pháp?
3. **Ví dụ AI**: cho phép AI viết thêm ví dụ (`ai-draft`) để mỗi từ có ≥ 3 câu, hay chỉ dùng ví dụ có nguồn (A có 1 câu/từ, nên quiz điền từ sẽ ít câu)?

## Tiêu chí xong / kết quả

`data/connectives.json` qua validate; trang `/tu-noi/` và `/tu-noi/quiz/` đủ e2e; không câu điền từ nào có nhiễu cũng đúng (test `substitutes`); có trong trang tổng và lối vào "Câu hay sai"; ID câu cố định.
