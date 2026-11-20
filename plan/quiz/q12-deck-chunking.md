# Q12 — Chia nhỏ file deck (chunk) để tăng hiệu năng tải

> Phần chung (quyết định D1–D6, kiến trúc, bất biến, luồng làm bài, checklist): [README.md](README.md). File này chỉ chứa riêng task Q12.

Trạng thái: ✅ **xong 2026-11-17** (bước 3, user duyệt: APPLY) — kết quả ở mục cuối. Task sau làm deck lớn thêm → đo lại theo chunk (lệnh đo dưới).

## Vì sao

Mỗi deck là **một file JSON cho cả cấp** (vd `vocabulary/quiz/n5-dien.json` = bài 1–25), tải lười khi bấm Bắt đầu. Người học chọn bài 3–5 vẫn tải cả cấp. Trang tổng `/luyen-tap/` tải nhiều file cùng lúc. File đang lớn dần theo từng task, và sẽ còn tăng khi sửa dữ liệu của Q4b (~115 câu) và thêm Q7, Q11.

## Số đo (bản build, gốc / gzip)

Cập nhật mỗi khi một task làm deck lớn thêm. Mốc trong unit test (từ 2026-11-17): **mỗi chunk** < 150KB gốc / < 25KB gzip; bảng chia theo sách < 550KB / < 55KB (`chunks.test.ts`). Bảng dưới là số đo cả cấp **trước** khi chia.

| Ngày | File | Gốc | Gzip | Ghi chú |
|---|---|---|---|---|
| 2026-11-13 | `chia-the/quiz/dong-tu.json` | 742KB | 72KB | bảng chia gọn, câu sinh trên trình duyệt |
| 2026-11-13 | `kanji/quiz/tv-n5-doc.json` | 547KB | 82KB | lớn nhất theo gzip |
| 2026-11-13 | `vocabulary/quiz/n5-dien.json` | 440KB | 62KB | **sát mốc 450KB** sau Q4b (+82 câu) |
| 2026-11-13 | `vocabulary/quiz/n4-dien.json` | 397KB | 64KB | Q4b +142 câu |
| 2026-11-13 | `vocabulary/quiz/n3-dien.json` | 380KB | 64KB | Q4b +162 câu |
| 2026-11-16 | `vocabulary/quiz/n3-dien.json` | 415KB | 69KB | +54 câu N3 (tra `aliases` bảng chia) — **sát mốc 70KB gzip** |
| 2026-11-16 | `chia-the/quiz/dong-tu.json` | 744KB | 72KB | thêm `aliases` vào hàng |
| 2026-11-16 | `chia-the/quiz/dong-tu.json` | 753KB | 73KB | +10 hàng tách khỏi alias gộp theo kana (bước 1.1) |
| 2026-11-17 | `vocabulary/quiz/n5-dien.json` | 451KB | 63KB | bước 2.1 thể phái sinh (+8 câu) — **vượt mốc 450KB** → mốc test tạm 500KB / 75KB |
| 2026-11-17 | `vocabulary/quiz/n4-dien.json` | 428KB | 69KB | bước 2.1 (+28 câu: bài 37, 43, 48, 49) |
| 2026-11-17 | `vocabulary/quiz/n3-dien.json` | 417KB | 69KB | bước 2.1 (+4 câu) |
| 2026-11-16 | `vocabulary/quiz/n5-dien.json` | 445KB | 63KB | +8 câu (khớp theo cách đọc) — **sát mốc 450KB gốc** |
| 2026-11-16 | `vocabulary/quiz/n4-dien.json` | 409KB | 66KB | +22 câu |
| 2026-11-13 | `vocabulary/quiz/n5-tu.json` | 409KB | 54KB | |
| 2026-11-13 | `kanji/quiz/tv-n4-doc.json` | 370KB | 54KB | |
| 2026-11-17 | `chia-the/quiz/dong-tu.json` | 821KB | 79KB | Q13 +56 động từ N3 có hàng riêng |
| 2026-11-13 | `/luyen-tap/dem-so.json` | 177KB | 14KB | Q7 thêm 86 câu số |
| 2026-11-13 | `/luyen-tap/` bài 1–25, đủ 4 phần | — | ~380KB | 10 file; đo ở Q8 trước Q4b (377KB) |
| 2026-11-13 | `/luyen-tap/` bài 1–50, đủ 4 phần | — | ~600KB | 19 file; đo ở Q8 trước Q4b (599KB) |

Lệnh đo (sau `npm run build`):

```bash
cd web/dist && for f in vocabulary/quiz/*.json kanji/quiz/*.json chia-the/quiz/*.json luyen-tap/*.json; do
  printf "%s %s %s\n" "$f" $(wc -c <"$f") $(gzip -c "$f" | wc -c); done | sort -k2 -n -r | head
```

