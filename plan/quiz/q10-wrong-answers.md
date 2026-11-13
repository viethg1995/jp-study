# Q10 — Lưu câu sai

> Phần chung (quyết định D1–D6, kiến trúc, bất biến, luồng làm bài, checklist): [README.md](README.md). File này chỉ chứa riêng task Q10.

Trạng thái: ✅ xong 2026-11-13 — spec duyệt cùng ngày (đúng **3** lần liên tiếp mới coi là đã nhớ; chế độ ôn trên cả 6 trang; chưa thêm lối vào trang chủ)

## Bối cảnh (khảo sát 2026-11-13)

- Hiện tại điểm chỉ trong phiên: tổng kết có "Làm lại câu sai (n)", tải lại trang là mất.
- 6 trang quiz dùng chung `QuizRunner` + `lib/quiz/runner.ts` (mọi câu trả lời đi qua `choose()`): Từ vựng (`v-*`), Kanji (`k-*`, `r-of`), Bộ thủ (`r-name`, `r-char`), Chia thể (`c-*`), Đếm số (`n-ctr`, `n-num`), Luyện tập (trộn `v-`/`k-`/`c-`/`n-`).
- ID câu cố định, **cùng ID trên trang từng phần và trang tổng** (Q8 dùng lại deck) → một câu sai ở trang Từ vựng cũng là câu sai ở trang Luyện tập.
- `lib/storage.ts` mới có 1 key (`jp:ui:sidebar`), đọc/ghi chuỗi, bọc try/catch (bị chặn → bỏ qua).

## Spec

| # | Mục | Đề xuất |
|---|---|---|
| Q10-1 | Lưu gì | **Chỉ ID + thống kê**, không lưu nội dung câu (luôn hiện dữ liệu mới nhất, dữ liệu sửa ở pipeline tự cập nhật). Một key **`jp:quiz:wrong`** cho mọi trang: `{"v":1,"items":{"<id câu>":{"w":3,"s":0,"t":1763000000}}}` — `w` số lần sai, `s` số lần đúng liên tiếp kể từ lần sai gần nhất, `t` thời điểm cập nhật (giây). |
| Q10-2 | Khi nào ghi | Mỗi lần trả lời (kể cả "Làm lại câu sai" và chế độ ôn): **sai** → thêm/`w+1`, `s=0`; **đúng** một câu đang có trong danh sách → `s+1`; **đúng 3 lần liên tiếp → xóa** khỏi danh sách (đã nhớ — user chốt 3, spec đề xuất 2). Câu chưa từng sai mà đúng → không ghi gì. |
| Q10-3 | Giới hạn | Tối đa **1.000 câu**; vượt → bỏ câu `t` cũ nhất. ~40 byte/câu → ≤ 40KB. Dữ liệu hỏng / sai phiên bản → coi như rỗng (không lỗi trang). |
| Q10-4 | Chế độ ôn trên mỗi trang quiz | Thêm dòng **"Câu hỏi: Tất cả · Câu hay sai (N)"** (Segmented, chọn một) vào bảng tùy chọn của cả 6 trang. N = số câu đã lưu **thuộc loại câu của trang** (Từ vựng đếm `v-*`…) — đếm được trước khi tải deck. Chọn "Câu hay sai" → **áp thêm lên bộ lọc hiện có** (cấp, bài, loại câu…): chỉ hỏi câu có ID trong danh sách. Bộ lọc còn 0 câu → thông báo "Không có câu sai nào trong bộ lọc này" (như bộ lọc rỗng hiện tại). N = 0 → dòng vẫn hiện, nút "Câu hay sai (0)" bị khóa. URL: `?on=sai` (thống nhất D6, link được từ chỗ khác). |
| Q10-5 | Thứ tự trong chế độ ôn | Câu sai nhiều (`w` lớn) trước, rồi câu sai gần đây; vẫn trộn ngẫu nhiên trong cùng mức để không thuộc thứ tự. Trộn đều theo loại/phần (balanceKinds/Parts) vẫn áp dụng. |
| Q10-6 | Tổng kết lượt | Thêm 1 dòng: "Đã lưu **N** câu sai để ôn lại · Ôn câu hay sai →" (link `?on=sai` giữ bộ lọc hiện tại). Đang ở chế độ ôn: "Đã nhớ **K** câu (đúng 3 lần liên tiếp)". |
| Q10-7 | Xóa | Trong dòng "Câu hỏi": nút nhỏ **"Xóa"** (hỏi xác nhận) → xóa câu sai **của loại câu trang này** (trang Từ vựng chỉ xóa `v-*`); trang Luyện tập xóa hết. |
| Q10-8 | localStorage bị chặn | Mọi thao tác qua `storage.ts` (thêm `readJson`/`writeJson`, bọc try/catch). Bị chặn → dòng "Câu hỏi" ẩn, quiz chạy như cũ. Đăng ký key `jp:quiz:wrong` ở bảng `.claude/rules/web.md` (gate `check:storage`). |
| Q10-9 | Code | Hàm thuần `lib/quiz/wrong.ts` (đọc/ghi cấu trúc, cập nhật theo câu trả lời, cắt 1.000, đếm theo loại, sắp thứ tự ôn) — có unit test, không đụng DOM; runner gọi qua `storage.ts`. Phạm vi loại câu của trang: lấy từ `kindLabels` (đã có); trang Đếm số (một loại câu/lần) truyền thêm prop. |

