# D4 — Nội dung đoạn văn đợt 1 (AI soạn, user duyệt)

## Spec

### Số lượng & độ dài (đợt 1)

| Cấp | Số đoạn | Độ dài mỗi đoạn | Phạm vi |
|---|---|---|---|
| N5 | 6 | 11–14 câu, ~250–300 ký tự | Từ vựng + ngữ pháp Minna bài 1–25 |
| N4 | 6 | 11–14 câu, ~300–360 ký tự | Minna bài 1–50 |
| N3 | 6 | 11–14 câu, ~330–380 ký tự | Minna 1–50 + từ vựng N3 (`data/vocabulary/n3/`) |

Chỉnh 2026-11-16 (user thử `p-n5-001` bản đầu, 7 câu / 130 ký tự): **đoạn quá ngắn, nội dung khô** → tăng độ dài; văn phải có cảm xúc (xem "Văn phong"). Bản dịch tiếng Việt dài ~2,1–2,3 lần tiếng Nhật, nên tiếng Nhật ~380 ký tự là trần thực tế với ô nhập 1000 ký tự.

Giới hạn cứng (P5, pipeline chặn): tiếng Nhật ≤ 400 ký tự, tiếng Việt ≤ 900 ký tự.

Thể loại trải đều: thư/email, nhật ký, thông báo (lớp học, cửa hàng), bài viết ngắn về bản thân/gia đình/sở thích, hội thoại kể lại.

### Văn phong (user yêu cầu 2026-11-16)

- **Thán từ** trong lời thoại / suy nghĩ: ああ (tiếc, thở dài), わあ (thích thú), えっ (bất ngờ), あ (chợt nhận ra), へえ (ồ, thì ra), ええ / はい / いいえ.
- **Từ nối** để mạch văn tự nhiên: でも, それから, そして, じゃ, ですから / だから, それに (N4), それで (N4), ところが / けれども (N4–N3), すると (N3)…
- **Lời thoại trong 「」** + 〜と言いました / 〜と思いました; câu cảm xúc (うれしかったです, 残念でした, びっくりしました (N4), 楽しみです).
- Có diễn biến: mở đầu → sự việc bất ngờ / thay đổi → cảm nghĩ cuối bài. Tránh liệt kê hành động khô khan.
- Thán từ và từ hội thoại cơ bản (ああ, わあ, じゃ, ありがとう, 残念…) có thể bị `check-passages` báo "ngoài phạm vi" vì dữ liệu từ vựng không tách chúng thành mục riêng — chấp nhận được. Tính từ/danh từ thường viết kana ở trình độ N5 (かばん, おいしい, きれい, すてき, にぎやか, また) giữ kana dù có W.

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
