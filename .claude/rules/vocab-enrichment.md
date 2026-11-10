---
paths:
  - "pipeline/enrichment/vocabulary/**"
  - "pipeline/jp_pipeline/transform/vocab_*.py"
  - "pipeline/jp_pipeline/dictionaries.py"
  - "data/vocabulary/**"
  - "sources/vocabulary/**"
---

# Bổ sung & duyệt dữ liệu từ vựng

## Thứ tự ưu tiên

`sources/` (gốc) ← `enrichment/_auto/` (script, từ điển mở) ← `enrichment/lesson-XX.json` (đã duyệt). Lớp sau ghi đè lớp trước khi build.

- `_auto/` do `enrich-vocab` sinh — GHI ĐÈ mỗi lần chạy; `review.json` = mục cần duyệt.
- `_decisions/` — file quyết định duyệt (`LL-NNN|kanji|han_viet|ghi chú`), lưu vết lý do.
- `lesson-XX.json` — do người/AI duyệt; script KHÔNG ghi đè.

## Luật

- Script chỉ điền khi **duy nhất một đáp án** (lọc theo từ loại `type_code`; type_code lạ → không điền). Nhập nhằng → cờ + ứng viên trong `_auto/review.json`.
- Kanji bổ sung từ JMdict luôn mang cờ `kanji_verify` + `kanji_gloss` (nghĩa EN) để đối chiếu nhanh với `vn` khi duyệt.
- Âm Hán-Việt: ưu tiên bảng học từ dữ liệu có sẵn (`derived`), sau đó Unihan `kVietnamese` (thiếu nhiều âm, vd 行 chỉ có "hàng"; **lẫn cả âm Nôm**: 磨 MÀI, 又 LẠI, 別 BIẾT, 濡 NHỤA… — âm từ Unihan luôn cần soát).
- ID từ vựng `mn-LL-NNN` suy ra từ `legacy_id` (`lessonL_N`) gốc — cố định, không phụ thuộc vị trí mảng.
- **File quyết định** trong `_decisions/` đặt tên có số thứ tự (`01-…`, `02-…`), dòng đầu `# by: user|ai`. Luôn áp bằng `apply-all-reviews` (áp đúng thứ tự — áp lẻ sai thứ tự sẽ ghi đè kết quả vòng sau). File tên chứa `-pos` là quyết định từ loại.
- Trong file quyết định, `=` nghĩa là **không đụng tới trường đó**: không ghi, cũng không xóa. Chưa ai quyết → `_auto` chảy qua; file trước đã quyết → giữ nguyên (trước 2026-11-09 `=` xóa giá trị, làm file sau xóa mất kanji 噛 do vòng trước gán).
- **Từ loại chuẩn hóa (schema v2):** mã phải nằm trong `POS_LABELS` (`schemas.py`), nhãn tiếng Việt **sinh từ mã** — không dùng nhãn gốc. `enrich-vocab` đề xuất sửa (`pos_suggested`, cờ `pos_verify`) theo JMdict: `PN` → `N` cho danh từ thông dụng; sửa nhóm động từ (godan す-verb gốc ghi V3, あります là V1, 信じます/落ちます là V2…). Tên nước/người thật giữ `PN`. Mẫu `～` (この～, どんな～, おおきな～) là `Det`; もう～/あと～ là `Adv`; こくさい～ là `Pre`. Người duyệt từ loại ghi ở `review.pos_by` (không ghi đè `review.by`).
- Quy ước duyệt kanji: こそあど (これ, ここ, こちら…), trợ từ/hậu tố, và kanji ateji/cổ (此れ, 迚も, 為る, 遣る…) → **không gán kanji** (`kanji_source: "none"`). Giá trị do AI tự quyết (không có trong nguồn) → `"ai-draft"`; âm Hán-Việt không chắc → để `null`, không đoán.

## Lỗi nguồn đã biết

