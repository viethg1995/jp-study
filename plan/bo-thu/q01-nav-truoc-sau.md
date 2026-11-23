# Q1 — Nút Trước / Sau trên trang chi tiết bộ thủ

## Spec

- Thứ tự theo **số bộ** (1 → 214), chỉ tính các bộ **có trang**, tức có chữ giáo trình hoặc chữ chỉ có trong từ vựng. Khoảng 196 bộ; bộ không có trang bị bỏ qua để không ra 404.
- `web/src/lib/radicals.ts`:
  - `hasRadicalPage(d: RadicalKanji)`: điều kiện có trang, dùng chung cho `getStaticPaths` ở `[number].astro` và ô bộ thủ có link ở `bo-thu/index.astro`.
  - `radicalNeighbors(number, pageNumbers)` → `{ prev, next }`, là số bộ hoặc `null`.
- `[number].astro`, header: `← 41 寸` · `Bộ thủ` · `43 尢 →` (style `navLink` như trang Kanji). Bộ đầu ẩn "←", bộ cuối ẩn "→". Không cần JS.
- Test:
  - Unit `radicals.test.ts`: neighbor luôn là bộ có trang; bộ đầu không có prev, bộ cuối không có next; prev/next đối xứng.
  - E2E `radicals.spec.ts`: bấm Sau → bộ kế, bấm Trước → về bộ cũ.

## Sai khác so với spec

(chưa có)
