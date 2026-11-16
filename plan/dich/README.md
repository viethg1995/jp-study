# Luyện dịch: câu đơn + đoạn văn (2 chiều) — phần chung

Thư mục này: **README** (file này) chỉ chứa phần dùng chung; **mỗi task một file** `dNN-*.md`. Làm task nào chỉ đọc file task đó + phần liên quan ở đây.

Quy trình mỗi task: spec → **user duyệt** → làm → test → `npm run build` pass → commit → ghi "Sai khác so với spec" vào file task → cập nhật [STATUS.md](../STATUS.md) (mục 14).

## Mục tiêu

Trang Luyện dịch có 2 loại bài:

| Loại | Chiều | Hiện trạng |
|---|---|---|
| **Câu đơn** | Việt/Anh → Nhật | Đã có (`t-LL-NN`, theo bài Minna) — giữ nguyên |
| **Đoạn văn** (kiểu bài đọc hiểu JLPT) | **Nhật → Việt** và **Việt → Nhật** | Mới |

## Task

| Task | Nội dung | Trạng thái |
|---|---|---|
| [D1](d01-schema-pipeline.md) | Schema `TranslationPassage` + pipeline (`translation.json` v2) | ✅ |
| [D2](d02-worker.md) | Worker: chấm đoạn văn, tham số chiều dịch, prompt Nhật → Việt | ✅ |
| [D3](d03-web.md) | Web: tab Câu đơn / Đoạn văn, danh sách theo cấp, trang đoạn văn (chọn chiều, furigana) | ✅ |
| [D4](d04-content.md) | Nội dung: AI soạn đợt 1 (N5 + N4 + N3), user duyệt | 🔄 1/18 (`p-n5-001`) |

Thứ tự: D1 → D2 → D3 → D4. D4 có thể soạn song song sau khi D1 xong (cần schema để validate).

## Quyết định (user chốt 2026-11-16)

| # | Câu hỏi | Chốt |
|---|---|---|
| P1 ✅ | Nguồn đoạn văn | **AI soạn mới**, theo phong cách bài đọc hiểu JLPT; không chép/phỏng nguyên văn sách (bản quyền). `source: "ai-draft"`, `review: "auto"` → user duyệt → `review` đã duyệt. Web không hiện trạng thái duyệt. |
| P2 ✅ | Phân loại | **Theo cấp JLPT** (N5, N4; N3 sau). ID `p-n5-NNN`, `p-n4-NNN` — ghi cứng, không sinh từ vị trí. |
| P3 ✅ | Cách nhập | **Một ô cho cả đoạn**; AI tự tách theo câu để chấm (như câu đơn đang làm). |
| P4 ✅ | Furigana chiều Nhật → Việt | **Có nút bật/tắt**, mặc định hiện. CSS `:has()` + checkbox, không JS, không lưu localStorage. |
| P5 ✅ | Độ dài bài làm đoạn văn | **1000 ký tự** — dùng chung `MAX_ANSWER_CHARS` với câu đơn. Hệ quả: đoạn văn phải ngắn để bản dịch tiếng Việt (dài hơn tiếng Nhật ~1,5–2 lần) vừa 1000 ký tự → tiếng Nhật ≤ ~400 ký tự. |
| P6 ✅ | Cấp | N5, N4, **N3**; danh sách hiện mỗi cấp có dữ liệu một mục (N5 → N4 → N3) |

## Kiến trúc

```
enrichment/translation/
  exercises/lesson-LL.json   (câu đơn, đã có)
  passages/n5.json, n4.json  (MỚI — đoạn văn)
        │ build-translation (validate Pydantic, ruby, id ↔ level)
        ▼
data/translation.json  { schema_version: 2, exercises: [...], passages: [...] }
        │                                  │
        ▼                                  ▼
web/ (Astro, collection riêng cho passages)   worker/ (đóng gói lúc deploy)
  /dich/            câu đơn                     POST /grade { exerciseId, answer, direction? }
  /dich/doan/       danh sách đoạn theo cấp       p-… + direction ja-vi | vi-ja
  /dich/doan/<id>/  ?chieu=ja-vi|vi-ja
```

Ý chính: **một đoạn lưu song ngữ theo từng câu** (`ja` có ruby + `vi`) → dùng được cho cả hai chiều, AI chấm từng câu như câu đơn, kết quả trả về cùng `GradeResult` (web hiển thị dùng lại code).

## Rủi ro

| Rủi ro | Cách xử lý |
|---|---|
| AI soạn đoạn dùng từ/ngữ pháp vượt cấp | D1 thêm kiểm tra W (Sudachi, so với bộ từ vựng theo cấp — tái dùng `transform/examples.py`); user duyệt trước khi chuyển `review` |
| Bản tiếng Việt của đoạn sai nghĩa / cứng | User duyệt cả `vi`; prompt chấm coi `vi` chỉ là tham khảo, chấp nhận cách diễn đạt khác đúng nghĩa |
| Bài làm đoạn văn dài vượt `MAX_ANSWER_CHARS` 1000 | Giữ 1000 (P5); pipeline chặn đoạn có `ja_text` > 400 ký tự hoặc `vi` > 900 ký tự |
| Đổi `schema_version` làm worker cũ vỡ | Worker và web deploy cùng lúc với data v2; worker kiểm `schema_version` sẵn |
| Chi phí AI tăng (đoạn dài hơn câu đơn) | Cache KV theo `id + chiều + bài làm`; rate limit 6/phút/IP giữ nguyên |

## Checklist chung (cuối D3)

- [ ] `python -m jp_pipeline build-translation` pass; `pytest` pass
- [ ] `cd web && npm run build` pass (gồm `check:schema`); e2e trang đoạn văn (desktop + mobile 375px), máy chấm giả lập
- [ ] `cd worker && npm run check` pass; deploy worker; chấm thật 1 đoạn mỗi chiều
- [ ] STATUS.md mục 14 cập nhật
