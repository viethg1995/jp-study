# Q13 — Bảng chia: từ N3 trùng từ Minna có hàng riêng

> Phần chung (quyết định D1–D6, kiến trúc, bất biến, luồng làm bài, checklist): [README.md](README.md). File này chỉ chứa riêng task Q13.

Trạng thái: ✅ xong 2026-11-17 — spec duyệt cùng ngày (không có trang riêng cho từ N3 trùng; nghĩa / Hán-Việt lấy của mục N3)

## Bối cảnh (khảo sát 2026-11-17)

`transform/conjugation.py` → `build_conjugation` gộp mục cùng **(loại, kana gốc, chữ gốc)** thành **một hàng** mang `vocab_id` của mục gặp trước (Minna trước N3), ID các mục sau ghi vào `aliases`. Gộp **xuyên sách** gây hai lỗi:

| Ảnh hưởng | Số liệu |
|---|---|
| Quiz Chia thể "Sách: N3" thiếu từ: hàng gộp mang `book: minna` + bài Minna → bộ lọc sách / bài N3 không thấy | **68 từ N3**: động từ V1 30 + V2 26, tính từ い 6, な 6 (vd n3-101 倒れる → hàng mn-39-002 倒れます). Bảng có 269 hàng N3, đúng ra 337 |
| "Điền từ" (Q4b) bỏ câu ví dụ của từ là alias (web `buildConjTable` bỏ `aliases`, tra theo ID không thấy) | **59 câu** (56 động từ N3 + 3 Minna: mn-26-001 見ます・診ます, mn-27-005 できます, mn-38-009 吐きます) |

Gộp **trong cùng sách** (37 alias Minna ↔ Minna, vd 休みます bài 4 / bài 11) đúng ý đồ: cùng một từ học lại, chung một trang.

## Spec

| # | Mục | Đề xuất |
|---|---|---|
| Q13-1 | Khóa gộp | Thêm **sách** vào khóa: `(book, loại, kana gốc, chữ gốc)`. Trùng trong cùng sách → vẫn gộp vào `aliases` như cũ. Từ N3 trùng từ Minna → **hàng riêng** `book: "n3"`, `lesson` = bài N3, `meaning_vi` / `han_viet` của mục N3, gốc chia như mọi từ N3 (thể từ điển). |
| Q13-2 | Liên kết về hàng Minna | Trường mới `same_as: str \| null` trên `ConjEntry` = `vocab_id` hàng Minna cùng (loại, kana, chữ). Bảng chia của hai hàng giống nhau (cùng gốc) — pytest kiểm. `CONJ_SCHEMA_VERSION` 2 → **3**; zod `web/src/lib/schemas.ts` đồng bộ (gate `check:schema`). |
| Q13-3 | Trang chi tiết | Hàng có `same_as` **không sinh trang riêng** (tránh 68 trang trùng nội dung); mọi link tới nó (trang từ vựng N3, link "Xem bảng chia" trong quiz, danh sách `/chia-the/<nhóm>/`) trỏ về **trang của hàng Minna**. `lib/conjugation.ts` (map vocab_id → trang) và `conjHref` dùng `same_as ?? vocab_id`. |
| Q13-4 | Quiz Chia thể | Không đổi logic: hàng N3 mới tự vào bộ lọc "Sách: N3" theo bài N3, đề dạng từ điển. ID câu mới `c-to:n3-101:te`… (chưa từng có → không cần migration Q10). Câu Minna giữ nguyên ID. |
| Q13-5 | "Điền từ" (Q4b) | Từ N3: tra hàng theo ID (có sẵn sau Q13-1). 3 từ Minna là alias Minna: `buildConjTable` giữ `aliases` (chỉ ghi khi khác rỗng) và `conjIndex` (vocab.ts) tra thêm theo alias. Hạ mốc "số câu bỏ qua" trong `vocab.test.ts` theo số đo mới (dự kiến 148 → ~90). |
| Q13-6 | Dung lượng | `data/conjugation.json` +68 hàng (ước tính 2,85MB → ~3,1MB gốc; chỉ đọc lúc build). File quiz `/chia-the/quiz/dong-tu.json` +56 hàng (ước tính +80KB gốc / +8KB gzip) → ghi bảng đo ở [q12-deck-chunking.md](q12-deck-chunking.md). |

Ngoài phạm vi: thể ghép (bị động + ました, なければなりません…), 5 từ có trường `kanji`/`kana` chứa nhiều cách viết — tồn đọng riêng ở [README.md](README.md) mục "Lỗi dữ liệu".

## Test

