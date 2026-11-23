# Bộ thủ: điều hướng + luyện tập theo nhóm số nét — phần chung

Thư mục này: **README** (file này) chỉ chứa phần dùng chung; **mỗi task một file** `qNN-*.md`.

Quy trình mỗi task: spec → **user duyệt** → làm → test → `npm run build` + `npm run test:e2e` pass → ghi "Sai khác so với spec" vào file task → cập nhật [STATUS.md](../STATUS.md).

## Vấn đề (user báo 2026-11-23)

1. Trang chi tiết bộ thủ `/kanji/bo-thu/<số>/` không có nút sang bộ trước / bộ sau.
2. Chưa có lối luyện tập cho từng nhóm số nét như link "Luyện tập →" của từng bài Kanji / từ vựng.

## Phạm vi

Chỉ sửa `web/`. Không đụng pipeline, `data/` hay schema. Trang quiz bộ thủ `/kanji/bo-thu/quiz/` đã đọc bộ lọc từ URL (`pham-vi`, `net-tu`, `net-den`, `loai`), nên không phải sửa.

## Task

| Task | Nội dung | Trạng thái |
|---|---|---|
| [Q1](q01-nav-truoc-sau.md) | Nút Trước / Sau trên trang chi tiết bộ thủ | ✅ 2026-11-23 |
| [Q2](q02-luyen-tap-theo-net.md) | Link "Luyện tập →" cho từng nhóm số nét (trang danh sách + trang chi tiết) | ✅ 2026-11-23 |

## Quyết định (user chốt 2026-11-23)

- Nhóm ít bộ (14–17 nét, 1–2 bộ) vẫn có link riêng, không gộp (phương án a). Đáp án nhiễu của quiz lấy từ cả 214 bộ, nên nhóm 1 bộ vẫn chạy được.
- Trang chi tiết bộ thủ có thêm link "Luyện nhóm N nét →".
