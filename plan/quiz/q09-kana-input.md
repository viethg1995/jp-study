# Q9 — Gõ kana

> Phần chung (quyết định D1–D6, kiến trúc, bất biến, luồng làm bài, checklist): [README.md](README.md). File này chỉ chứa riêng task Q9.

Trạng thái: ✅ xong 2026-11-13 — spec duyệt cùng ngày (5 loại câu, chưa có Điền từ; chuyển romaji ngay khi gõ; câu Chia vẫn hiện furigana, ẩn bằng chip Furigana)

## Bối cảnh (khảo sát 2026-11-13)

- Mọi câu đang là trắc nghiệm 4 lựa chọn (`Session.answer(index)`); chấm trong `session.ts`, ghi câu sai (Q10) trong `runner.ts` → `choose()`.
- Loại câu có đáp án là **cách đọc tiếng Nhật** (gõ được):

| Loại | Trang | Đề → đáp án | Ví dụ |
|---|---|---|---|
| `v-read` | Từ vựng · Đọc | chữ Hán → kana | 学生 → がくせい (`accepted`: cách đọc khác của cùng chữ) |
| `k-read` | Kanji · Cách đọc | từ có chữ đang hỏi → kana | [[万]]事 → ばんじ |
| `c-to` | Chia thể · Chia | từ + "Chia sang thể て" → ruby | 行きます → {行\|い}って (gõ phần đọc: いって) |
| `n-ctr` | Đếm số · Đồ vật | 3本 → kana | さんぼん (`accepted` = alt) |
| `n-num` | Đếm số · Số | 3,800 → kana | さんぜんはっぴゃく; パーセント, マイナス (katakana) |

- Loại còn lại (nghĩa, Hán-Việt, chọn từ, điền từ, nhận thể, bộ thủ…) đáp án là tiếng Việt hoặc cần chọn giữa các từ → **giữ trắc nghiệm**.
- `normalize()` (core.ts) đã đổi katakana → hiragana, bỏ khoảng trắng, NFKC → gõ hiragana khớp cả đáp án katakana (ぱーせんと = パーセント).

## Spec

| # | Mục | Đề xuất |
|---|---|---|
| Q9-1 | Bật ở đâu | Dòng **"Trả lời: Chọn đáp án · Gõ kana"** (Segmented, chọn một) trong bảng tùy chọn của trang có loại câu gõ được: Từ vựng, Kanji, Chia thể, Đếm số, Luyện tập (không có ở Bộ thủ). URL `?tra-loi=go`. Mặc định: Chọn đáp án. |
| Q9-2 | Câu nào gõ | Chế độ "Gõ kana": câu thuộc 5 loại ở bảng trên → ô nhập; câu loại khác trong cùng lượt (vd trang Luyện tập trộn Nghĩa + Đọc) **vẫn trắc nghiệm**. Bộ lọc không có loại gõ được (vd Từ vựng chỉ chọn "Nghĩa") → dòng ghi chú "Loại câu đang chọn không có câu gõ được — vẫn hỏi trắc nghiệm". |
| Q9-3 | Bộ chuyển romaji → kana | Hàm thuần `lib/quiz/romaji.ts`, **chuyển ngay khi gõ** (thấy kana luôn, phần chưa đủ âm giữ nguyên: `sh` → `sh`, `shi` → し). Hỗ trợ Hepburn + Kunrei + kiểu gõ máy: shi/si, chi/ti, tsu/tu, fu/hu, ji/zi, sha/sya, cha/tya/cya, ja/jya/zya, di/du (ぢ/づ); **っ** = phụ âm đôi (`kitte`, `matcha`); **ん** = `nn`, `n'`, `n` trước phụ âm (trừ y), `n` cuối khi chấm; âm nhỏ `xa/la`, `xtu/ltu`; `wo` → を; `-` → ー. Gõ thẳng kana bằng bàn phím tiếng Nhật (IME, điện thoại) → giữ nguyên. Chữ hoa gõ ra hiragana (chấm đã đổi katakana ↔ hiragana). |
| Q9-4 | Chấm | `normalize(gõ)` so với `normalize(phần đọc)` của `answer` và mọi `accepted` (ruby → đọc: `{行\|い}って` → いって). Khác 1 ký tự là **sai** (trường âm, っ, dấu đục chính là điều cần luyện). Ô trống + Enter → không chấm (tránh bấm nhầm); nút **"Không biết"** → tính sai, hiện đáp án. |
| Q9-5 | Giao diện câu gõ | Thay 4 lựa chọn bằng: ô nhập (font tiếng Nhật, cỡ chữ như lựa chọn, `autocomplete/autocorrect/autocapitalize=off`, `spellcheck=false`, `lang="ja"`) + nút **"Trả lời"** + nút "Không biết". Tự focus ô nhập ở mỗi câu (desktop; mobile cũng focus để bàn phím bật lên). Enter = Trả lời; sau khi chấm Enter = Câu tiếp (như hiện tại). Phản hồi: đúng → "Đúng!"; sai → "Chưa đúng — đáp án: …" + dòng "Bạn gõ: …" (gạch ngang, màu lỗi). "Cũng đúng", giải thích, link: như trắc nghiệm. |
| Q9-6 | Gợi ý phím tắt | Dòng gợi ý dưới thẻ đổi theo chế độ: "Gõ romaji (gakusei) hoặc kana · Enter: trả lời / câu tiếp". |
| Q9-7 | Câu hay sai (Q10) | Câu gõ sai / "Không biết" → lưu như câu trắc nghiệm sai (cùng ID); "Làm lại câu sai" và chế độ ôn giữ chế độ trả lời đang chọn. |
| Q9-8 | Furigana | Đề `v-read`/`k-read`/đếm số không có furigana. Đề `c-to` có ruby → **vẫn hiện** như trắc nghiệm (đang luyện chia, không luyện đọc chữ); muốn ẩn → chip "✓ Furigana" trong thẻ (trang Chia thể đã có). |
| Q9-9 | Code | `romaji.ts` (thuần, unit test), `Session.answerTyped(text)` (chấm bằng chuỗi; `answer(index)` giữ nguyên) trong `session.ts`, runner vẽ ô nhập khi `typable(item)`; danh sách loại gõ được ở một chỗ (`TYPABLE_KINDS` trong `types.ts` / `core.ts`). |

