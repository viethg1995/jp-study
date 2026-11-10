---
paths:
  - "pipeline/jp_pipeline/extract/**"
  - "pipeline/config/route_overrides.json"
  - "sources/_extracted/**"
---

# Trích xuất PDF (`sources/` → `_extracted/`)

Luật cốt lõi về truy cập `sources/` nằm ở `CLAUDE.md`. File này là quy trình chi tiết.

## Workflow bắt buộc khi cần nội dung từ PDF

```
① score-pdf      chấm điểm từng trang (không tốn token) → route: script | hybrid | ocr | ai | skip
② extract-pdf    script trích trang script/hybrid → _extracted/<sách>/content.md
③ status         AI đọc BẢNG TÓM TẮT (≈20 dòng) để biết sách nào có gì, bao nhiêu trang cần AI
④ show           AI đọc ĐÚNG vài trang cần thiết: show "<tên>" --page 20-22
⑤ export-queue   render trang hybrid/ai thành ảnh (≤1568px) vào ai_queue/ + in ước tính token
⑥ AI đọc ảnh     CHỈ sau khi user duyệt con số token ở bước ⑤; tối đa 10 trang/lượt
```

| Route | Điều kiện (xem ngưỡng trong `pdf_score.py`) | Công cụ |
|---|---|---|
| `script` | Có lớp text, bố cục đơn giản | `pymupdf4llm` — 0 token |
| `hybrid` | Có text nhưng ≥3 ô trống, hoặc ≥50% dòng ngắn ngoài bảng, hoặc ảnh (không tính ảnh nền) phủ ≥40% mà <400 ký tự | Script trích trước → AI chỉ sắp xếp lại khi cần |
| `ocr` | <30 ký tự text, có ảnh (trang scan) | Tesseract `jpn+vie` — 0 token |
| `ai` | Chỉ qua override thủ công hoặc OCR thất bại | AI đọc ảnh |
| `skip` | Không text, không ảnh | Bỏ qua |

- Ghi đè route thủ công: `pipeline/config/route_overrides.json` → `{"books/N5/Nhập môn.pdf": {"1-10": "script"}}`.
- Đổi logic/ngưỡng chấm điểm → **tăng `SCORER_VERSION`** để cache `score.json` tự vô hiệu.
- Mặc định **không xử lý trang `hybrid` bằng AI**: text script đã có sẵn; chỉ dùng AI cho trang thực sự cần cho `data/` và khi user yêu cầu.

## Lệnh

```bash
python -m jp_pipeline score-pdf                 # chấm điểm trang → route (--only, --force)
python -m jp_pipeline extract-pdf               # trích trang script/hybrid (tự score nếu thiếu; --no-images)
python -m jp_pipeline status                    # bảng tóm tắt route + ước tính token AI
python -m jp_pipeline show "kanji n4" --page 21 # in vài trang đã trích
python -m jp_pipeline export-queue "kanji n4" --pages 20-25   # ảnh trang cho AI (mặc định ≤10 trang)
```

## Ghi chú cài đặt

- Chạy script đọc file không tin cậy (PDF, zip tải về) với `python -I`. Lưu ý `-I` bỏ qua `PYTHONIOENCODING` → thêm `-X utf8` khi in tiếng Việt/Nhật ra console.
- Tên file tiếng Việt có thể ở dạng Unicode NFD: luôn chuẩn hóa NFC khi so sánh/ghi tên (`pdf_to_md.nfc`), tìm file bằng glob thay vì gõ tên trực tiếp.
- `pymupdf4llm` tự thay dấu cách trong `image_path` bằng `_` → luôn ghi ảnh vào thư mục tạm không dấu cách rồi mới chuyển (đã xử lý trong `pdf_to_md.py`). PDF lớn xử lý theo lô trang (`PAGES_PER_BATCH`).
