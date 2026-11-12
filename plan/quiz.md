# Kế hoạch: Quiz cho toàn bộ phần học

Trạng thái: **đã chốt D1–D6** (2026-11-12, theo đề xuất). Mỗi task ở §5 làm tuần tự, mỗi task một commit trên branch `feat/quiz`, xong thì cập nhật [STATUS.md](STATUS.md) (mục 12).

## 1. Hiện trạng (khảo sát 2026-11-12)

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

## 2. Quyết định (đã chốt 2026-11-12)

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

## 3. Kiến trúc đề xuất

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

## 4. Loại câu hỏi theo từng phần

Nguồn đáp án nhiễu tốt nhất là **lỗi người học hay mắc**; khi không có thì lấy mục **cùng nhóm** (cùng bài, cùng từ loại, cùng số nét) để nhiễu không quá lộ.

### Từ vựng (`/vocabulary/quiz/`)
| Loại | Hỏi → chọn | Nhiễu | Lưu ý loại trừ |
|---|---|---|---|
| `v-read` | Từ có kanji (không furigana) → cách đọc | Đọc của từ khác cùng bài/cùng độ dài; biến đổi dài/ngắn (おばさん/おばあさん), っ, đục | Chỉ từ có `kanji`; `accepted` gồm `variants` |
| `v-mean` | Từ tiếng Nhật → nghĩa VI | Nghĩa của từ cùng từ loại, cùng bài hoặc bài lân cận | Loại nhiễu có nghĩa trùng (từ đồng nghĩa, `same_word`) |
| `v-word` | Nghĩa VI → từ tiếng Nhật | Từ cùng từ loại | Như trên, hướng ngược |
| `v-hv` | Từ Hán → âm Hán-Việt | Âm Hán-Việt của từ khác có chung 1 chữ | Chỉ từ có `han_viet` |
| `v-cloze` | Câu ví dụ, cụm `[[…]]` thành chỗ trống → điền từ | Từ cùng từ loại cùng bài | Dùng `vi` làm gợi ý; giai đoạn sau vì cần chọn nhiễu cẩn thận |

### Kanji + bộ thủ (`/kanji/quiz/`)
| Loại | Hỏi → chọn | Nhiễu |
|---|---|---|
| `k-hv` | Chữ → âm Hán-Việt | Âm của chữ giống hình/cùng bộ thủ, cùng cấp |
| `k-mean` | Chữ → nghĩa VI | Nghĩa của chữ cùng bộ/cùng bài |
| `k-char` | Hán-Việt + nghĩa → chữ | Chữ cùng bộ thủ hoặc cùng số nét (dễ nhầm hình) |
| `k-read` | Từ ví dụ → cách đọc (đánh dấu On/Kun) | Âm On ↔ Kun của chính chữ đó, âm của chữ cùng âm |
| `r-name` | Bộ thủ → tên/nghĩa | Bộ cùng số nét |
| `r-of` | Chữ → bộ thủ của nó | Thành phần khác trong chữ (`components` KanjiVG) + bộ cùng số nét |

### Chia thể (`/chia-the/quiz/`)
| Loại | Hỏi → chọn | Nhiễu |
|---|---|---|
| `c-to` | Từ (thể ます/từ điển) + tên thể → dạng đã chia | (a) cùng thể nhưng chia theo **nhóm sai** (V1 chia như V2: かきて), (b) **biến âm て/た sai** (かいて ↔ かって ↔ かきて), (c) thể khác của chính từ đó |
| `c-which` | Dạng đã chia → đây là thể nào | Thể gần nghĩa (可能 ↔ 受身 ở V2: たべられる) — **phải loại** mọi thể có cùng kana |
| `c-group` | Động từ → nhóm I/II/III | Hai nhóm còn lại (câu dễ, cho người mới) |

Đáp án nhiễu kiểu (a)(b) sinh trong `lib/quiz/conjugation.ts` bằng quy tắc lỗi hay gặp (giống `counter-quiz.ts`), rồi **loại mọi kana có trong `forms` của từ** (vì vd thể khả năng và bị động trùng nhau ở V2). Ngoại lệ (`irregular: true`) luôn hiện `explain`.

### Đếm số (`/dem-so/quiz/` — chuyển sang engine chung)
| Loại | Hỏi → chọn |
|---|---|
| `n-ctr` | Số + trợ số từ → cách đọc (**giữ nguyên logic hiện tại**) |
| `n-num` | Số (vd 3.600, 0,5, 1/3) → cách đọc |
| `n-pick` | Đồ vật / tình huống → trợ số từ phù hợp (本 hay 枚 hay 台) — làm sau, cần dữ liệu "dùng cho cái gì" |

### Trang tổng `/luyen-tap/`
Chọn nhiều phần + loại câu + khoảng bài → trộn deck. Thêm vào `lib/nav.ts` và thẻ ở trang chủ.