## Hướng xử lý (ghi ban đầu)

- **Chunk theo nhóm bài** (vd 5 bài/file: `n5-dien-01-05.json`) → bộ lọc bài chỉ tải chunk cần; trang tổng tải ít file hơn khi khoảng bài hẹp. Cần: `mixFiles` (Q8) và trang từng phần biết danh sách chunk; nhớ đệm PWA theo chunk.
- **Gọn dữ liệu lặp**: `explain`, `href`, `info` lặp nhiều giữa các câu cùng từ → bảng tra theo ID từ, câu chỉ giữ khóa.
- **Sinh câu trên trình duyệt** (như chia thể) cho deck có quy luật, đổi lấy CPU lúc bắt đầu lượt.
- Đo trước/sau: tổng dung lượng tải cho các bộ lọc thường dùng (1 cấp đủ bài, 3 bài, trang tổng 1–25 và 1–50), thời gian tới câu đầu tiên trên mobile 3G giả lập.

## Tiêu chí xong (dự kiến)

Không file deck nào vượt mốc thống nhất khi lập kế hoạch; bộ lọc hẹp (≤ 5 bài) tải ít hơn hẳn hiện tại; e2e + unit xanh; ID câu không đổi (khóa của Q10).

## Kế hoạch bước 3 · ✅ xong 2026-11-17