## Test

- Unit `romaji.test.ts`: bảng âm cơ bản + biến thể (shi/si, tsu/tu, fu/hu, ji/zi), âm ghép (sha, cha, ja, ryo, kya…), っ (kitte, matcha, zasshi), ん (konnichiha, kan'i, sanpo, hon cuối), âm nhỏ (xtu, la), wo, `-` → ー, chữ hoa, kana gõ thẳng giữ nguyên, phần dở dang giữ nguyên (`ky` → `ky`).
- Unit `session.test.ts`: `answerTyped` đúng / sai / accepted / katakana ↔ hiragana / khoảng trắng; ô trống không chấm.
- Unit trên dữ liệu thật: mọi câu 5 loại gõ được có phần đọc chỉ gồm kana (không lẫn chữ Hán / chữ Latin) → gõ được.
- E2E `kana-input.spec.ts`: Từ vựng Đọc + "Gõ kana" → ô nhập, gõ `gakusei` hiện がくせい, Enter → đúng; gõ sai → "Bạn gõ: …" + lưu câu sai; "Không biết" → sai; URL `tra-loi=go`; Luyện tập trộn → câu Nghĩa vẫn 4 lựa chọn; Đếm số `n-num` gõ `pa-sento`; mobile 375px không cuộn ngang, ô nhập focus.

## Tiêu chí xong

5 loại câu gõ được trên 5 trang, build + unit + e2e xanh, thử gõ tay trên desktop + mobile (bàn phím Latin và bàn phím kana).

## Quyết định của user (2026-11-13)

1. 5 loại câu gõ được như bảng; chưa thêm Điền từ.
2. Chuyển romaji ngay khi gõ.
3. Câu Chia vẫn hiện furigana của đề; ẩn bằng chip Furigana.

## Sai khác so với spec

| # | Spec | Thực tế | Lý do / ghi chú |
|---|---|---|---|
| 1 | Chấm: so phần đọc sau `normalize` | Bỏ thêm ký hiệu không gõ được ở cả hai phía: `～ 。 、 , . ! ? ・ … 「 」` (`typingForm`) | Dữ liệu có `～じん`, `おさきにどうぞ。`, `２，３にち` (gõ `2,3nichi` hay `23nichi` đều đúng) |
| 2 | Mọi câu 5 loại đều gõ | Câu có phần đọc không phải kana / chữ số → **vẫn trắc nghiệm** trong chế độ gõ (`isTypable` kiểm cả đáp án) | Lỗi dữ liệu `mn-09-033` おっと/しゅじん, `mn-09-035` つま/かない (đã ghi ở README "Lỗi dữ liệu") — test liệt kê đúng 2 câu này |
| 3 | Romaji | Thêm `chya`/`shya` (IME nhận); `zzz` → っっz như IME | — |
| 4 | Ghi chú khi bộ lọc không có loại gõ được | Ghi chú **từng câu**: câu không gõ được trong chế độ gõ hiện dòng nhỏ "Loại câu này chỉ có trắc nghiệm" dưới câu hỏi | Biết được trước khi tải deck là khó; ghi theo câu cũng đúng cho trang Luyện tập trộn |
| 5 | — | "Trả lời: Chọn đáp án" (mặc định) không ghi vào dòng tóm tắt và URL; "Gõ kana" thì có (`?tra-loi=go`, đặt trước `on=sai`) | Như dòng "Câu hỏi" (Q10) |

Kiểm tra: unit 220 (thêm `romaji.test.ts` 8, `typing.test.ts` 8: chấm + `answerTyped` + dữ liệu thật 5 loại), e2e 174 (thêm `kana-input.spec.ts` 6 test × 2 màn hình: gõ romaji hiện kana ngay + Enter chấm/sang câu; gõ sai "Bạn gõ" + lưu câu sai; ô trống không chấm; Không biết; Luyện tập trộn câu gõ + trắc nghiệm; Đếm số `ichipa-sento`; Bộ thủ không có dòng Trả lời; không cuộn ngang).
