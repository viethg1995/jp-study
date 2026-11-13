# Q2 — Engine lib/quiz

> Phần chung (quyết định D1–D6, kiến trúc, bất biến, luồng làm bài, checklist): [README.md](README.md). File này chỉ chứa riêng task Q2.

Trạng thái: ✅ xong 2026-11-12

## Nội dung

**Engine** `lib/quiz/types.ts` + `core.ts` (chọn nhiễu, trộn, bốc câu không lặp, lọc tag, RNG có seed) + hàm kiểm bất biến dùng chung `assertDeck()`

## Tiêu chí xong / kết quả

Unit test core: phân phối không lặp, trộn đủ, lọc đúng; `assertDeck` bắt được deck sai — **Xong 2026-11-12**: `lib/quiz/` gồm `types.ts`, `random.ts` (mulberry32), `core.ts` (`makeOptions` 3 trong 6 nhiễu đầu, `normalize` katakana = hiragana, `isCorrect`, `filterItems`, `createQueue`), `params.ts` (`cap`/`tu`/`den`/`loai`/`nhom`), `validate.ts` (`checkDeck` 5 quy tắc, `finalizeDeck`); `counter-quiz.ts` thêm `toQuizItems()` (366 câu qua `checkDeck` 0 lỗi). 40 test mới (tổng 47); thử làm hỏng quy tắc 1 và chống lặp → test đỏ
