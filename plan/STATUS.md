# Trạng thái dự án

Cập nhật khi hoàn thành từng hạng mục.

## Trọng tâm hiện tại (theo thứ tự ưu tiên của user)

1. **Từ vựng**: 50 bài みんなの日本語, kanji, Hán-Việt, câu ví dụ
2. **Kanji**: mọi chữ Hán trong từ vựng, bộ thủ, âm Hán-Việt, nghĩa
3. **Cách chia các thể**: động từ (ます/て/た/ない/辞書/可能/受身/使役/意向/条件…), tính từ い/な, danh từ (だ/です/じゃない/だった…)
4. **Cách đếm số**: số đếm, trợ số từ (～つ, ～人, ～本, ～枚, ～台…), biến âm, ví dụ
5. **Từ nối** (接続詞/接続助詞): ý nghĩa, cách dùng, ví dụ

## Đã xong

| Hạng mục | Trạng thái |
|----------|-----------|
| README.md, CLAUDE.md | Xong |
| Khung thư mục + chuyển file vào `sources/` | Xong |
| Python venv + `pyproject.toml` + `jp_pipeline check` | Xong |
| Extract: PDF có text → Markdown (`pymupdf4llm`), chấm điểm trang + route + hook chặn `sources/`, export-queue | Xong |
| Từ điển mở (JMdict, KANJIDIC2, Unihan) + index | Xong |
| Từ vựng: bổ sung tự động kanji / Hán-Việt / ID (`enrich-vocab`) + duyệt vòng 1–3 | Xong |
| Pipeline: từ vựng (`schemas.py` + `build` → `data/vocabulary/`, JSON Schema) | Xong — 0 cảnh báo, 0 chờ duyệt |
| Từ vựng: chuẩn hóa từ loại (schema v2, 234 quyết định `04-pos.txt`) | Xong — user đã duyệt |
| Từ vựng: chuẩn hóa i/y trong âm Hán-Việt (sau K/L/M viết `y`: LÝ, MỸ, KỲ) | Xong — tự động trong `build` (`normalize_han_viet`) |
| Từ vựng: câu ví dụ theo bài | Xong — **1.571/1.571**, 0 lỗi, 103 cảnh báo (`_auto/examples-warnings.txt`); user đã duyệt cả 50 bài |
| Pipeline: Kanji (KANJIDIC2 + Hán-Việt từ từ vựng/Unihan + 214 bộ thủ) | Xong — 834 kanji, 214 bộ thủ (schema kanji v2) |
| Kanji: nghĩa tiếng Việt (`enrichment/kanji/01-meanings-ai.txt`) | Xong — 841/841, user đã duyệt |
| Từ vựng: rà soát chất lượng vòng 2 (schema v3) | Xong — 15 cột kanji sai, 3 nghĩa dính chữ, 5 nghĩa + 5 từ loại sai (check-meanings), ký hiệu ～ thống nhất, `senses[]` + `same_word[]`, nguồn `user`, khôi phục trạng thái duyệt câu ví dụ bài 1 |
| N3: zip → PDF → parser theo bố cục (14 bài từ vựng, 35 bài Kanji) → `data/vocabulary/n3/` (670 từ, schema v4) + Kanji gộp (1.064 chữ, kanji v3); web /vocabulary/n3/ | Xong khung — còn việc ở TODO N3 |
| Web: Kanji — /kanji/ (nhóm N5 · N4 theo bài Minna, N3 theo bài sách, Khác) + 1.079 trang /kanji/字/ (Hán-Việt, nghĩa, On/Kun, nét, bộ thủ, từ vựng chứa chữ → link thẻ, chữ trước/sau) | Xong — thứ tự nét (KanjiVG) chưa có |
| Kanji: mẹo nhớ 1.085/1.085 (`enrichment/kanji/stories/01–06-ai.txt`, chờ duyệt) + thành phần KanjiVG tô màu, kanji schema v7 | Xong 2026-11-10 — TODO: ảnh minh họa AI cho mẹo nhớ |
| Kanji: ví dụ On/Kun ≥5/chữ (1.081/1.085; +3.220 từ JMdict, nghĩa VI AI nháp `enrichment/kanji/examples/01–07-ai.txt` — chờ duyệt), kanji schema v6 `examples[]` | Xong 2026-11-10 |
| Kanji: 2 nguồn — từ vựng từng bài + giáo trình Kanji theo cấp (Ebook N5: 26 bài/130 chữ, AI đọc trang mở bài; Ebook N4: 24 bài/177 chữ, parser; sách N3: 301 chữ) → `enrichment/kanji/lessons/`, kanji schema v5 (`n4_order`, `n5_order`). Web /kanji/ 2 cách xem (Giáo trình Kanji / Bài từ vựng) + trang /kanji/bo-thu/ (214 bộ theo số nét) | Xong — 1.085 chữ; chờ duyệt: nghĩa 6 chữ N4 (`05-meanings-ebook-n4-ai.txt`), âm 区 KHU, 糸 MỊCH (`hanviet/02-ai.txt`) |
| Từ vựng Minna: 25 mục cột kana chứa chữ Hán (試験, 会議, 箱根…) → sửa cách đọc + gán kanji (`_decisions/13`, `14`, ai — chờ duyệt) | Xong |
| Web: trang chủ + menu trái (icon chữ Hán, thu gọn/menu trượt, câu chào ngẫu nhiên), danh sách bài chuyển sang /vocabulary/ | Xong |
| Duyệt toàn bộ: quyết định 01–12, câu ví dụ 50 bài (1.571 câu), nghĩa 841 Kanji | Xong — user duyệt 2026-11-10; 0 mục ai-draft |
| Web: Astro skeleton — danh sách bài + từ vựng theo bài (furigana, công tắc CSS) | Xong |
| Web: thẻ từ vựng — design tokens, nhấn mạnh Kanji/Hiragana, chế độ Lưới / Từng thẻ (Trước/Sau, sang bài kế, thẻ 2 mặt click để lật — thuần CSS) | Xong |