- `pytest` (`test_conjugation.py`): từ N3 trùng Minna (倒れる) → hàng riêng `book n3`, bài N3, `same_as = mn-39-002`, bảng chia giống hàng Minna; trùng trong cùng sách (休みます bài 11) vẫn là alias; ví dụ trong `forms.json` vẫn giải về hàng Minna; tổng số hàng = 714 + 68.
- Unit web: quiz Chia thể sách N3 có 倒れる ở đúng bài N3; `checkDeck` 0 lỗi trên toàn bộ hàng mới; "Điền từ" có câu ví dụ của n3-101 và mn-26-001; mốc bỏ qua mới.
- E2E: `/chia-the/quiz/?sach=n3&…` hỏi được từ trùng (vd lọc bài có 倒れる); link "Xem bảng chia" của câu N3 trùng mở trang Minna (không 404); trang từ vựng N3 bài chứa 倒れる có link bảng chia đúng; build không sinh trang `/chia-the/dong-tu/n3-101/`.

## Tiêu chí xong

`build` pipeline + `pytest` + `npm run build` + e2e xanh; quiz Chia thể N3 đủ 337 hàng; "Điền từ" lấy lại ~59 câu; không link chết.

## Quyết định của user (2026-11-17)

1. Từ N3 trùng **không có trang riêng**, link về trang Minna.
2. Nghĩa / Hán-Việt của hàng N3 lấy **của mục N3**.

## Sai khác so với spec

| # | Spec | Thực tế | Lý do / ghi chú |
|---|---|---|---|
| 1 | "Điền từ" lấy lại ~59 câu, mốc ~90 | Lấy lại **52 câu**: bỏ qua 148 → **96**, mốc test ≤ 100 | mn-26-001 `[[診て]]`: hàng gộp viết 見ます (chữ khác) → không khớp, đúng là bỏ qua; vài câu bị loại vì tự lộ đáp án |
| 2 | — | Trang Minna thêm link **"N3 · Bài N"** (`data-n3-same`) tới từ vựng N3 của từ trùng | Trang dùng chung thì vẫn dẫn được sang sách N3 |
| 3 | `build` pipeline | Máy WSL thiếu `sources/dictionaries/kanjidic2/` (gitignored) → full `build` không chạy; chạy riêng bước `_build_conjugation` của pipeline trên `data/vocabulary` (cùng đầu vào `build` truyền). Diff: 714 hàng cũ giữ nguyên nội dung, 68 hàng Minna bớt alias N3, +68 hàng N3; `forms` / `groups` không đổi | **Cần chạy lại full `build` trên Windows** để chắc chắn không lệch (dự kiến không có diff) |
| 4 | Test cũ | `conjugation.test.ts` "khả năng = bị động": 154 → **180** từ (thêm 26 động từ nhóm II N3) | Đúng dự kiến |

Dung lượng: `data/conjugation.json` 2,85MB → **3,15MB**; `/chia-the/quiz/dong-tu.json` 742KB / 72KB → **821KB / 79KB gzip**.

Kiểm tra: pytest 247 (thêm 2 test trên dữ liệu thật: hàng riêng + `same_as` + bảng chia giống hàng Minna; alias chỉ cùng sách, ví dụ quy tắc giải về hàng Minna, 68 hàng `same_as`); unit web 239 (thêm: sách N3 có 倒れる bài 3, link về mn-39-002, 68 `sameAs` / 337 hàng N3; điền từ có câu n3-101 + mn-27-005); e2e 192 (thêm `conj-n3-rows.spec.ts` 3 test × 2 màn hình: quiz N3 hỏi 倒れる + link mở trang Minna; không có trang n3-101, link "N3 · Bài 3"; trang từ vựng N3 link đúng); `check:schema` xanh (schema chia thể v3).

## Đưa lên bản mới của `feat/quiz` (2026-11-19)

Q13 làm 2026-11-17 trên bản cũ, chưa push; `feat/quiz` trên GitHub đã thêm bước 1.1 (khóa gộp có `identity_kanji`), bước 1.2 (bỏ 5 hàng N3 sai từ loại), Q4b (web tra `aliases` qua `byAlias`, không ghi đè `byId`). Gộp:

- Pipeline: khóa gộp = `(sách, loại, kana gốc, chữ gốc, identity_kanji)`; `same_as` tra theo 4 thành phần sau. Sinh lại `data/conjugation.json` bằng bước `_build_conjugation` trên `data/vocabulary`: **781 hàng = 718 hàng cũ (khớp bản GitHub) + 63 hàng N3 riêng** (68 → 63 vì `identity_kanji` đã tách một số cặp khác chữ). Sách N3 332 hàng (337 − 5 hàng bỏ ở bước 1.2).
- Web: giữ cách tra alias của bản mới (`byAlias`, alias không thắng `same_word`); bỏ trường `aliases` khai báo trùng trong `ConjRow`; giữ `sameAs` + link về trang Minna. Mốc test: 63 `sameAs` / 332 hàng N3; khả năng = bị động 162 → 188 (+26 động từ nhóm II N3).
- Q14 (điền từ khớp theo cách đọc + thể ghép) **không đưa lên**: bản mới đã làm cùng việc (bước 2.1 thể phái sinh, 2.2 lộ đáp án) và còn tốt hơn — 12 câu bỏ qua so với 39 của Q14.

