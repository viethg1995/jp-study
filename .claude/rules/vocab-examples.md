---
paths:
  - "pipeline/enrichment/vocabulary/_examples/**"
  - "pipeline/jp_pipeline/transform/examples.py"
  - "pipeline/scripts/append_examples.py"
  - "web/src/lib/ruby.ts"
---

# Câu ví dụ từ vựng (phương án B — Claude Code viết theo bài, không dùng API)

Quy trình mỗi bài (≈1–2K token):

```
examples-pack N  →  AI viết _examples/lesson-NN.txt  →  apply-examples  →  check-examples --lesson N  →  sửa → build
```

## Luật viết câu

- Cú pháp ruby: `{漢字|かな}` cho **mọi** chữ Hán; `[[…]]` bao đúng một lần từ đang học (được chia thể: `[[{起|お}きて]]`).
- **Mọi từ có kanji trong bộ từ vựng** (từ đang học lẫn các từ khác trong câu) **BẮT BUỘC viết kanji + furigana**, kể cả khi `display: kana` (vd `{私|わたし}は…`, `[[{誰|だれ}]]`). `check-examples` báo lỗi E nếu vi phạm. Ngoại lệ: động từ phụ ある/いる/する, và kana nằm trong từ vốn viết kana (さくら大学, あの人).
- Ngoại lệ khác của luật "mọi từ có kanji": thán từ (はい ≠ 杯), từ ngữ pháp `GRAMMAR_WORDS` (こと, つもり, とおり, しれ…), `～という`, `V たところです`; gợi ý kanji chỉ khi **từ loại tương thích** (`pos_compatible`) để tránh đồng âm (もう ≠ 申).
- Chỉ dùng từ vựng + ngữ pháp bài 1…N (`max_lesson = N`). 1 câu/từ; chỉ bỏ qua cụm hội thoại/chào hỏi **trọn câu** (`Conv`/`Greet` không có `～`, vd はじめまして) — xem `needs_example()`. **Không** bỏ qua `PN`: dữ liệu gốc gán nhầm PN cho ~195 danh từ thông dụng (ノート, コーヒー, くに, かいしゃ…); `Conv` có `～` (この～, どんな～) là mẫu cần ví dụ.
- Câu mới mặc định `source: "ai-draft"`, `review: "auto"`; user duyệt xong chạy lại `apply-examples … --by user`.
- Parser ruby ở `web/src/lib/ruby.ts` phải khớp `transform/examples.py`.

## `check-examples` (gate)

- **E** (lỗi — phải sửa): cú pháp, kanji thiếu furigana, `[[…]]` không khớp từ.
- **W** (cảnh báo — xem xét): furigana khác Sudachi mà không có trong bộ từ vựng; từ ngoài phạm vi bài (đã bỏ qua tên người trước さん/先生, từ OOV, chữ Latin, từ ghép đã biết).

## Ghi chú cài đặt

- Dữ liệu gốc có `type_code` động từ sai nhóm (借ります ghi V1, 貸します ghi V3) → `_dict_forms` sinh cả dạng godan lẫn ichidan; thể て godan biến âm (急いで) so khớp qua lemma Sudachi.

## Lệnh

```bash
python -m jp_pipeline examples-pack 2           # gói đầu vào để viết câu ví dụ bài 2
python -m jp_pipeline apply-examples enrichment/vocabulary/_examples/lesson-02.txt [--by user]
python -m jp_pipeline check-examples --lesson 2 # kiểm tra cú pháp / furigana (Sudachi) / phạm vi bài
python -I scripts/append_examples.py <file>     # nối câu ví dụ nhiều bài (LL-NNN|ruby|vi) vào _examples/lesson-LL.txt
```
