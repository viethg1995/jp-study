# D3 — Web: tab Câu đơn / Đoạn văn, trang đoạn văn

## Spec

### Trang & URL

| URL | Nội dung |
|---|---|
| `/dich/` | Tiêu đề "Luyện dịch" + **tab** `Câu đơn` · `Đoạn văn` (link giữa 2 trang, kiểu Segmented); bên dưới là danh sách câu đơn theo bài (như hiện tại) |
| `/dich/doan/` | Cùng tab (tab Đoạn văn đang chọn); danh sách đoạn **theo cấp** N5 / N4 / N3 (mỗi cấp có dữ liệu một section, thứ tự N5 → N4 → N3): tiêu đề (vi + ja), thể loại, số câu |
| `/dich/doan/<id>/` | Trang làm bài một đoạn |

Menu (`lib/nav.ts`): mục "Luyện dịch" giữ nguyên `dich/` (tab nằm trong trang).

### Trang `/dich/doan/<id>/`

- Đầu trang: `N5 · Thư` (cấp · thể loại), `<h1>` = `title_vi`, dòng `title_ja`, tag `focus_vi`.
- **Chọn chiều**: Segmented `Nhật → Việt` · `Việt → Nhật`, ghi URL `?chieu=ja-vi|vi-ja` (mặc định `ja-vi` — giống đọc hiểu). Đổi chiều: đổi đề hiển thị, nhãn ô nhập, `lang` ô nhập; **xóa kết quả chấm cũ**, giữ chữ trong ô nhập chỉ khi chưa nộp (đổi chiều sau khi nộp → hỏi xác nhận nếu ô có chữ).
- **Đề**:
  - `ja-vi`: đoạn tiếng Nhật render từ `ja` (ruby `<ruby>` qua `lib/ruby.ts` / component Furigana có sẵn), nhóm theo `para` thành `<p>`; công tắc **Furigana Hiện/Ẩn** (checkbox + CSS `:has()`, mặc định hiện, không lưu).
  - `vi-ja`: đoạn tiếng Việt từ `vi`, nhóm theo `para`.
  - Cả 2 chiều render sẵn lúc build, chiều không chọn ẩn bằng thuộc tính `hidden` → không cần tải thêm.
- **Ô nhập**: một textarea; `lang` = `vi` hoặc `ja`; giới hạn `MAX_ANSWER_CHARS` (1000, khớp worker); placeholder "Dịch cả đoạn, có thể xuống dòng sau mỗi câu…".
- **Kết quả**: dùng lại phần hiển thị của trang câu đơn — tách hàm render ra `lib/translation-render.ts` (hoặc component) để 2 trang dùng chung. Mỗi câu thêm dòng **câu gốc** (đề của câu đó) phía trên bài làm, vì đoạn dài khó dò. "Bản dịch mẫu" = `vi`+`vi_alt` (ja-vi) hoặc `ja_text`+`ja_alt` (vi-ja).
- Điều hướng trước/sau trong cùng cấp.
- SEO: `description` từ `title_vi` + đầu đoạn tiếng Việt, `clip()`.

### Dữ liệu web

- `content.config.ts`: collection `translationPassages` đọc `data/translation.json` → `passages` (loader `file` với `parser` lấy mảng `passages`); collection `translation` cũ đổi `parser` lấy `exercises` (vì file thành object có 2 mảng). Kiểm `schema_version === 2`.
- `lib/schemas.ts`: zod `passageSentence`, `translationPassage`, `translationFile` v2 (gate `check:schema`).
- `lib/translation.ts`: `passagePath(id)`, kiểu `Direction = "ja-vi" | "vi-ja"`, `LEVEL_LABELS`, `GENRE_LABELS`.

### Test

- Unit (`lib/*.test.ts`, dữ liệu thật): mọi đoạn có ≥ 3 câu, `para` hợp lệ, `ja` parse được bằng `parseRuby` và surface = `ja_text`.
- E2E `e2e/translation-passage.spec.ts` (desktop + mobile 375px): chặn `**/grade` bằng `page.route` trả `GradeResult` giả → kiểm: đổi chiều đổi đề + URL; tắt furigana ẩn `<rt>`; nộp → hiện kết quả đúng số câu; tab `/dich/` ↔ `/dich/doan/` hoạt động. Thêm e2e tối thiểu cho trang câu đơn (hiện chưa có) cùng file.

## Sai khác so với spec

(ghi khi làm)