## TODO — N3 (chờ triển khai)

| # | Hạng mục | Ghi chú |
| --- | -------- | ------- |
| N3-1 | Câu ví dụ 686/686 từ N3 | Xong — 0 lỗi, 153 cảnh báo; user đã duyệt |
| N3-2 | Thẻ ghép / thẻ thiếu / cảnh báo build | Xong — 686/687 thẻ (338 gộp trong 337), 0 cảnh báo; sửa trong `enrichment/n3/vocab-fixes.txt` (user đã duyệt) |
| N3-3 | Từ loại N3 | Xong — 638 từ JMdict, 48 user duyệt |
| N3-4 | Hán-Việt & nghĩa Kanji | Xong — từ N3 539/539 có âm (396 derived, 143 mixed cần soát); Kanji 1.069 chữ, thiếu âm chỉ 匂 (quốc tự); 228 nghĩa Kanji mới + 54 âm Hán-Việt AI nháp (`enrichment/kanji/03-meanings-n3-ai.txt`, `hanviet/01-ai.txt`) — user đã duyệt |
| N3-5 | Liên kết same_word Minna ↔ N3 | Xong — 55 từ |

## TODO — chờ triển khai

| # | Hạng mục | Ghi chú |
| --- | -------- | ------- |
| 3 | Kanji: soát âm Hán-Việt sai | Xong — 14 mục trong `_decisions/05-han-viet-fixes.txt` (user xác nhận). Lưu ý: Unihan còn có thể lẫn âm Nôm |
| 4 | Kanji: chữ thiếu âm Hán-Việt | Xong — user bổ sung 鞄 BẠC, 鋏 KIỆP, 噛 GIẢO (`06-han-viet-user.txt`) + nghĩa (`kanji/02-meanings-user.txt`); 込, 匂 là quốc tự, không có âm |
| 5 | Kanji: nét viết KanjiVG (CC BY-SA) | Xong 2026-11-10 — KanjiVG r20260714, 1.085/1.085 chữ → `data/kanji/strokes.json`; trang /kanji/字/: hình động (Viết lại, số thứ tự nét — thuần CSS), tô màu từng nét, bảng từng nét. Kèm sửa lỗi KANJIDIC2 chữ tương thích ghi đè 26 chữ (者 8 nét) |
| 6 | **Chia thể** động từ / tính từ / danh từ | Xong 2026-11-10 — engine `transform/conjugation.py` (gốc thể ます; N3 từ thể từ điển), quy tắc `enrichment/conjugation/forms.json` (ai, chờ duyệt) → `data/conjugation.json` (714 từ: 531 động từ, 86 tính từ い, 95 tính từ な; 20 thể động từ). Ngoại lệ: いきます, あります, いい, kính ngữ (いらっしゃいます…), くれます, できます/わかります (không có thể khả năng). Web /chia-the/ (quy tắc + ví dụ), /chia-the/dong-tu|tinh-tu-i|tinh-tu-na/ (bảng tra, chọn thể, che kết quả), trang từng từ. Sửa từ loại おおぜい Ai→N (`_decisions/15-conjugation-pos.txt`, ai). Thẻ từ vựng động từ/tính từ có link "活 Chia thể →" (cả mục trùng ở bài khác, qua `aliases` — conjugation schema v2). Quiz: `/chia-the/quiz/` (Q6, xong 2026-11-12) |
| 7 | **Cách đếm số + trợ số từ** | Xong 2026-11-11 (ai, chờ duyệt) — `enrichment/counters/`: `numbers.json` (0–10, chục, trăm, nghìn, vạn/ức + cách ghép số lớn), `sound-rules.json` (nhóm biến âm h/k/s/t/none/native/special), `counters.json` (26 trợ số từ, mỗi ô ghi tay: 1–10 + 11/14/20/100/1000/10000, từ để hỏi, mô tả hàng chục–vạn), `examples/*.txt` (261 câu trợ số từ + 23 câu số đếm = 284). `transform/counters.py` kiểm từng ô với quy tắc biến âm (khớp quy tắc ⇔ không đánh dấu irregular) và kiểm câu ví dụ (furigana, cách đọc cụm số trong [[…]]) → `data/counters.json` (schema `CounterFile` v1). Lệnh riêng `build-counters` (không cần từ điển). Web /dem-so/ (chọn trợ số từ), /dem-so/so-dem/ (5 tab: 0–99 · trăm/nghìn · vạn/ức · thập phân/phân số/% · số âm/thứ tự/đọc từng chữ số), /dem-so/bien-am/ (tab theo nhóm âm, bảng mẫu), /dem-so/<slug>/. Schema counters v2: số đếm chia tab, number_pattern() kiểm cả thập phân/phân số/%/số âm/số điện thoại. mn-40-031 ～個: kana ～ご → ～こ đã sửa trong `enrichment/vocabulary/lesson-40.json` (ai, chờ duyệt) — cần chạy `build` rồi `build-counters` (máy có từ điển) để `c-ko` liên kết từ vựng và hết cảnh báo. Review 2026-11-11: furigana cụm số trong câu ví dụ, bảng cách đọc (bỏ cột số trùng, tô xanh cả số > 10 theo `numberKana`), gộp mục số lớn, tab xuống dòng trên mobile. Thẻ từ vựng ～X có link "数 Cách đếm →" (qua `vocab_refs`); /dem-so/ có bảng nhanh 1–10 (つ/人/枚/本/個/回); Biến âm có hàng 100. Quiz: /dem-so/quiz/ (7c) |
| 7a | Đếm số: chạy lại `build` cho ～個 | Xong 2026-11-11 — `data/vocabulary/lesson-40.json` kana ～こ, `c-ko` liên kết mn-40-031 (lesson 40), từ ví dụ ～個 của 個 đọc こ, `_report.json` hết cảnh báo |
| 7b | Đếm số: duyệt dữ liệu ai-draft | 26 trợ số từ (`enrichment/counters/counters.json`), số đếm (`numbers.json`), biến âm (`sound-rules.json`), 284 câu ví dụ (`examples/*.txt`); kana ～個 (`_decisions/16-counters-kana.txt`) |
| 7c | Đếm số: quiz | Xong 2026-11-11 — `/dem-so/quiz/`: hiện "số + trợ số từ" ngẫu nhiên, chọn 1/4 cách đọc (phím 1–4, Enter câu tiếp); lọc trợ số từ (Combobox) / nhóm âm / ô hỏi "Cần nhớ" (149 ô biến âm + bất quy tắc, mặc định) hay "Tất cả" (366). Câu hỏi + đáp án nhiễu sinh lúc build (`web/src/lib/counter-quiz.ts`): ghép số × âm đầu trợ số từ (はちぼん, はっほん, さんほん, よんじ/しじ) + cách đọc số gần nhất, **loại mọi kana/alt của ô** → không coi cách đọc đúng là sai. Script thường (không Preact, như flashcard); điểm chỉ trong phiên, không có key localStorage. Đáp án theo dữ liệu ai-draft — duyệt ở 7b |
| 8 | **Từ nối** | schema mới (id, từ, nghĩa, loại, cách nối, ví dụ); nguồn: từ vựng `Conj` + tổng hợp |
| 9 | Pipeline: ngữ pháp 50 bài | nguồn `sources/grammar/md/`; ưu tiên sau mục 6–8 |
| 10 | Extract: PDF scan → OCR | chỉ khi cần nội dung sách scan |
| 11 | Web: trang từ nối | Kanji, chia thể, đếm số đã xong; từ nối làm sau mục 8 |
| 12 | Web: SRS, quiz, PWA, tìm kiếm | Quiz cho mọi phần: kế hoạch + task Q0–Q11 ở [quiz/](quiz/README.md) (mỗi task một file) (đã chốt D1–D6; Q1 hạ tầng test, Q2 lõi `lib/quiz/`, Q3 `QuizRunner` + chuyển quiz đếm số, e2e Playwright, Q4 quiz từ vựng, Q5 quiz Kanji + bộ thủ, Q6 quiz chia thể xong 2026-11-12; Q8 trang tổng `/luyen-tap/` xong 2026-11-13; Q7 quiz số đếm `n-num` (86 số) xong 2026-11-13; Q4b điền từ cho từ đích đã chia xong 2026-11-13 (~115 câu chờ sửa dữ liệu — [quiz/README.md](quiz/README.md) mục Lỗi dữ liệu); Q12 chia nhỏ file deck: theo dõi dung lượng, lập kế hoạch sau khi xong mọi chức năng ([quiz/q12-deck-chunking.md](quiz/q12-deck-chunking.md)); lỗi dữ liệu cần sửa ở pipeline: `mn-41-039` この間 kana `このあいだい`; `radicals.json` tên dính số 戶 "Hộ 6" / 斗 "Đầu 7" / 方 "Phương 9", thiếu biến thể 亻 氵 忄… — chi tiết [quiz/q05-kanji.md](quiz/q05-kanji.md)); đếm số xong (7c) |
| 13 | Web: deploy GitHub Pages | Xong — https://viethg1995.github.io/jp-study/ ; `.github/workflows/deploy.yml` build `web/` mỗi lần push `main` (không chạy pipeline) |