Ghi 2026-11-17 ([README.md](README.md#kế-hoạch-tiếp-theo-chốt-2026-11-16)) — làm **sau bước 2** (2.1 thêm ~40 câu vào `n4-dien`/`n5-dien`).

1. **Đo lại** toàn bộ deck (lệnh ở mục Số đo) + tổng tải cho 4 bộ lọc thường dùng: 1 cấp đủ bài; 3 bài (vd N5 bài 3–5); `/luyen-tap/` bài 1–25 và 1–50 đủ 4 phần. Ghi bảng "trước".
2. **Spec** (user duyệt) — đề xuất:

| # | Mục | Đề xuất |
|---|---|---|
| 3-1 | Cách chia | **Theo nhóm bài, 5 bài/file** cho deck từ vựng + Kanji: `vocabulary/quiz/n5-dien-01.json` (bài 1–5), `-06` (6–10)…; N3 14 bài → 3 file (1–5, 6–10, 11–14). Kanji theo cùng trục bài của bộ lọc. Deck nhỏ (bộ thủ, đếm số, số đếm) giữ 1 file |
| 3-2 | Chia thể | `chia-the/quiz/dong-tu.json` (753KB / 73KB gzip) sinh câu trên trình duyệt từ cả bảng → chia theo **sách** (Minna / N3) trước; theo bài nếu vẫn lớn |
| 3-3 | Danh sách file | Hàm thuần `deckChunks(level, kind, from, to)` (`lib/quiz/chunks.ts`) → danh sách URL; trang từng phần và `mixFiles` (trang tổng) cùng dùng → đổi tên file chỉ sửa một chỗ |
| 3-4 | Runner | `setFilter` nhận nhiều URL (đã có cho trang tổng) → trang từng phần truyền danh sách chunk; đếm "/ N câu" (Số câu "Tự nhập") cộng các chunk |
| 3-5 | Gọn dữ liệu (nếu còn lớn) | `href`, `info`, `explain` lặp giữa các câu cùng từ → bảng tra theo ID từ trong file, câu giữ khóa. Chỉ làm khi 3-1 chưa đủ |
| 3-6 | PWA | Cache theo từng chunk (kiểm `@vite-pwa/astro` đang precache hay runtime caching cho `*/quiz/*.json`); chunk đã tải dùng được offline |
| 3-7 | Bất biến | **ID câu không đổi** (khóa `jp:quiz:wrong`); một câu nằm ở đúng một chunk (theo `tags.lesson` nhỏ nhất); "Câu hay sai" (Q10) tải đủ chunk chứa các câu sai |
| 3-8 | Mốc test | Mỗi chunk < 150KB gốc / < 25KB gzip (thay mốc 450KB / 70KB); test: hợp các chunk = deck đầy đủ (cùng tập ID) |

3. **Làm** → unit (chunks, hợp chunk = deck đầy đủ) + e2e (bộ lọc hẹp chỉ tải chunk cần — đếm request bằng `page.route`; trang tổng; Câu hay sai; mạng chậm) + đo "sau" → ghi bảng Số đo.

Tiêu chí xong: như mục trên + bộ lọc ≤ 5 bài tải ≤ 1/3 dung lượng hiện tại.

### Bước 3 — sai khác so với spec / kết quả (2026-11-17)

| # | Spec | Thực tế | Lý do |
|---|---|---|---|
| 3-1 | 5 bài/file, N3 14 bài → 3 file | Minna **5 bài**, **N3 3 bài/file** (N3 14 bài → 5 file; Kanji giáo trình N3 35 bài → 12 file). Cửa sổ cố định theo số bài tuyệt đối: `n5-dien-01` (1–5), `n4-dien-26` (26–30), `n3-dien-04` (4–6). Chunk rỗng vẫn sinh (`items: []`) để trang không phải biết chunk nào có câu | Đo thử: 5 bài N3 điền từ = 153KB / 25,0KB gzip (mỗi bài N3 ~50 từ, gấp đôi Minna) → vượt mốc |
| 3-2 | Chia thể theo sách, theo bài nếu vẫn lớn | **Chỉ theo sách**: `chia-the/quiz/<nhóm>-<minna\|n3>.json`. `dong-tu-minna` 477KB / 46KB | Câu chỉ dùng hàng của sách đang chọn (`rowsOf`) → tách không đổi câu. Không chia theo bài: chia thể Minna luôn tải bài 1 → "đã học tới" (mặc định 50) nên chia bài gần như không giảm tải |
| 3-3 | `deckChunks()` | `lib/quiz/chunks.ts`: `chunkSize` / `chunkStart` / `chunkStarts` / `chunkFile` / `chunkPaths` / `conjPath` / `splitByChunk` / `uniqueById` — endpoint, trang từng phần và `mixFiles` dùng chung | Tên theo việc từng hàm |
| 3-4 | Runner nhận nhiều URL | Có sẵn; thêm bỏ trùng ID khi gộp (`deckItems`, `mixItems`) | Xem 3-7 |
| 3-5 | Gọn dữ liệu nếu còn lớn | **Không làm** | 3-1 đủ: chunk lớn nhất 22KB gzip |
| 3-6 | PWA | **Không có gì để làm** | Dự án chưa cài `@vite-pwa/astro` (không có service worker); khi thêm PWA → runtime cache `*/quiz/*.json` |
| 3-7 | Một câu ở đúng một chunk (bài nhỏ nhất) | Câu gắn **nhiều bài** nằm ở **mọi chunk** chứa một bài của nó; gộp chunk → `uniqueById` | Bộ lọc bài khớp nếu **một** bài khớp (`matches`): chỉ để ở chunk bài nhỏ nhất thì lọc bài 11–12 sẽ mất câu bài [4, 12]. ~40 câu vắt qua 2 chunk |
| 3-8 | Mốc < 150KB / < 25KB mỗi chunk | Đúng như spec; bảng chia theo sách < 550KB / < 55KB. Test (`chunks.test.ts`): hợp chunk = deck đầy đủ; **mọi** khoảng bài lọc ra đúng tập câu như deck đầy đủ; đường dẫn `mixFiles` đều được endpoint sinh | Mốc cả cấp ở `vocab.test.ts` / `kanji.test.ts` bỏ (bộ thủ vẫn giữ) |

**ID câu không đổi** — nội dung câu không đổi, chỉ đổi file chứa. 271 file (từ vựng 75 + Kanji 190 + chia thể 6) thay 48 file (15 + 30 + 3).

Chunk lớn nhất (gốc / gzip): `kanji/quiz/tv-n5-doc-06` 144KB / 22KB (sát mốc gốc), `tv-n5-doc-01` 129KB / 20KB, `vocabulary/quiz/n4-dien-36` 102KB / 17KB.

Tổng tải (gzip) trước → sau:

| Bộ lọc | Trước | Sau |
|---|---|---|
| Từ vựng N5 Nghĩa, cả cấp | 53KB | 54KB (5 chunk) |
| Từ vựng N5 Nghĩa, bài 3–5 | 53KB | **13KB** (25%) |
| Từ vựng N5 Điền từ, bài 3–5 | 64KB | **13KB** (20%) |
| Kanji tv-N5 Cách đọc, bài 3–5 | 82KB | **20KB** (24%) |
| `/luyen-tap/` bài 3–5, đủ 4 phần | ~387KB | **146KB** (38%) — còn 70KB bảng chia Minna + đếm số không theo bài |
| `/luyen-tap/` bài 1–25 / 1–50 | ~387KB / ~650KB | 387KB / 653KB (như cũ) |
| Chia thể động từ Minna / N3 | 73KB | 46KB / 27KB |

Tiêu chí "bộ lọc ≤ 5 bài tải ≤ 1/3": **đạt ở trang từng phần** (20–25%); trang tổng 38% vì bảng chia + đếm số tải nguyên (chia bảng chia theo bài không giúp — xem 3-2).

Test: unit 296 (mới `chunks.test.ts`), e2e 190 (mới: bộ lọc hẹp chỉ tải chunk cần, cache chunk đã tải; sửa tên file ở 6 spec).
