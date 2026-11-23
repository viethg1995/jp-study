# Q2 — Luyện tập theo nhóm số nét

## Spec

- Trang danh sách `/kanji/bo-thu/`: tiêu đề mỗi nhóm `N nét · M bộ` có thêm link `Luyện tập →` ở bên phải. Layout giống tiêu đề từng bài ở trang Kanji theo cấp (`justify-between`, `text-xs text-primary`), có `data-group-quiz`.
- Trang chi tiết `/kanji/bo-thu/<số>/`: dòng meta trong header (`Bộ số · N nét`) có thêm link `Luyện nhóm N nét →`.
- Link: `/kanji/bo-thu/quiz/?pham-vi=tat-ca&net-tu=N&net-den=N`. **Bắt buộc có `pham-vi=tat-ca`**, vì phạm vi mặc định là Kanji N5 nên nhóm nhiều nét sẽ gần như rỗng. Không truyền `loai`, để mặc định cả 2 loại câu.
- Hàm `radicalQuizHref(strokes)` đặt ở `lib/radicals.ts` để 2 trang dùng chung.
- Nhóm 1–2 bộ vẫn có link riêng (quyết định a).
- E2E `radicals.spec.ts`: bấm "Luyện tập →" của nhóm 3 nét → ô Từ/Đến số nét = 3, phạm vi "Cả 214 bộ", "Đang chọn: 31 bộ", bấm Bắt đầu thì hiện câu hỏi. Ở trang chi tiết, link "Luyện nhóm" dẫn đúng số nét.

## Sai khác so với spec

(chưa có)