### Q4 — quyết định (chốt 2026-11-12)

| # | Nội dung | Chốt |
|---|---|---|
| Q4-1 | Chia file câu hỏi | **Theo cấp × loại câu**: `/vocabulary/quiz/<n5\|n4\|n3>-<doc\|nghia\|tu\|hv\|dien>.json` (15 file). Đo N5: 196–335KB gốc, 26–52KB gzip mỗi file (1 file/cấp sẽ là 1MB / 175KB gzip). |
| Q4-2 | Điền chỗ trống (`v-cloze`) | **Làm ngay phần từ đích giữ nguyên dạng** (1.731/2.257 câu ví dụ: danh từ, tính từ な, trạng từ…); **hoãn** 526 câu từ đích đã biến đổi (chủ yếu động từ) sang sau Q6 — khi đó chia luôn đáp án nhiễu. |
| Q4-3 | Nhiễu câu hỏi đọc (`v-read`) | **4 lựa chọn = 1 đúng + 3 nhiễu máy sinh** (trường âm, っ, dấu đục, âm nhỏ ゃゅょ) — kiểu bẫy JLPT 漢字読み. Chỉ khi máy sinh không đủ 3 dạng hợp lệ mới bù bằng cách đọc của từ thật. Dạng máy sinh trùng một cách đọc đúng của chính chữ đó bị loại. |

**Sai khác so với spec Q4 (ghi nhận khi triển khai 2026-11-12):**

| # | Spec | Thực tế | Lý do / xử lý |
|---|---|---|---|
| 1 | Câu đọc: 3 nhiễu máy sinh (Q4-3) | 942/1.604 câu (59%) đủ 3 nhiễu máy sinh; còn lại máy sinh 0–2 dạng, bù bằng cách đọc của từ thật | Từ ngắn / toàn âm n, m, r, y, w (なに, いま, でんわ) ít biến thể. Đã bỏ dạng vô lý (よせいる, たべまっす, いじょうでいす) — chấp nhận tỉ lệ thấp hơn. Test giữ mốc ≥ 900 để bắt hồi quy. Muốn tăng: thêm loại lỗi mới trong `kana.ts` (vd bỏ ん giữa từ) |
| 2 | File câu hỏi < 350KB gốc | 200–403KB gốc (5 file > 350KB: n5-nghia, n5-tu, n5-dien, n4-nghia, n4-tu); gzip ≤ 47KB | Dung lượng thực tải về khớp ước tính (26–52KB gzip); phần vượt chỉ tốn thêm vài ms parse JSON. Giữ định dạng `Deck` đơn giản. Test: < 450KB gốc, < 60KB gzip. Cách giảm nếu cần: đưa `question`/`kind` lên cấp Deck (~-8%) hoặc bảng chuỗi dùng chung (~-55%) |
| 3 | Điền từ: mọi từ đích giữ nguyên dạng | Bỏ thêm danh từ riêng (`PN`) | Câu dịch giữ nguyên tên → lộ đáp án (新神戸 / "ga Shin-Kobe"), phát hiện khi soát ảnh chụp |
| 4 | (spec không nêu) | Câu điền từ có thể có nhiều đáp án hợp ngữ pháp ("＿は学生です": わたし / あなた) | Câu dịch tiếng Việt luôn hiện làm gợi ý → đáp án xác định theo nghĩa. **Cần user kiểm tay** vài lượt loại "Điền từ"; nếu gây nhầm thì thêm luật loại nhiễu cùng nhóm đại từ / cùng nghĩa ngữ cảnh |

**Chỉnh sau khi user test tay Q4 (2026-11-12):**
- Loại câu chọn nhiều trước đây trông như nút chọn một và tỉ lệ trộn lệch theo số câu mỗi loại (N5: Nghĩa 844, Đọc 557) → nút bo tròn nền nhạt + ✓, dòng "Chọn nhiều để trộn"; nhãn loại câu ở góc thẻ; **trộn đều**: `createQueue(…, groupOf)` bốc lần lượt từng loại (20 câu / 5 loại = 4 câu mỗi loại; loại hết câu thì nghỉ đến vòng mới).
- Bộ lọc đặt trong khung nền "Tùy chọn luyện tập", nhãn thẳng cột, dòng ngăn cách (áp dụng cả quiz đếm số).
- Số câu thêm **"Tự nhập"** (1–999; số sai báo lỗi, giữ lượt đang làm; gõ số trong ô không bị coi là chọn đáp án).
- Test: unit +5 (trộn đều), e2e +4 (trộn đều 4/4/4/4/4, ✓, tự nhập, nhãn loại) → unit 99, e2e 26 × 2 màn hình.

## 5. Task tuần tự

Mỗi task: làm → test → `npm run build` pass → commit → cập nhật STATUS. Không sang task sau khi task trước chưa xanh.