- `kanji_vn` gốc có lỗi scrape (dính âm của từ khác trong cụm ví dụ: `HƯUHỘI XÃ`, `ĐIỆN THOẠI` cho かけます). Script tự loại khi: gốc không có kanji; số âm ≠ số chữ Hán; hoặc có âm tiết dính liền (`is_glued`). Giá trị gốc giữ ở `han_viet_original` trong `_auto/`.
- Báo cáo `build-report.json` → `han_viet_conflicts` (chữ có nhiều âm giữa các từ) là công cụ chính để tìm lỗi nguồn còn sót; đa âm hợp lệ (楽 LẠC/NHẠC, 長 TRƯỜNG/TRƯỞNG) thì bỏ qua.

## Lệnh

```bash
python -m jp_pipeline enrich-vocab              # kanji / Hán-Việt / ID cho từ vựng → enrichment/vocabulary/_auto/
python -m jp_pipeline apply-all-reviews         # áp MỌI file _decisions/ theo thứ tự (đọc "# by:")
python -m jp_pipeline apply-vocab-review enrichment/vocabulary/_decisions/<file>.txt [--by user]
python -m jp_pipeline apply-pos-review enrichment/vocabulary/_decisions/<NN-pos>.txt [--by user]
python -m jp_pipeline apply-meaning-review enrichment/vocabulary/_decisions/<NN-meaning>.txt [--by user]
python -m jp_pipeline apply-all-examples              # áp lại mọi file câu ví dụ (đọc "# by:")
python -m jp_pipeline check-meanings                  # lọc nghĩa/kanji nghi sai (JMdict) → _auto/meaning-check.json
```

## Schema v3 & lớp sửa nghĩa (2026-11-10)

- Nguồn `user` (provenance kanji / han_viet / pos / meaning): giá trị **khác gốc** do người duyệt; `ai-draft` = AI đổi, chờ duyệt. AI áp file sau **không hạ cấp** `review.by = user`.
- Sửa nghĩa: file `_decisions/NN-…-meaning….txt` (`LL-NNN|nghĩa mới|ghi chú`) → `meaning_vi` + `provenance.meaning`. Dispatch theo tên: `-pos` → từ loại, `-meaning` → nghĩa, `-kana` → sửa kana gõ sai (`LL-NNN|kana mới|ghi chú`, vd ヨロッパ → ヨーロッパ), còn lại → kanji/Hán-Việt.
- Build tự chuẩn hóa: ký hiệu chỗ trống `~ ― － -` và `ー` ở đầu kana/kanji (`ーねん`) → `～` (kana, kanji, nghĩa; `-` đứng một mình cuối cụm như `năm -` cũng đổi); cột kanji không chứa chữ Hán (かけます, １つ) → `null` (schema cũng chặn).
- `senses[]` = `meaning_vi` tách theo `;`, mỗi nghĩa tách `[ngữ cảnh]` **ở cuối** thành `context`; ngoặc giữa câu (`món [cơm] ca-ri`) giữ trong `text`. Quiz/tìm kiếm dùng `senses[].text`.
- `same_word[]` = liên kết 2 chiều các mục cùng kana + kanji ở bài khác (thường là nghĩa mới: かけます đeo/treo/khóa/ngồi) — mỗi mục vẫn là thẻ học riêng.
- `check-meanings`: lọc nghi sai nghĩa/kanji bằng JMdict (đồng âm thông dụng, kanji không khớp cách đọc) → `_auto/meaning-check.json`. Mục đã soát ghi vào `enrichment/vocabulary/meaning-check-ok.txt` để không hiện lại; chỉ đọc mục mới.
- Câu ví dụ: dòng `# by: user` đầu file `_examples/lesson-XX.txt` = bài đã duyệt; `apply-all-examples` áp lại mọi file theo header (trước đây trạng thái duyệt bài 1 bị mất khi áp lại không kèm `--by user`).

- Trợ số từ / đơn vị đi sau số (～人, ～枚, ～台, ～回, ～本, ～杯, ～個, ～歳, ～階, ～メートル…) mang mã **`Cnt`** (`_decisions/12-counters-pos.txt`); hậu tố không đi sau số (～さん, ～語, ～屋, ～中) giữ `Suf`.
