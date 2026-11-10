---
paths:
  - "pipeline/jp_pipeline/transform/kanji_build.py"
  - "pipeline/enrichment/kanji-report.json"
  - "data/kanji/**"
  - "sources/kanji/**"
---

# Dữ liệu Kanji (`build` sinh sau từ vựng)

- `data/kanji/kanji.json` = hợp của 2 nguồn (không lấy cả bảng JLPT):
  1. chữ trong `kanji_refs` của từ vựng (Minna + N3) → `first_lesson`, `vocab_refs` (liên kết ngược Kanji → từ);
  2. giáo trình Kanji theo cấp → `n5_lesson/n5_order`, `n4_lesson/n4_order` (Ebook Kanji N5/N4), `n3_lesson` (sách Kanji N3).
  Sắp theo bài Minna → N5 → N4 → N3 → chữ; web tự xếp trong từng bài theo `*_order`.
- Danh sách bài Ebook ở `pipeline/enrichment/kanji/lessons/{n5,n4}.txt` (commit; dòng `bài|chữ|âm HV sách`, chữ lặp trong cùng cấp → build lỗi). N4: sinh từ `parse-kanji-ebooks` (hàng chữ cỡ ≥36 ở trang mở bài, text layer). N5 là ảnh, OCR không dùng được → AI đọc bảng 5 chữ ở trang mở bài (`export-queue "EBOOK KANJI N5" --pages … --max-px 1100`; bài 1–4 ở trang 1/6/12/18, bài n≥5 ở trang 23+5·(n−5), trang 133 là bảng tổng hợp).
- On/Kun, số nét, cấp lớp, `jlpt_old`, số bộ thủ: KANJIDIC2. Âm Hán-Việt: **ưu tiên âm dùng trong từ vựng** (`han_viet_source: "vocab"`, chỉ đếm khi số âm khớp số chữ), thiếu mới dùng Unihan; không có nguồn → `[]`. Sửa âm sai → sửa ở **từ vựng** (decision file), Kanji tự đúng theo.
- Âm Hán-Việt đi qua `normalize_han_viet` (vocab_auto): sau K/L/M viết `y` (LÝ, MỸ, KỲ); giữ SĨ, TI, TỊ, HI.
- `meaning_vi` lấy từ `pipeline/enrichment/kanji/*.txt` (cú pháp `字|nghĩa`, dòng đầu `# by: ai|user`, áp theo thứ tự tên file — file sau ghi đè). `# by: ai` → `meaning_vi_source: "ai-draft"`; `# by: user` → `"user"`. Không có trong file → `null`. Nghĩa ngắn gọn, nhiều nghĩa cách bằng `, ` hoặc `; `; chữ chỉ dùng trong từ ghép → ghi kèm từ ghép, vd `挨|(挨拶 chào hỏi)`.
- `radicals.json`: bảng 214 bộ thủ trích từ PDF (cần `extract-pdf` trước); số nét suy từ khoảng số Khang Hy. Báo cáo: `pipeline/enrichment/kanji-report.json`.
- **Nét viết** `data/kanji/strokes.json` (bước cuối của `build`, `_build_strokes`): đọc `sources/dictionaries/kanjivg/kanjivg-YYYYMMDD-main.zip` (bản mới nhất theo tên; tải từ github.com/KanjiVG/kanjivg/releases), chỉ lấy chữ có trong `kanji.json`, giữ `d` + kiểu nét + vị trí số thứ tự (viewBox 109). SVG lỗi cấu trúc → build lỗi; chữ thiếu / lệch số nét với KANJIDIC2 → `pipeline/enrichment/strokes-report.json` (còn 餌 15/14 — dạng JIS2004, hợp lệ). Credit KanjiVG (CC BY-SA 3.0) + KANJIDIC2 (CC BY-SA 4.0) là BẮT BUỘC theo giấy phép — đã bỏ khỏi trang chữ (user yêu cầu), cần đặt ở trang/chân trang "Nguồn dữ liệu" trước khi public. Không dùng Hanzi Writer / Make Me a Hanzi (dạng chữ Trung Quốc).
- KANJIDIC2 có mục **chữ tương thích** (U+F900–FAFF, vd 者 U+FA5B) — NFC thành chữ thường; `build_kanjidic_index` bỏ qua các mục này (trước đây chúng ghi đè số nét/On-Kun/cấp của 26 chữ: 者 9→8 nét). Đổi parser KANJIDIC → xóa cache `sources/dictionaries/_index/kanjidic2.json`.
- **Từ ví dụ** `examples[]` trong `kanji.json` (`transform/kanji_examples.py`, chạy trong `build`): từ giáo trình (`vocab_refs`, có link thẻ) trước; thiếu < 5 → bổ sung JMdict (ưu tiên common, ngắn, chữ còn lại thuộc bộ Kanji của site; mỗi loại âm On/Kun chữ có ≥1 ví dụ thông dụng). Loại âm: tách cách đọc theo On/Kun KANJIDIC2 (+ 連濁, 促音); không tách được (熟字訓 今日 きょう) → `reading_type: null`, web xếp "Cách đọc đặc biệt". Còn 4 chữ < 5 do JMdict hết từ: 鞄貰檎殆.
- Nghĩa tiếng Việt của từ JMdict: `pipeline/enrichment/kanji/examples/NN-*.txt` (`từ|kana|nghĩa`, `# by: ai|user`; file sau ghi đè). Chưa dịch → web hiện nghĩa EN (nghiêng). Liệt kê từ chưa dịch: `python -m jp_pipeline kanji-examples-todo [--offset N --limit 400]`. Báo cáo: `pipeline/enrichment/kanji-examples-report.json`.
- **Mẹo nhớ** (`story` trong `kanji.json`): `pipeline/enrichment/kanji/stories/NN-*.txt` (`字|câu chuyện`, `# by: ai|user`; file sau ghi đè; chữ không có trong kanji.json → build lỗi). Viết dựa trên **thành phần thật** (KanjiVG), web ghi rõ "không phải nguồn gốc chữ". Không dùng Heisig/Koohii/WaniKani/hình trong ebook (bản quyền). Chữ chưa có: `python -m jp_pipeline kanji-stories-todo`.
- **Thành phần** (`components` trong `strokes.json`): nhóm `kvg:element` cấp 1 của KanjiVG (gộp nhóm tách đôi `kvg:part`; bỏ mã ngoài Unicode như `CDP-8BC4`; < 2 thành phần → `[]`). Tên: chữ trong bộ Kanji (âm HV + nghĩa đầu, bỏ ngoặc) trước, bảng 214 bộ thủ sau (biến thể tra theo `kvg:original`: 亻→人). Web tô màu nét theo thành phần.