| Task | Nội dung | Test / tiêu chí xong |
|---|---|---|
| **Q0** ✅ | User chốt D1–D6; sửa doc này theo quyết định | Xong 2026-11-12 |
| **Q1** ✅ | **Hạ tầng test web**: `npm run test` = `node --import ./scripts/register-ts.mjs --test "src/**/*.test.ts"` (hook resolve thêm đuôi `.ts`, không thêm thư viện; module trong `lib/quiz/` chỉ được `import type` từ `content.config`/`astro:*`); file test đầu cho `counter-quiz.ts` kiểm 5 bất biến ở §3 trên dữ liệu thật `data/counters.json`; thêm `test` vào `npm run build` | `npm run test` xanh; cố ý sửa sai `distractors()` thì test đỏ — **Xong 2026-11-12**: `scripts/register-ts.mjs` (`registerHooks`), `src/test/data.ts`, `lib/counter-quiz.test.ts` 7 test; thử làm hỏng `distractors()` → 3 test đỏ |
| **Q2** ✅ | **Engine** `lib/quiz/types.ts` + `core.ts` (chọn nhiễu, trộn, bốc câu không lặp, lọc tag, RNG có seed) + hàm kiểm bất biến dùng chung `assertDeck()` | Unit test core: phân phối không lặp, trộn đủ, lọc đúng; `assertDeck` bắt được deck sai — **Xong 2026-11-12**: `lib/quiz/` gồm `types.ts`, `random.ts` (mulberry32), `core.ts` (`makeOptions` 3 trong 6 nhiễu đầu, `normalize` katakana = hiragana, `isCorrect`, `filterItems`, `createQueue`), `params.ts` (`cap`/`tu`/`den`/`loai`/`nhom`), `validate.ts` (`checkDeck` 5 quy tắc, `finalizeDeck`); `counter-quiz.ts` thêm `toQuizItems()` (366 câu qua `checkDeck` 0 lỗi). 40 test mới (tổng 47); thử làm hỏng quy tắc 1 và chống lặp → test đỏ |
| **Q3** ✅ | **`QuizRunner`** (component + `lib/quiz/runner.ts`): tải deck JSON, bộ lọc, phím tắt, phản hồi, số câu/lượt, màn tổng kết + làm lại câu sai. **Chuyển `/dem-so/quiz/` sang engine** (deck `n-ctr`), hành vi không đổi | Unit test test-được phần thuần của runner (trạng thái lượt, điểm); kiểm tay theo checklist §6 trên desktop + mobile; số câu "Cần nhớ" vẫn 149, "Tất cả" vẫn 366 — **Xong 2026-11-12**: `components/quiz/QuizRunner.astro` + `lib/quiz/runner.ts` (DOM) + `lib/quiz/session.ts` (trạng thái lượt, 7 test); `/dem-so/quiz/` dùng runner, bộ lọc lên URL (`tro`, `nhom`, `o`). Sửa lỗi cũ: màu đúng/sai của nút không bao giờ hiện (style scoped Astro không áp vào nút do script tạo) → class Tailwind `data-[state=…]:`. Kiểm bằng Chromium headless 23/23 mục; sau đó thành test chính thức `web/e2e/counter-quiz.spec.ts` (Playwright 1.64.1, 11 test × desktop/mobile = 22, lặp 3 lần 66/66, cả `BASE_PATH=/jp-study/`) (desktop, mobile 375px, URL, làm lại câu sai, kết thúc lượt, bộ lọc rỗng, URL rác) |
| **Q4** ✅ | **Quiz từ vựng** `/vocabulary/quiz/` | **Xong 2026-11-12** — `lib/quiz/kana.ts` (lỗi đọc máy sinh: trường âm, っ, âm nhỏ, đục; giữ đuôi ます/です), `lib/quiz/vocab.ts` (5 loại: đọc, nghĩa, từ, Hán-Việt, điền từ; gộp từ lặp → tag `lesson` nhiều giá trị; "Cũng đúng" theo tiêu chí chặt, loại nhiễu theo tiêu chí rộng), 15 file `/vocabulary/quiz/<cấp>-<loại>.json` (200–400KB gốc, ≤ 47KB gzip), trang lọc cấp / khoảng bài / loại câu (URL `cap`, `tu`, `den`, `loai`), nút "Luyện tập bài này", menu "Luyện tập". Đọc: 942/1.604 câu đủ 3 nhiễu máy sinh, còn lại bù cách đọc từ thật. Điền từ: bỏ danh từ riêng (câu dịch lộ tên). Test: unit 94 (15 deck × checkDeck, kích thước, trường hợp đã biết), e2e `vocab-quiz.spec.ts` 11 test × 2 màn hình; mẫu 100 câu đã soát |
| Q4b | Điền từ cho từ đích **đã biến đổi** (526 câu, chủ yếu động từ) | Sau Q6: chia đáp án nhiễu cùng thể với từ đích (行きました → 食べました, 見ました) |
| **Q5** | **Quiz Kanji + bộ thủ**: `lib/quiz/kanji.ts` (`k-hv`, `k-mean`, `k-char`, `k-read`, `r-name`, `r-of`), endpoint theo cấp, trang `/kanji/quiz/`; link từ `/kanji/n5|n4|n3` và `/kanji/bo-thu/` | Test bất biến; chữ nhiều âm Hán-Việt → mọi âm vào `accepted`; quốc tự (込, 匂) không vào `k-hv`; kiểm tay |
| **Q6** | **Quiz chia thể**: `lib/quiz/conjugation.ts` (quy tắc sinh lỗi nhóm/biến âm), `c-to`, `c-which`, `c-group`; endpoint theo nhóm; trang `/chia-the/quiz/` lọc nhóm từ + thể + bài; mục 6 trong STATUS hết TODO | Test bất biến; test bảng lỗi: 書きます→て có nhiễu かきて/かって, không có かいて; V2 たべられる ở `c-which` nhận cả 可能 và 受身; ngoại lệ (いきます→いって, ある, いい) đúng; kiểm tay |
| **Q7** | **Quiz số đếm** `n-num` trên `/dem-so/quiz/` (tab hoặc loại câu) | Test bất biến; số 4/7/9 nhận mọi cách đọc hợp lệ |
| **Q8** | **Trang tổng `/luyen-tap/`** + mục menu + thẻ trang chủ; trộn nhiều deck | Test trộn deck không trùng `id`; kiểm tay; SEO (`description`, 1 `<h1>`) |
| **Q9** | (tùy D2) **Gõ kana**: chuyển romaji → kana khi gõ, chấm theo `answer` + `accepted` | Unit test chuyển romaji (しゃ, っ, ん trước nguyên âm…) |
| **Q10** | (tùy D3) **Lưu câu sai** qua `lib/storage.ts`, key `jp:quiz:…` đăng ký bảng; chế độ "Ôn câu hay sai" | `check:storage` xanh; xóa localStorage / chế độ riêng tư → trang vẫn chạy |
| Q11 | Quiz từ nối — sau khi có dữ liệu (STATUS mục 8) | — |

