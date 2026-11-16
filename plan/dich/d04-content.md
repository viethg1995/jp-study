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

Đợt 1 xong 2026-11-16: 18 đoạn (N5 6, N4 6, N3 6), 222 câu, tất cả `ai-draft` / `review: auto` — **chờ user duyệt**.

| Đoạn | Thể loại | Câu | Ký tự Nhật / Việt |
|---|---|---|---|
| p-n5-001 Ngày chủ nhật mưa | Bài viết | 13 | 271 / 554 |
| p-n5-002 Lá thư gửi mẹ | Thư | 13 | 221 / 476 |
| p-n5-003 Nhật ký ngày sinh nhật | Nhật ký | 13 | 235 / 582 |
| p-n5-004 Thông báo trường Sakura | Thông báo | 12 | 214 / 514 |
| p-n5-005 Đi ngắm hoa không? | Email | 14 | 219 / 466 |
| p-n5-006 Hỏi đường | Hội thoại | 13 | 247 / 543 |
| p-n4-001 Lời cảm ơn sau homestay | Thư | 13 | 324 / 722 |
| p-n4-002 Ngày đầu đi làm thêm | Nhật ký | 12 | 280 / 585 |
| p-n4-003 Về cách đổ rác | Thông báo | 12 | 268 / 590 |
| p-n4-004 Một tuần không có smartphone | Bài viết | 12 | 278 / 632 |
| p-n4-005 Xin nghỉ học | Email | 13 | 244 / 512 |
| p-n4-006 Đồ để quên | Hội thoại | 13 | 297 / 590 |
| p-n3-001 Bắt đầu sống một mình | Bài viết | 12 | 324 / 750 |
| p-n3-002 Gửi thầy giáo cấp hai | Thư | 12 | 327 / 661 |
| p-n3-003 Thông báo từ thư viện | Thông báo | 11 | 277 / 714 |
| p-n3-004 Ngày leo núi Phú Sĩ | Nhật ký | 12 | 293 / 731 |
| p-n3-005 Về việc đổi ngày họp | Email | 11 | 250 / 582 |
| p-n3-006 Chuyện tiết kiệm tiền | Hội thoại | 11 | 317 / 749 |

- **Độ dài thấp hơn mục tiêu ~10–20%** (N5 214–271, N4 244–324, N3 250–327 ký tự Nhật) — vẫn gấp ~2 lần bản đầu (130). Tỉ lệ Việt/Nhật thực tế 2,1–2,6 (thông báo, email cao nhất) → N3 dài thêm sẽ chạm trần 900 ký tự Việt. Kéo dài thêm cần nâng `MAX_ANSWER_CHARS` cho đoạn văn.
- `ja_alt` / `vi_alt` chỉ có ở `p-n5-001`; các đoạn khác để trống — prompt chấm đã coi bản mẫu là tham khảo, chấp nhận cách dịch khác đúng ý.
- `check-passages`: 177 W, đã xem hết. Đã sửa từ vượt cấp thật (N5: 毎週, 泣く, 集まる, ピクニック, 次, 今度, 返事; N4: 緊張, 散らかす, 範囲, 預かる; N3: 家計簿, 調整, 日程). Còn lại chấp nhận: (1) Sudachi đọc sai — 富士山 ふじさん, 二十 はたち, 四月 しがつ, 九時 くじ, 一週間 いっしゅうかん, 二日 ふつか, 十分 じゅっぷん, 一階 いっかい, 四時半 よじはん, (水) すい / (木) もく; (2) từ cơ bản không có mục riêng trong dữ liệu từ vựng Minna (夜, 最初, 場合, 気持ち, どうぞ, ぜひ, アパート, うれしい…) và thán từ/chào hỏi; (3) N3: dữ liệu từ vựng N3 chỉ 14 bài nên từ N3 chuẩn (挑戦, 頂上, 苦手, 実家…) đều bị báo; (4) từ thường viết kana ở trình độ thấp (かばん, きれい, おいしい, わかる, また).
- Soạn bằng định dạng dòng (`para :: ja :: vi :: ghi chú`) rồi chuyển sang JSON bằng script tạm — file nguồn chuẩn vẫn là `passages/nX.json`.
- Kiểm tra: `build-translation` pass (lỗi ruby 「一杯 thiếu furigana bị chặn và đã sửa); web build + e2e `translation.spec.ts` 10/10; worker deploy 2026-11-16, chấm thật `p-n3-004` (ja-vi) bắt đúng 日の出 ≠ “mặt trời lặn”.
