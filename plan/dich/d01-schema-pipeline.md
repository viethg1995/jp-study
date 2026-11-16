# D1 — Schema `TranslationPassage` + pipeline

## Spec

### Schema (`pipeline/jp_pipeline/schemas.py`)

`TRANSLATION_SCHEMA_VERSION = 2`. `TranslationFile` thêm `passages: list[TranslationPassage]` (câu đơn `exercises` giữ nguyên).

```python
PASSAGE_ID = re.compile(r"^p-n[1-5]-\d{3}$")   # p-n5-001 — ghi cứng

class PassageSentence(_Strict):
    ja: str            # có ruby {漢字|かな} cho mọi chữ Hán (cú pháp như câu ví dụ, KHÔNG có [[…]])
    ja_text: str       # pipeline sinh: bỏ ruby (surface) — worker/web dùng khi cần chữ thường
    ja_alt: list[str]  # cách dịch tiếng Nhật khác cũng đúng (chữ thường) — cho chiều Việt → Nhật
    vi: str            # bản dịch tiếng Việt chuẩn
    vi_alt: list[str]  # cách dịch tiếng Việt khác — cho chiều Nhật → Việt
    note_vi: str | None  # ghi chú cho AI chấm + người học
    para: int          # số đoạn (1, 2, …) để hiển thị xuống đoạn; tăng dần, bắt đầu từ 1

class TranslationPassage(_Strict):
    id: str                       # p-nX-NNN
    level: Literal["n5", "n4", "n3"]
    title_ja: str                 # tiêu đề tiếng Nhật (ruby như ja)
    title_vi: str
    genre: Literal["letter", "diary", "notice", "essay", "dialogue", "email"]  # kiểu bài đọc hiểu JLPT
    focus_vi: list[str]           # điểm ngữ pháp/từ vựng đáng chú ý
    sentences: list[PassageSentence]  # 3–20 câu
    source: Literal["ai-draft", "user"]
    review: ReviewStatus
```

Validator:
- `id` khớp `PASSAGE_ID` và tiền tố cấp = `level` (`p-n5-…` ↔ `"n5"`).
- `ja`, `title_ja`: parse được bằng `transform/examples.parse_ruby`; không chứa `[[`/`]]`; chữ Hán ngoài `{…|…}` → lỗi (mọi kanji phải có furigana).
- `para` không giảm, bắt đầu 1.
- Độ dài (P5): tổng `ja_text` ≤ 400 ký tự, tổng `vi` ≤ 900 ký tự (để bài làm vừa `MAX_ANSWER_CHARS` 1000).
- `ja_alt`, `vi_alt`: không rỗng, không chứa cú pháp ruby.

### Pipeline (`transform/translation.py`, `cli.py`, `paths.py`)

- `paths.py`: `ENRICH_TRANSLATION_PASSAGES = …/enrichment/translation/passages`.
- `build_translation(exercise_docs, passage_docs)`: đọc `passages/*.json` (mỗi file một mảng đoạn; tên file = cấp, vd `n5.json`), điền `ja_text` (bỏ ruby), kiểm trùng id, sắp theo id.
- File nguồn **không** có `ja_text` (pipeline sinh) → model nhập riêng `PassageSentenceIn` không có trường đó, hoặc validator bỏ qua; chọn cách gọn khi làm.
- `data/_schema/translation.schema.json` ghi lại; zod ở `web/src/lib/schemas.ts` đồng bộ (gate `check:schema`).

### Kiểm tra phạm vi cấp (cảnh báo W, không chặn build)

Lệnh mới `python -m jp_pipeline check-passages [--level n5]`: tách từ bằng Sudachi (`examples.analyze`), so với từ vựng Minna theo cấp (N5 = bài 1–25, N4 = 1–50; N3 thêm bộ N3), in từ ngoài phạm vi + furigana khác Sudachi. Tái dùng hàm của `check-examples`, không viết lại.

### Test (`pipeline/tests/`)

- id sai dạng / lệch cấp → lỗi; kanji thiếu ruby → lỗi; `para` giảm → lỗi; trùng id → lỗi.
- `ja_text` = bỏ ruby đúng; file mẫu nhỏ build ra `TranslationFile` v2 hợp lệ.

## Sai khác so với spec

- **Kiểm ruby ở transform, không ở validator schema:** `schemas.py` không import `transform/` (tránh vòng phụ thuộc). `transform/translation.py` parse ruby (`parse_ruby(…, targets=0)`), sinh `ja_text`, rồi mới `model_validate`. Nguồn mà ghi sẵn `ja_text` → lỗi.
- `parse_ruby` (examples.py) thêm tham số `targets` (mặc định 1 — câu ví dụ không đổi; đoạn văn 0).
- File nguồn phải đúng tên cấp: đoạn `level: n5` nằm trong `n5.json`.
- `check-passages` dùng hàm mới `check_text` tách từ `check_example` (furigana khác Sudachi, từ có kanji viết kana, từ ngoài phạm vi). Mọi vấn đề của đoạn văn là **W**. Đã đối chiếu: `check-examples` trước/sau tách hàm cùng kết quả (1571 câu, 0 E, 103 W).
- Thêm `paths.OUT_VOCAB_N3`, `paths.ENRICH_TRANSLATION_EXERCISES`, `paths.ENRICH_TRANSLATION_PASSAGES`.
- **Làm sớm một phần D2/D3 để build không vỡ khi data lên v2:** zod `passageSentence`/`translationPassage`/`translationFile` v2 + collection `translationPassages` (`content.config.ts`, parser chung `translationPart`); worker `SCHEMA_VERSION = 2`.
- Kiểm tra: pytest 243 pass; ruff không thêm lỗi mới; `check:schema` pass; `npm run build` web pass (233 unit test).