Ước lượng công: Q1–Q3 là phần nền, lâu nhất (khoảng 40% tổng). Q4–Q7 mỗi task chủ yếu là viết hàm sinh câu hỏi + test, vì UI đã có sẵn.

## 6. Checklist (dùng cho mọi trang quiz)

Đã tự động hóa bằng Playwright (`web/e2e/`, mẫu: `counter-quiz.spec.ts`) trừ mục ghi "kiểm tay". Mỗi trang quiz mới cần một file spec.

- [ ] Desktop + mobile (375px): không cuộn ngang, nút đáp án đủ lớn, tiếng Nhật dùng Noto Sans JP.
- [ ] Phím 1–4 chọn, Enter sang câu, không bắt phím khi đang gõ trong ô lọc.
- [ ] Đổi bộ lọc → lượt mới; bộ lọc không còn câu → hiện thông báo, không lỗi.
- [ ] Trả lời đúng/sai → màu theo token (đỏ chỉ cho sai), hiện giải thích + link chi tiết đúng.
- [ ] Hết lượt → tổng kết, "Làm lại câu sai" chỉ chứa câu sai.
- [ ] Không hiện thông tin biên tập (`ai-draft`, `review`).
- [ ] `npm run build` sạch, link nội bộ có `BASE_URL` (thử với `BASE_PATH=/jp-study/`).
- [ ] Mạng chậm (DevTools throttling): có trạng thái đang tải deck — e2e từ Q4 (deck tải lười; giả lập bằng `page.route` trì hoãn file JSON).
- [ ] Kiểm tay: nhìn ảnh chụp desktop + mobile, chất lượng đáp án nhiễu (mẫu 20 câu mỗi loại).

## 7. Rủi ro

| Rủi ro | Cách xử lý |
|---|---|
| Chấm sai đáp án đúng (đồng nghĩa, nhiều cách đọc, thể trùng kana) | Bất biến 1 + `accepted` đầy đủ + test riêng cho từng trường hợp đã biết |
| Nhiễu quá dễ đoán (khác hẳn độ dài/kiểu chữ) | Ưu tiên nhiễu cùng nhóm, cùng độ dài; kiểm tay mẫu 20 câu mỗi loại |
| Deck JSON quá nặng | Tách theo cấp/nhóm, chỉ giữ trường cần cho quiz; mục tiêu < 300KB mỗi file |
| Dữ liệu chưa duyệt (counters, chia thể) làm đáp án sai | Quyết định D4; duyệt 7b trước khi quảng bá quiz |
