# D4 — Nội dung đoạn văn đợt 1 (AI soạn, user duyệt)

## Spec

### Số lượng & độ dài (đợt 1)

| Cấp | Số đoạn | Độ dài mỗi đoạn | Phạm vi |
|---|---|---|---|
| N5 | 6 | 4–8 câu, ~150–250 ký tự | Từ vựng + ngữ pháp Minna bài 1–25 |
| N4 | 6 | 6–10 câu, ~250–400 ký tự | Minna bài 1–50 |
| N3 | 6 | 6–10 câu, ~300–400 ký tự | Minna 1–50 + từ vựng N3 (`data/vocabulary/n3/`) |

Giới hạn cứng (P5, pipeline chặn): tiếng Nhật ≤ 400 ký tự, tiếng Việt ≤ 900 ký tự.

Thể loại trải đều: thư/email, nhật ký, thông báo (lớp học, cửa hàng), bài viết ngắn về bản thân/gia đình/sở thích, hội thoại kể lại.

### Luật soạn

- Viết **mới hoàn toàn**; không chép, không phỏng theo bài đọc trong sách Minna/JLPT (bản quyền).
- `ja`: ruby `{漢字|かな}` cho mọi chữ Hán (như câu ví dụ từ vựng); thể lịch sự です・ます trừ thể loại nhật ký/thư thân mật (ghi rõ trong `note_vi`).
- `vi`: dịch sát nghĩa nhưng tự nhiên; `vi_alt`/`ja_alt` chỉ thêm khi có cách diễn đạt khác thường gặp.
- `source: "ai-draft"`, `review: "auto"`.
- Không chắc nghĩa/cách đọc → không dùng từ đó (CLAUDE.md luật 5).

### Quy trình

```
AI viết enrichment/translation/passages/n5.json, n4.json, n3.json
  → python -m jp_pipeline build-translation   (validate)
  → python -m jp_pipeline check-passages      (từ vượt cấp, furigana lạ → sửa)
  → user đọc duyệt (nghĩa, độ tự nhiên, độ khó) → đổi review
  → build web + deploy worker
```

## Sai khác so với spec

(ghi khi làm)