Ngoài phạm vi: lịch ôn theo khoảng cách (SRS), đồng bộ giữa thiết bị, thống kê theo thời gian — dự án riêng (D3).

## Test

- Unit `wrong.test.ts`: sai → thêm; đúng 1 lần → còn, `s=1`; đúng 3 lần liên tiếp → xóa; sai xen giữa → `s` về 0; cắt 1.000 bỏ câu cũ nhất; JSON hỏng / `v` khác → rỗng; đếm theo loại (`v-` không đếm `k-`); thứ tự ôn `w` giảm dần.
- E2E `wrong-answers.spec.ts`: trả lời sai 2 câu ở Từ vựng → tải lại trang → "Câu hay sai (2)"; chọn → lượt chỉ có 2 câu đó; đúng 3 lần liên tiếp → còn 0; câu sai ở Từ vựng hiện ở trang Luyện tập (cùng ID); trang Kanji không đếm câu từ vựng; `?on=sai` từ URL; Xóa (xác nhận) → 0; localStorage bị chặn (init script ném lỗi) → không lỗi JS, dòng "Câu hỏi" ẩn, quiz chạy.
- `check:storage` xanh.

## Tiêu chí xong

Cả 6 trang có chế độ "Câu hay sai", build + unit + e2e + gate xanh, chế độ riêng tư không lỗi.

## Quyết định của user (2026-11-13)

1. Q10-2: đúng **3** lần liên tiếp mới coi là đã nhớ (không phải 2).
2. Q10-4: chế độ ôn trên cả 6 trang, áp lên bộ lọc của trang.
3. Chưa thêm lối vào ở trang chủ.

## Sai khác so với spec

| # | Spec | Thực tế | Lý do / ghi chú |
|---|---|---|---|
| 1 | Q10-7: trang Luyện tập "Xóa" xóa hết | Xóa theo **loại câu trang Luyện tập hỏi được** (khóa `MIX_KIND_LABELS`: Từ vựng Đọc/Nghĩa/Điền từ, Kanji HV/Nghĩa/Cách đọc, Chia thể, Đếm số) | Thống nhất một quy tắc cho mọi trang: phạm vi = loại câu của trang (`wrongKinds`, mặc định khóa `kindLabels`). Câu sai loại "Từ", "Hán-Việt" từ vựng, bộ thủ… chỉ xóa ở trang của nó |
| 2 | Q10-5: lượt ôn | Lượt ôn = tối đa "Số câu" câu đứng đầu (sai nhiều / gần đây); **ít câu hơn số câu/lượt → lượt ngắn lại**, không hỏi vòng lại | Chế độ thường vẫn hỏi vòng lại khi deck nhỏ hơn lượt (như cũ) |
| 3 | — | Thêm key `jp:probe` (ghi rồi xóa ngay) để biết localStorage dùng được không → ẩn dòng "Câu hỏi" khi bị chặn | Chặn hẳn (setItem ném lỗi) thì không phát hiện được bằng đọc |
| 4 | — | "Câu hỏi: Tất cả" (mặc định) **không** ghi vào dòng tóm tắt khi làm bài; "Câu hay sai" thì có | Tóm tắt các trang không dài thêm |
| 5 | — | `?on=sai` mà trang không còn câu sai → tự về "Tất cả" và bỏ `on=sai` khỏi URL (cả khi về thiết lập sau lượt ôn cuối) | — |
| 6 | Xác nhận khi Xóa | `confirm()` của trình duyệt | Đủ cho thao tác hiếm; không thêm hộp thoại riêng |

Kiểm tra: unit 204 (thêm `wrong.test.ts` 10 test), e2e 162 (thêm `wrong-answers.spec.ts` 7 test × 2 màn hình: lưu → tải lại → ôn đúng các câu đó; link "Ôn câu hay sai →"; đúng 3 lần → xóa + URL bỏ `on=sai`; dùng chung giữa Từ vựng / Luyện tập, không lẫn sang Kanji; Xóa theo loại câu; localStorage bị chặn; 6 trang có dòng "Câu hỏi"), `check:storage` xanh (3 key).
