# Quiz cho toàn bộ phần học — phần chung

Thư mục này: **README** (file này) chỉ chứa phần dùng chung mọi task; **mỗi task một file** `qNN-*.md` (spec, quyết định, sai khác khi triển khai, chỉnh sau khi user test). Làm task nào chỉ cần đọc file task đó + phần liên quan ở đây.

Quy trình mỗi task: viết spec vào file task → **user duyệt** → làm → test → `npm run build` pass → commit (branch `feat/quiz`) → ghi "Sai khác so với spec" vào file task → cập nhật [STATUS.md](../STATUS.md) (mục 12). Không sang task sau khi task trước chưa xanh.

## Task

| Task | Nội dung | Trạng thái |
|---|---|---|
| [Q0](README.md#quyết-định) | Chốt D1–D6 | ✅ |
| [Q1](q01-test-infra.md) | Hạ tầng test web | ✅ |
| [Q2](q02-engine.md) | Engine `lib/quiz/` | ✅ |
| [Q3](q03-runner.md) | `QuizRunner` + chuyển quiz đếm số | ✅ |
| [Q4](q04-vocab.md) | Quiz từ vựng | ✅ |
| [Q4b](q04b-cloze-inflected.md) | Điền từ cho từ đích đã biến đổi | ✅ |
| [Q5](q05-kanji.md) | Quiz Kanji + bộ thủ | ✅ |
| [Q6](q06-conjugation.md) | Quiz chia thể | ✅ |
| [Q7](q07-numbers.md) | Quiz số đếm `n-num` | ✅ |
| [Q8](q08-luyen-tap.md) | Trang tổng `/luyen-tap/` | ✅ |
| [Q9](q09-kana-input.md) | Gõ kana | ✅ — ⏸ tạm ẩn 2026-11-16 (`TYPING_ENABLED = false`) |
| [Q10](q10-wrong-answers.md) | Lưu câu sai | ✅ |
| [Q11](q11-conjunctions.md) | Quiz từ nối | ⬜ chờ dữ liệu |
| [Q12](q12-deck-chunking.md) | Chia nhỏ file deck (hiệu năng tải) | ⬜ theo dõi — lập kế hoạch sau khi xong mọi chức năng |

## Kế hoạch tiếp theo (chốt 2026-11-16)

Thứ tự (user chốt): **sửa lỗi → hoàn thiện → chia nhỏ file deck → merge + PR**. Mỗi bước vẫn theo quy trình ở đầu file (spec → duyệt → làm → gate → commit `feat/quiz` → ghi chú). Q11 (từ nối) chờ dữ liệu — nhánh riêng sau khi PR này merge.

| Bước | Việc | Trạng thái |
|---|---|---|
| **1 — Sửa lỗi** | | |
| 1.1 | Pipeline gộp `aliases` bảng chia chỉ theo kana → nối nhầm từ khác nghĩa (掛けます ↔ かけます, 付けます ↔ つけます, 吐きます ↔ つきます). Gộp khi cùng chữ / `same_word`; quét mọi alias khác chữ; pytest; kiểm link "Chia thể" trên thẻ từ vựng | ✅ 2026-11-16 — khóa gộp thêm `identity_kanji` (chữ Hán của cách viết đầu, không phụ thuộc `display`); 714 → 724 hàng, không mất hàng/ID nào (chi tiết mục Lỗi dữ liệu) |
| 1.2 | Rà lỗi cùng loại: từ loại sai trong bảng chia (V2 không tận cùng える/いる, động từ ghép する/来る chưa V3…); nhiễu thực ra là dạng đúng (như `～くありません`) trên mọi câu chia thể + điền từ | ✅ 2026-11-17 — 6 từ loại sai (mục Lỗi dữ liệu); quét 12.612 câu: 0 nhiễu trùng くありません / では / ないです; sửa 1 nhiễu đồng âm (付いて ↔ ついて); bỏ ら抜き khỏi nhiễu (user chốt) |
| **2 — Hoàn thiện** | | |
| 2.1 | ~43 câu thể ghép: sinh **thể phái sinh trên web** (bị động/sai khiến + ます, なければなりません / なくても / なかったら từ thể ない, thân ます / gốc tính từ + そう), không thêm thể vào bảng chia — spec: [q04b mục Kế hoạch bước 2.1](q04b-cloze-inflected.md) | ✅ 2026-11-17 — +40 câu, bỏ qua 66 → 26; lộ thêm 3 lỗi nhóm động từ (借ります, 足ります, 楽しみにしています → V2) |
| 2.2 | ~24 câu không phải chia thể: bộ lọc lộ đáp án bắt oan theo cách đọc (量 / 料理, 医学 / 大学, 西 / にしずみ…) → câu điền từ chỉ xét chữ hiển thị; 3 câu lộ thật (本 / 日本語, 国 / 中国, 山 / 富士山) → viết lại; tách `kanji` nhiều cách viết ra `variants`; mẫu câu / phó từ N3 `～なる` ghi "không hỏi" — spec: [q04b mục Kế hoạch bước 2.2](q04b-cloze-inflected.md) | ⬜ chờ duyệt spec |
| 2.3 | Link "Câu hay sai" trang chủ kèm cấp cho Kanji / Chia thể — trang tự chọn cấp/nhóm khi `?on=sai` ([q10 mục Kế hoạch 2.3a](q10-wrong-answers.md)); 6 biến thể bộ thủ còn thiếu, kiểm font ([q05 mục Kế hoạch 2.3b](q05-kanji.md)) | ⬜ chờ duyệt spec |
| **3 — Q12** | Đo lại deck sau bước 2 (vượt mốc → tạm nâng mốc, làm Q12 ngay); chia 5 bài/file cho từ vựng + Kanji, chia thể theo sách, `deckChunks()` dùng chung cho trang từng phần + `mixFiles`, cache PWA theo chunk, mốc mới < 150KB / < 25KB gzip mỗi chunk, ID câu không đổi — spec: [q12 mục Kế hoạch bước 3](q12-deck-chunking.md) | ⬜ chờ duyệt spec |
| **4 — Merge + PR** | Merge `main` mới nhất vào `feat/quiz`; đủ gate (`npm run build`, e2e, pytest, `BASE_PATH=/jp-study/`); push + PR vào `main` | ⬜ |

## Hiện trạng (khảo sát 2026-11-12)

| Phần | Dữ liệu dùng được cho quiz | Quiz hiện có |
|---|---|---|
| Từ vựng Minna 50 bài + N3 14 bài | `data/vocabulary/*.json`: `kana`, `kanji`, `display`, `han_viet`, `meaning_vi`, `senses[]`, `pos`, `same_word[]`, `variants[]`, `examples[]` (ruby, cụm đích đánh dấu `[[…]]`, `vi`) | Chưa có |
| Kanji 1.085 chữ + 214 bộ thủ | `data/kanji/kanji.json`: `han_viet[]`, `meaning_vi`, `on[]`, `kun[]`, `strokes`, `radical`, `examples[]` (word, kana, reading_type), thứ tự theo bài N5/N4/N3; `radicals.json`: `char`, `name_vi`, `meaning_vi` | Chưa có (kể cả bộ thủ) |
| Chia thể | `data/conjugation.json` (2,8MB): 714 từ × tối đa 20 thể, mỗi thể có `kana`, `ruby`, `rule`, `irregular` | Chưa có |
| Đếm số | `data/counters.json`: 26 trợ số từ × ô đọc (kana, alt, note), số đếm | **Có**: `/dem-so/quiz/` (`lib/counter-quiz.ts` + script trong trang) |
| Từ nối | Chưa có dữ liệu (STATUS mục 8) | — |

Bài học từ quiz đếm số (giữ lại cho mọi quiz):
- Câu hỏi và đáp án nhiễu **sinh lúc build** bằng hàm thuần trong `lib/`, trang chỉ hiển thị.
- Đáp án nhiễu **loại mọi cách trả lời đúng** (kana + alt) → không bao giờ chấm sai một đáp án đúng.
- Script thường, không Preact; phím 1–4 / Enter; điểm chỉ trong phiên.

Hạn chế cần sửa khi mở rộng:
- Dữ liệu nhét thẳng vào HTML (`<script type="application/json">`). Ổn với 366 ô đếm số, **không ổn** với 2.300 từ vựng hay 714 từ × 20 thể → phải tách thành file JSON tĩnh tải lười (đã có mẫu: `pages/chia-the/[group]/[form].json.ts`).
- Logic UI (chọn câu, chấm, phím tắt) viết riêng trong trang → mỗi quiz mới sẽ chép lại. Cần tách thành engine + component dùng chung.
- `web/` **chưa có test tự động**. Node tự bỏ type khi chạy `.ts`, nhưng đã thử: `node --test` **không** nạp được `lib/counter-quiz.ts` vì import `./counters` thiếu đuôi `.ts` (ERR_MODULE_NOT_FOUND). Đã xử lý ở Q1: hook resolve nhỏ (`scripts/register-ts.mjs`, nạp bằng `node --import`) tự thêm `.ts` — không cần sửa import cũ, không thêm thư viện. Phương án dự phòng: `vitest` (devDependency).

## Quyết định

| # | Câu hỏi | Đề xuất |
|---|---|---|
| D1 ✅ | UI quiz: script thường hay Preact island? | **Script thường** (TS module dùng chung) như quiz đếm số, không thêm dependency. Đo bản build 2026-11-12: trang quiz đếm số 17,6KB gzip, trong đó JS ~2,9KB, dữ liệu 9,5KB; Preact sẽ thêm ~6KB gzip + hydrate mà không nhanh hơn khi đổi câu (~10 phần tử). Yếu tố quyết định tốc độ là **dữ liệu**: deck lớn tách file JSON tĩnh theo cấp, tải lười, mục tiêu < 300KB gốc/file. Preact để dành cho SRS nếu sau này cần. |
| D2 ✅ | Hình thức trả lời | **Trắc nghiệm 4 đáp án** cho mọi loại. Thêm **gõ kana** (chuyển romaji → kana) cho chia thể và đọc từ ở giai đoạn sau (Q9). |
| D3 ✅ | Lưu kết quả? | **Giai đoạn 1: chỉ trong phiên** (không key localStorage). Giai đoạn 2 (Q10): lưu "câu hay sai" theo ID, key `jp:quiz:…` đăng ký ở `.claude/rules/web.md`. SRS đầy đủ là dự án riêng. |
| D4 ✅ | Dữ liệu `review: "ai"` (chưa duyệt) có đưa vào quiz không? | **Có**, như quiz đếm số đang làm, vì web không hiển thị trạng thái duyệt. Nếu muốn chặt hơn: chỉ lấy mục đã duyệt cho các trường quyết định đáp án (đọc, nghĩa). |
| D5 ✅ | Vị trí trang | Mỗi phần một trang `…/quiz/` (đặt trong menu con "Luyện tập" như Đếm số) **+** trang tổng `/luyen-tap/` trộn nhiều phần. |
| D6 ✅ | Phạm vi câu hỏi | Học tới bài nào thì quiz tới bài đó. Bộ lọc ghi lên URL (`?cap=n5&tu=1&den=10&loai=doc`), không dùng localStorage; trang từng bài có nút "Luyện tập bài này". Chi tiết ở bảng dưới. |

Bộ lọc từng trang (D6):

| Trang | Bộ lọc |
|---|---|
| Từ vựng | Cấp [N5 = Minna 1–25 · N4 = Minna 26–50 · N3 = sách N3 1–14] → từ bài A đến bài B (mặc định cả cấp) → loại câu |
| Kanji | Cấp → xếp theo [Giáo trình Kanji (`n5_lesson`/`n4_lesson`/`n3_lessons`) · Bài từ vựng (`first_lesson`)] → từ bài – đến bài → loại câu |
| Bộ thủ | Không theo bài: lọc số nét (1–17) hoặc "bộ có trong chữ đã học tới cấp X" |
| Chia thể | "Đã học tới bài B": chỉ thể có `lesson` ≤ B (ます 4, たい 13, て 14, ない 17, 辞書 18, た 19, たら 25, khả năng 27, ý chí 31, mệnh lệnh/cấm 33, ば 35, bị động 37, sai khiến 48; sai khiến bị động `lesson` = null → chỉ hiện khi B = 50) và chỉ từ có bài ≤ B; thêm lọc nhóm từ (V1/V2/V3, い, な) |
| Đếm số | Giữ bộ lọc hiện có (trợ số từ, nhóm âm, cần nhớ/tất cả) |

## Kiến trúc

```
data/*.json ──build──▶ lib/quiz/<phần>.ts (hàm thuần: dữ liệu → QuizItem[])
                            │
                            ▼
              pages/<phần>/quiz/[deck].json.ts  (file JSON tĩnh, tải lười)
                            │
pages/<phần>/quiz.astro ──▶ components/quiz/QuizRunner.astro + lib/quiz/runner.ts (client)
```

**`lib/quiz/types.ts`** — một kiểu câu hỏi chung cho mọi phần:

```ts
interface QuizItem {
  id: string;              // `${loại}:${id dữ liệu}` vd "v-read:mn-05-001" — ID cố định, dùng làm khóa lưu kết quả sau này
  kind: string;            // loại câu hỏi, vd "v-read", "k-hanviet", "c-te"
  prompt: string;          // cú pháp ruby {漢字|かな} hoặc chữ thường
  promptLang: "ja" | "vi";
  hint: string | null;     // dòng phụ: "Thể て", "Bài 5", nghĩa…
  answer: string;
  accepted: string[];      // mọi cách trả lời đúng khác (alt, variants, same_word…)
  pool: string[];          // đáp án nhiễu, ưu tiên "gần đúng" trước; đã loại answer + accepted
  explain: string | null;  // giải thích sau khi trả lời (quy tắc chia, ghi chú biến âm…)
  href: string;            // link sang trang chi tiết, không có "/" đầu
  tags: Record<string, string | number>; // để lọc: level, lesson, group…
}
```

**`lib/quiz/core.ts`** (thuần, có test): chọn 3 nhiễu từ `pool` (ưu tiên gần đúng, trộn ngẫu nhiên), trộn thứ tự đáp án, bốc câu không lặp, lọc theo `tags`. RNG truyền vào được để test cố định kết quả.

**`QuizRunner`** (component + script client): tải deck JSON, bộ lọc, thẻ câu hỏi (furigana qua parser `lib/ruby.ts`), 4 đáp án, phím 1–4/Enter, phản hồi đúng/sai + giải thích + link, điểm, chọn số câu (10 / 20 / không giới hạn), **màn tổng kết** cuối lượt kèm danh sách câu sai và nút "Làm lại câu sai".

**Bất biến bắt buộc** (test kiểm cho mọi deck, mọi câu):
1. `answer` và mọi `accepted` **không** nằm trong `pool`.
2. Mọi `pool` có ≥ 3 mục khác nhau (không đủ → loại câu đó khỏi deck và test báo số câu bị loại).
3. `id` duy nhất trong toàn bộ deck.
4. `prompt` dạng ruby parse được bằng `lib/ruby.ts`.
5. Không câu nào mà chính `prompt` lộ đáp án (vd hỏi cách đọc nhưng prompt đã có furigana của chữ đó).

**Chọn nhiễu (mọi phần):** Nguồn đáp án nhiễu tốt nhất là **lỗi người học hay mắc**; khi không có thì lấy mục **cùng nhóm** (cùng bài, cùng từ loại, cùng số nét) để nhiễu không quá lộ.

## Luồng làm bài

**Luồng làm bài (user yêu cầu 2026-11-12, áp dụng cho mọi trang quiz qua `QuizRunner`):** mở trang chỉ thấy bảng "Tùy chọn luyện tập" + nút **Bắt đầu** (chưa tải deck; nút `disabled` tới khi script sẵn sàng) → bấm Bắt đầu mới tải câu hỏi, hiện khung quiz và cuộn tới thẻ → trong lúc làm bài mọi tùy chọn bị **khóa** (input `disabled`) và khung **thu gọn**: chỉ còn 1 dòng tóm tắt (runner tự đọc từ các dòng lọc: "Nhóm từ: Động từ · Đã học tới: Bài 30 · Thể: Thể て, Thể ない… · Số câu: 20") + **dòng Furigana** (dòng `[data-q-keep]`, vẫn đổi được) → tổng kết: "Làm lại câu sai" / "Lượt mới" giữ tùy chọn, **"Đổi tùy chọn"** mở khóa về bước thiết lập. Bộ lọc rỗng hoặc lỗi tải → mở khóa, bấm Bắt đầu để thử lại. Số câu tự nhập sai → không cho bắt đầu.

## Thẻ câu hỏi (user yêu cầu 2026-11-13, mọi trang quiz)

- Đề cỡ 46px (tiếng Nhật ngắn) / 22px (dài hoặc tiếng Việt); câu hỏi ("Đọc thế nào?", "Chia sang …") chữ đậm màu `ink` để nổi bật.
- Dưới đề chỉ hiện `hint` khi cần để trả lời (câu dịch của câu điền từ, "nghĩa: …" của từ nhiều cách đọc).
- Thông tin phụ (`info`: bài, loại từ, nghĩa ở câu chia thể, số nét, trợ số từ) nằm trong icon ⓘ (màu `primary`) sau nhãn loại câu: máy có chuột **chỉ hiện khi rê chuột** (click chuột không ghim); mobile chạm để bật/tắt; bàn phím: focus/Enter; Esc / bấm ra ngoài / sang câu mới → đóng. Chia thể: `Loại từ - nghĩa` / `Bài N` (2 dòng). Màn tổng kết vẫn ghi đủ (`hint · info`).

- Khi làm bài, khung tùy chọn chỉ còn **1 dòng tóm tắt** (bỏ dòng "Muốn đổi…" và dòng Furigana); Furigana đổi bằng chip **"✓ Furigana"** ở hàng đầu thẻ (bật = nền xanh nhạt + ✓; nút chỉ có chữ 字 bị user thấy khó hiểu) — trên mobile thấy đủ đề + 4 đáp án không cần cuộn. Câu hỏi 18px.
- Thanh tiến độ mảnh ở mép trên thẻ (số câu đã trả lời / số câu của lượt). Nút "Câu tiếp" ẩn (giữ chỗ, không nhảy bố cục) tới khi trả lời.
- "Kết thúc lượt" khi đã làm ≥ 1 câu → hỏi lại ngay trong thẻ ("Đã làm N câu. [Làm tiếp] [Kết thúc]", focus "Làm tiếp", Esc = làm tiếp); chưa làm câu nào → kết thúc luôn.
- Đề tiếng Nhật ngắn (≤ 12 ký tự) không xuống dòng giữa từ: `nowrap` + tự thu chữ cho vừa bề ngang (tối thiểu 20px); đề dài vẫn xuống dòng ở 22px.
- Dòng "Phím 1–4 để chọn" chỉ hiện trên máy có chuột (`hover: hover` + `pointer: fine`), không theo bề ngang.

## Checklist

Đã tự động hóa bằng Playwright (`web/e2e/`, mẫu: `counter-quiz.spec.ts`) trừ mục ghi "kiểm tay". Mỗi trang quiz mới cần một file spec.

- [ ] Desktop + mobile (375px): không cuộn ngang, nút đáp án đủ lớn, tiếng Nhật dùng Noto Sans JP.
- [ ] Phím 1–4 chọn, Enter sang câu, không bắt phím khi đang gõ trong ô lọc.
- [ ] Mở trang chỉ có bảng tùy chọn + "Bắt đầu" (chưa tải deck); bấm Bắt đầu → khung quiz, tùy chọn khóa trừ Furigana; tổng kết → "Đổi tùy chọn" mở khóa; bộ lọc không còn câu → Bắt đầu báo rỗng, tùy chọn vẫn mở.
- [ ] Trả lời đúng/sai → màu theo token (đỏ chỉ cho sai), hiện giải thích + link chi tiết đúng.
- [ ] Hết lượt → tổng kết, "Làm lại câu sai" chỉ chứa câu sai.
- [ ] Không hiện thông tin biên tập (`ai-draft`, `review`).
- [ ] `npm run build` sạch, link nội bộ có `BASE_URL` (thử với `BASE_PATH=/jp-study/`).
- [ ] Mạng chậm (DevTools throttling): có trạng thái đang tải deck — e2e từ Q4 (deck tải lười; giả lập bằng `page.route` trì hoãn file JSON).
- [ ] Kiểm tay: nhìn ảnh chụp desktop + mobile, chất lượng đáp án nhiễu (mẫu 20 câu mỗi loại).

## Rủi ro

| Rủi ro | Cách xử lý |
|---|---|
| Chấm sai đáp án đúng (đồng nghĩa, nhiều cách đọc, thể trùng kana) | Bất biến 1 + `accepted` đầy đủ + test riêng cho từng trường hợp đã biết |
| Nhiễu quá dễ đoán (khác hẳn độ dài/kiểu chữ) | Ưu tiên nhiễu cùng nhóm, cùng độ dài; kiểm tay mẫu 20 câu mỗi loại |
| Deck JSON quá nặng | Tách theo cấp/nhóm, chỉ giữ trường cần cho quiz; mục tiêu < 300KB mỗi file |
| Dữ liệu chưa duyệt (counters, chia thể) làm đáp án sai | Quyết định D4; duyệt 7b trước khi quảng bá quiz |

## Theo dõi dung lượng deck

Task nào làm deck lớn thêm → đo lại và ghi vào bảng số đo ở [q12-deck-chunking.md](q12-deck-chunking.md) (lệnh đo có trong file). Mốc hiện tại: deck từ vựng **tạm** < 500KB gốc / < 75KB gzip (2026-11-17, n5-dien 451KB — bước 3 thay bằng mốc mỗi chunk); trước đó < 450KB / < 70KB; `n5-dien` đã sát mốc gốc (440KB), `n3-dien` sát mốc gzip (~69KB), `n5-dien` 445KB (2026-11-16). Chia nhỏ file (chunk) lên kế hoạch sau khi xong mọi chức năng quiz (Q12).

## Lỗi dữ liệu phát hiện qua quiz (sửa ở pipeline, không sửa `data/`)

- ~~`mn-41-039` この間: kana sai `このあいだい`~~ — đã sửa 2026-11-16 (`_decisions/17-quiz-kana.txt`).
- ~~Bộ thủ: tên dính số, thiếu biến thể~~ — đã sửa 2026-11-15 (`enrichment/kanji/radicals/overrides.txt`; 41/214 bộ có `variants`). Còn thiếu nhỏ: 言→訁, 金→釒, 足→𧾷, 竹→⺮, 乙→乚, 小→⺌ — chi tiết [q05-kanji.md](q05-kanji.md).
- ~~`conjugation.json`: `aliases` gộp theo kana nối nhầm từ khác nghĩa~~ — **đã sửa 2026-11-16** (bước 1.1). Nguyên nhân: khóa gộp `(loại, kana gốc, kanji gốc)` chỉ có kanji khi `display = kanji` → hai từ hiển thị kana khác chữ trùng khóa. Thêm `identity_kanji()` (`transform/conjugation.py`) vào khóa. Quét 105 alias: 68 cặp "khác cách ghi" nhưng phần lớn là cùng từ (起きます / 起きる, 大変 / 大変な — vẫn gộp); tách 10 hàng: 3 gộp nhầm thật (mn-22-004 掛けます đeo kính ≠ mn-07-009 かけます gọi điện, mn-34-005 付けます chấm xì dầu ≠ mn-14-001 点けます bật, mn-38-009 吐きます nói dối ≠ mn-29-003 つきます đèn sáng) + 7 cặp một bên không có kanji (mn-27-005 できます "được xây dựng" ≠ mn-18-001 "có thể"; N3 không ghi kanji: n3-154 ふく, n3-224 むだ, n3-428 うまい, n3-445 すごい, n3-446 ひどい, n3-609 まとめる). Hàng cũ giữ nguyên ID/nội dung (khóa localStorage `c-to:` không đổi); thẻ từ vựng link "Chia thể" sang trang riêng. Quiz chia thể: từ có khả năng = bị động 157 → 160. Web vẫn tra `same_word` trước `aliases` (phòng hờ).
- **Q4b — câu ví dụ có từ đích đã chia nhưng chưa hỏi được** (đo 2026-11-16: **66 câu** theo `vocab.test.ts`; chi tiết + phân nhóm ở [q04b-cloze-inflected.md](q04b-cloze-inflected.md) mục Bổ sung / Bổ sung 2):
  - ~~~60 câu: động từ N3 thiếu trong `conjugation.json`~~ — chẩn đoán sai: các từ này có trong bảng chia dưới dạng `aliases` của hàng Minna; lỗi ở web (không tra `aliases`), **đã sửa 2026-11-16** (+54 câu N3).
  - ~~26 câu: câu ví dụ viết khác cách viết của từ vựng (点けて / つけます…)~~ — **đã sửa 2026-11-16**: web khớp theo cách đọc + viết dạng sai theo chữ của câu; kèm sửa từ loại 持って来ます / 連れて来ます / 帰って来ます V1 → V3 (`_decisions/15-conjugation-pos.txt`, bảng chia trước đó sai trên cả trang `/chia-the/`) và câu mn-08-016 `[[悪くないです]]`.
  - Bộ "chia sai" (Q6) từng sinh `～くありません(でした)` làm nhiễu cho tính từ い — là dạng đúng; đã sửa 2026-11-16.
- **Rà soát bước 1.2 (2026-11-17):**
  - Từ loại sai → bảng chia sinh dạng sai trên `/chia-the/`: mn-47-007 厳しい An → **Ai** (trước hiện 厳しいだ / 厳しいな; `_decisions/15-conjugation-pos.txt`); N3 do JMdict lấy nhầm tính từ な: n3-068 かび → N, n3-287 発明 → N, n3-462 かなり → Adv, n3-471 たいてい → Adv, n3-669 直接 → Adv (bảng chia 724 → 719 hàng; 5 hàng N3 sai bị bỏ cùng ID quiz `c-to:` của chúng). Sửa N3 ghi ở file mới `enrichment/n3/vocab-fixes-ai.txt` (`# by: ai`, đề xuất chưa duyệt — duyệt xong chuyển dòng sang `vocab-fixes.txt`); pipeline giờ đọc cả hai file, mỗi dòng sửa mang người duyệt của file chứa nó. Giữ tính từ な: 突然, 感心, いたずら, ぎりぎり, 反対 (đều có dạng な hợp lệ). 13 động từ V1 đuôi -iru/-eru đều là ngoại lệ nhóm I thật.
  - Quét nhiễu 12.612 câu (chia thể 2 sách + điền từ đã chia) với dạng đúng thay thế (くありません, ではありません, じゃないです, ～ないです / なかったです): **0**. Nhiễu đồng âm cùng thể viết kana: 1 câu (mn-29-010-e1 付いて ↔ ついて của つきます) → bỏ nhiễu đọc giống đáp án.
  - **Bước 2.1 (2026-11-17):** 借ります, 足ります V1 → V2 (bảng chia sinh かる / たらない), 楽しみにしています V1 → V2 (thể từ điển たのしみにしてう) — lần rà 1.2 sót vì chỉ quét V1 đuôi -iru/-eru; đã rà tay toàn bộ V1 Minna thân ます hàng i.
  - **ら抜き** (食べれる, 来れる, 見れる) không còn làm nhiễu (user chốt 2026-11-17: văn nói phổ biến, không chấm sai); so cả chữ hiển thị ({来|く}れる hiện 来れる). `～すれる` (する) vẫn là nhiễu — dạng sai thật.
  - ~43 câu: thể ghép chưa có trong bảng chia — bị động + ました (bài 37: 褒められました, 招待されました), なければなりません / なくても (bài 17), なかったら (bài 25), sai khiến + ます (bài 48); thân ます / gốc tính từ trước そう (bài 43: 切れ, 落ち, 美味, 優し). Hướng: thêm thể ghép vào bảng chia, hoặc pipeline đánh dấu cụm `[[…]]` chỉ phần thể có sẵn.
  - ~24 câu: không phải chia thể (danh từ 本, 国, 山…; phó từ N3 dạng `ずいぶん～なる`) — trường `kanji` chứa nhiều cách viết (mn-09-033 `夫 /主人`, mn-09-035 `妻/家内`, mn-24-009 `おじいさん／ おじいちゃん`), danh từ hóa (迎え, 切れ), mẫu câu (mn-01-030 こちらは～さんです).
  - Sửa xong → chạy `vocab.test.ts`: mốc "số câu bỏ qua" phải hạ theo.
