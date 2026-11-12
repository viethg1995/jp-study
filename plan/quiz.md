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
- Số câu thêm **"Tự nhập"** (1–100; bỏ "Không giới hạn", thêm nút 100; số sai báo lỗi, giữ lượt đang làm; gõ số trong ô không bị coi là chọn đáp án).
- Thêm dòng **"Furigana: Hiện / Ẩn"** (prop `furiganaToggle` của QuizRunner, thuần CSS): ẩn cách đọc ở câu hỏi + lựa chọn; phản hồi, giải thích, tổng kết vẫn hiện. Chỉ bật ở quiz từ vựng (quiz đếm số không có furigana). Không lưu URL/localStorage.
- Test: unit +5 (trộn đều), e2e +4 (trộn đều 4/4/4/4/4, ✓, tự nhập, nhãn loại) → unit 99, e2e 26 × 2 màn hình.

### Q5 — spec (đã chốt Q5-1…Q5-5 theo đề xuất, 2026-11-12)

**Số liệu dữ liệu** (`data/kanji/`, đo 2026-11-12):

| Mục | Số |
|---|---|
| Kanji | 1.085 chữ. Theo **giáo trình Kanji**: N5 130 chữ / 26 bài · N4 177 / 24 bài · N3 301 / 35 bài (một chữ có thể ở nhiều cấp; 個 ở N3 bài 1 và 21). Theo **bài từ vựng**: N5 530 (Minna 1–25) · N4 323 (26–50) · N3 178 (từ vựng N3) |
| Âm Hán-Việt | 1.078 chữ 1 âm, 5 chữ 2 âm, 2 chữ không có (quốc tự 込 匂). 202 âm dùng chung cho ≥ 2 chữ (TỰ: 6 chữ) |
| Nghĩa VI | đủ 1.085 (16 `ai-draft`). 45 nghĩa có kanji trong ngoặc: `檎 → quả táo (林檎)`, `配 → phân phát; lo lắng (心配)`. 9 cặp nghĩa trùng hệt (休/憩 "nghỉ ngơi") |
| Từ ví dụ | 5.876 (2.656 từ giáo trình, 3.220 JMdict); On 3.808 · Kun 1.917 · đọc đặc biệt 151. 5.649 câu tìm được vị trí âm của chữ trong cách đọc cả từ |
| Bộ thủ | 214 bộ (1–17 nét), 174 bộ có trong Kanji của site (cộng dồn: N5 145 · N4 165 · N3 174). 20 tên trùng (2 bộ "Nhi", 2 bộ "Bát"…). Thành phần chữ (KanjiVG): 何 = 亻 + 可, 問 = 門 + 口 (bộ thủ là 口) |

**Loại câu** (6 loại, chia 2 trang — Q5-1):

| Loại | Hỏi → chọn | Nhiễu (ưu tiên trước) | Đúng thêm / loại trừ |
|---|---|---|---|
| `k-hv` Hán-Việt | 学 → HỌC | Âm của chữ có chung thành phần (KanjiVG) → cùng bộ thủ → cùng bài | Chữ 2 âm: âm kia vào `accepted`. Bỏ 込 匂 |
| `k-mean` Nghĩa | 学 → học | Nghĩa của chữ chung thành phần / cùng bộ / cùng bài | Loại nhiễu đồng nghĩa (dùng lại `synonymous` của từ vựng). Nghĩa bỏ phần kanji trong ngoặc (Q5-4) |
| `k-char` Chữ | HỌC · học → 学 | Chữ **giống hình**: chung thành phần (問/間/聞), cùng bộ, số nét ±1 | Loại chữ cùng âm HV **và** đồng nghĩa (không phân biệt được bằng đề) |
| `k-read` Cách đọc | Từ ví dụ, chữ đang hỏi tô đậm: **大**学 → だいがく | (1) Thay âm của chữ bằng âm **On ↔ Kun khác** của chính chữ: たいがく, おおがく; (2) lỗi máy sinh (`kana.ts`): trường âm, っ, đục; (3) bù cách đọc từ ví dụ khác cùng chữ | Q5-3: lấy từ nào, bao nhiêu từ mỗi chữ. Gợi ý: nghĩa từ + "On/Kun" sau khi trả lời |
| `r-of` Bộ thủ của chữ | 問 → 口 Khẩu | **Thành phần khác của chính chữ** (門 Môn) → bộ cùng số nét | Q5-5. Giải thích: "Bộ KHẨU (口); 門 chỉ là thành phần" |
| `r-name` Tên bộ (trang bộ thủ) | 氵 → Thủy · nước | Bộ cùng số nét | 2 bộ trùng tên → hiện kèm nghĩa để phân biệt; loại nhiễu trùng tên |
| `r-char` Bộ theo tên (trang bộ thủ) | Thủy · nước → 水 (氵) | Bộ cùng số nét / hình gần | Chiều ngược của `r-name` |

**File Deck** (như từ vựng, tải lười theo bộ lọc): `/kanji/quiz/<xếp theo>-<cấp>-<loại>.json` — `gt` (giáo trình) / `tv` (bài từ vựng) × N5/N4/N3 × 5 loại = 30 file, mỗi file ≤ 301 chữ (k-read ≤ 3 từ/chữ ~ 900 câu) → ước < 200KB gốc. Tag `lesson` theo đúng cách xếp (N3 giáo trình: nhiều bài). Bộ thủ: 1 file `/kanji/bo-thu/quiz/<loại>.json` (214 câu), tag `strokes`, `level` (cấp nhỏ nhất có chữ dùng bộ đó).

**Trang**
- `/kanji/quiz/`: Cấp [N5 · N4 · N3] → Xếp theo [Giáo trình Kanji · Bài từ vựng] (giống trang `/kanji/n5`) → Bài từ–đến → Loại câu (chọn nhiều, trộn đều) → Số câu. Không có dòng Furigana: đề và đáp án của 5 loại không có furigana (`k-read` hỏi chính cách đọc). URL: `?cap=n5&xep=gt&tu=1&den=5&loai=hv,nghia`.
- `/kanji/bo-thu/quiz/`: Phạm vi [Bộ có trong Kanji N5 (145) · ≤ N4 (165) · ≤ N3 (174) · Cả 214] → Loại câu [Tên bộ · Chữ của bộ] → Số câu. URL: `?pham-vi=n5&loai=ten`.
- Nút "Luyện tập →": trang `/kanji/n5|n4|n3` mỗi bài (theo cách xem đang chọn) và `/kanji/bo-thu/`. Menu: "Luyện tập" dưới Kanji. Link sau trả lời → trang chữ `/kanji/<字>/` hoặc trang bộ `/kanji/bo-thu/<số>/`.

**Quyết định cần chốt:**

| # | Bối cảnh | Đề xuất | Nếu không theo / phương án khác |
|---|---|---|---|
| Q5-1 | Câu về chữ lọc theo bài; câu về bộ thủ thì không (bộ thủ không có bài) | **2 trang**: `/kanji/quiz/` (5 loại về chữ, gồm `r-of` vì nó hỏi về chữ) + `/kanji/bo-thu/quiz/` (`r-name`, `r-char`) | 1 trang chung: bộ lọc phải ẩn/hiện theo loại câu → rối, URL phức tạp |
| Q5-2 | Trang Kanji có 2 cách xếp; số chữ khác nhau nhiều (N5: 130 vs 530) | **Có công tắc "Xếp theo"**, mặc định Giáo trình Kanji (như trang `/kanji/n5`) | Chỉ giáo trình: 499 chữ chỉ có ở từ vựng sẽ không bao giờ được hỏi. Chỉ bài từ vựng: người học theo sách Kanji không lọc đúng bài |
| Q5-3 | `k-read`: 5.876 từ, hơn nửa từ JMdict (người học chưa gặp ở giáo trình) | **Tối đa 3 từ/chữ**: từ giáo trình trước, đảm bảo có 1 On + 1 Kun nếu chữ có; thiếu mới lấy JMdict. Một từ chứa nhiều chữ (大学) chỉ hỏi 1 lần, gắn vào chữ có bài muộn nhất | Lấy hết: ~5.900 câu, nhiều từ lạ, trùng lặp với quiz từ vựng. Chỉ từ giáo trình: 136 chữ không có Kun, nhiều chữ N3 không có từ nào |
| Q5-4 | 45 nghĩa có kanji trong ngoặc → đề `k-char` lộ chữ (林**檎**), đáp án `k-mean` lộ vì chỉ nó chứa chữ đề | **Bỏ phần kanji trong ngoặc** ở đề + đáp án ("quả táo", "chào hỏi"); giải thích sau khi trả lời hiện nghĩa đầy đủ | Loại 45 chữ khỏi `k-mean`/`k-char`; hoặc che chữ bằng ＿ (vẫn lộ vì chỉ đáp án có ＿) |
| Q5-5 | `r-of` theo phân loại KANJIDIC — có chữ gây bất ngờ (問 thuộc 口 chứ không phải 門) | **Làm**, nhiễu ưu tiên thành phần khác của chữ, giải thích rõ; đáp án hiện dạng biến thể nếu chữ dùng biến thể (何 → 亻 (人) Nhân) | Bỏ `r-of`: mất loại câu luyện nhận bộ thủ trong chữ |

**Bất biến / test** (`lib/quiz/kanji.test.ts`, chạy trên dữ liệu thật): 30 + 2 deck qua `checkDeck` (5 quy tắc), ≤ 2% câu bị loại vì thiếu nhiễu, kích thước file; trường hợp đã biết: chữ 2 âm HV có `accepted`, 込/匂 không có câu `k-hv`/`k-char`, 問 → `r-of` đáp án 口 có nhiễu 門, 休/憩 không là nhiễu của nhau ở `k-mean`, không đề/đáp án nào chứa chữ đang hỏi (`k-mean`/`k-char`), `k-read` 大学 hỏi 1 lần, nhiễu On↔Kun không trùng cách đọc đúng nào của từ. **E2E** `kanji-quiz.spec.ts` + `radical-quiz.spec.ts` theo checklist §6 (URL, đổi Xếp theo → khoảng bài, nút "Luyện tập" ở trang cấp và trang bộ thủ, 32px, mobile).

**Sai khác so với spec Q5** (khi triển khai):

| # | Spec | Thực tế | Lý do |
|---|---|---|---|
| 1 | Deck < 300KB (§3), ước < 200KB | `tv-n5-doc` 526KB gốc / 81KB gzip (1.317 câu); các file khác ≤ 382KB / ≤ 61KB gzip | 530 chữ × ≤ 3 từ. Chỉ tải khi chọn "Cách đọc"; giải thích đã rút gọn (nghĩa nằm ở gợi ý) |
| 2 | Q5-3: lấy từ ví dụ của chữ | **Bỏ từ chỉ gồm đúng chữ đó** (何 → なに) | Đứng riêng thì âm nào của chữ cũng có thể đúng (なに / なん) → không chấm chắc được |
| 3 | Nhiễu đổi âm On ↔ Kun | Chỉ đổi khi âm thay thế dài/ngắn hơn ≤ 1 kana | Âm quá khác độ dài lộ là sai (お風呂 → おふせぼね) |
| 4 | Q5-5: hiện dạng biến thể (何 → 亻) | Hiện dạng trong chữ, **trừ khi dạng đó là một bộ khác** (書: KanjiVG ghi 日, gốc 曰 → hiện 曰 · Viết) | Hiện 日 · Viết dễ nhầm bộ Nhật |
| 5 | (spec không nêu) | Chữ đang hỏi trong câu "Cách đọc" tô xanh + gạch chân (cú pháp `[[…]]`, `renderRuby` ở runner) | Từ ghép nhiều chữ — người học cần biết đang hỏi âm của chữ nào |

**Chỉnh sau khi user test tay Q5 (2026-11-12):** giải thích quiz Kanji mỗi ý một dòng (chữ · âm · nghĩa / On / Kun; `explain` nhận `\n`, QuizRunner `whitespace-pre-line`); quiz bộ thủ thêm dòng **Số nét: từ – đến** (1–17, mỗi mục kèm số bộ, URL `net-tu`/`net-den`) + "Đang chọn: N bộ" đếm theo phạm vi × số nét — chọn khoảng thay vì dropdown chọn nhiều (học theo thứ tự nét; nhóm 11–17 nét chỉ 1–6 bộ mỗi nhóm).

**Lỗi dữ liệu bộ thủ (sửa ở pipeline `radicals.json`, không sửa `data/`):** tên dính số từ PDF — 戶 "Hộ 6", 斗 "Đầu 7", 方 "Phương 9"; thiếu biến thể quen thuộc (人 không có 亻, 水 không có 氵, 心 không có 忄… — chỉ 27/214 bộ có `variants`) → quiz "Tên bộ" hỏi 水 mà không kèm 氵.

### Q6 — spec (đã chốt Q6-1…Q6-5 theo đề xuất, 2026-11-12)

**Số liệu** (`data/conjugation.json`, đo 2026-11-12):

| Mục | Số |
|---|---|
| Từ | 714: động từ 531 (nhóm I 279, II 156, III 96), tính từ い 86, tính từ な 95, danh từ 2 (あめ, がくせい — chỉ làm mẫu). Minna 445, N3 269 (bài N3 1–14) |
| Thể | Động từ 20 thể (ます bài 4 … sai khiến bài 48; bị bắt làm `lesson` = null), tính từ い 11, な 12. Tổng 12.697 ô chia, 1.422 ô bất quy tắc (V3 1.344, V1 50 — 行きます…, い 27 — いい, V2 1) |
| Trùng kana | 154 từ có thể khả năng = bị động (V2 たべられる) — chỉ cặp này |
| Thiếu thể | 9 từ: わかります/できます/みえます/きこえます không có khả năng; あります thiếu 9 thể; kính ngữ (くださいます, いらっしゃいます, おっしゃいます, なさいます) thiếu 5 thể |
| Duyệt | Quy tắc `enrichment/conjugation/forms.json` là `ai`, chờ duyệt (D4: vẫn đưa vào quiz) |
| Dung lượng | File bảng tra hiện có `/chia-the/dong-tu/te.json` (531 từ × 1 thể) = 33KB gốc / **5,6KB gzip** |

**Loại câu:**

| Loại | Hỏi → chọn | Nhiễu (sinh bằng quy tắc "lỗi hay gặp", luôn loại mọi dạng đúng) |
|---|---|---|
| `c-to` Chia | {書|か}きます · **Thể て** → {書|か}いて | V1: biến âm て/た sai (かって, かんで, かして) + chia như V2 (かきて). V2: chia như V1 (たべって, たべらない, たべれる) — bẫy 帰ります/食べます. V3: dạng chia theo quy tắc thường (きない ← こない, しれる ← できる). い: chia như な (たかいでした, たかいじゃない, たかじゃない); いい → いくない. な: chia như い (しずかかった, しずかくない). Bù: thể khác của chính từ (て ↔ た, ない ↔ なかった) |
| `c-which` Nhận thể | たべさせる → **Thể nào?** | Tên thể khác cùng nhóm từ, ưu tiên thể có đuôi giống (られる / させる / させられる; たら / ば). Khả năng ↔ bị động trùng kana → **cả hai đều đúng** (`accepted`). Không hỏi thể dùng làm đề (ます với Minna) |
| `c-group` Nhóm động từ | かえります → **Nhóm I / II / III** | Chỉ động từ. **3 lựa chọn** (Q6-3). Bẫy hay gặp: かえります/はいります/きります (I, trông như II), おきます/みます/かります (II, hàng い) |

Đề `c-to`: từ ở dạng gốc của giáo trình — Minna: thể ます; N3: thể từ điển. Gợi ý: nghĩa + bài. Sau khi trả lời: quy tắc của ô (`rule`, vd "き → いて"), ô bất quy tắc ghi "Bất quy tắc". Có dòng **Furigana: Hiện / Ẩn** (đáp án là chữ có furigana).

**Trang `/chia-the/quiz/`** — bộ lọc (URL):
- **Nhóm từ** (chọn một): Động từ · Tính từ い · Tính từ な. Danh từ bỏ (2 từ). `?nhom=dong-tu`
- **Sách** (chọn một): Minna · N3.
  - Minna → **Đã học tới bài** B (1–50, mặc định 50): chỉ từ có bài ≤ B **và** thể có bài ≤ B (thể bị bắt làm chỉ khi B = 50). `?sach=minna&bai=20`
  - N3 → **Bài** từ–đến (1–14), mọi thể. `?sach=n3&tu=1&den=5`
- **Nhóm động từ** (chọn nhiều, chỉ khi Động từ): I · II · III. `?dt=1,2`
- **Thể** (chọn nhiều): chỉ hiện thể đã học tới bài B; mặc định tất cả. `?the=te,ta,nai`
- **Loại câu** (chọn nhiều, trộn đều): Chia · Nhận thể · Nhóm động từ.
- Nút "Luyện tập thể này →" ở trang `/chia-the/the/<nhóm>/<thể>/` và "Luyện tập →" ở bảng tra `/chia-the/dong-tu|tinh-tu-i|tinh-tu-na/`; menu "Luyện tập" dưới Chia thể.

**Quyết định cần chốt:**

| # | Bối cảnh | Đề xuất | Nếu không theo / phương án khác |
|---|---|---|---|
| Q6-1 | Động từ 531 × 20 thể = 10.620 câu `c-to`. Đóng gói sẵn như Q4/Q5: mỗi câu ~350B → mỗi thể ~25KB gzip, chọn đủ 20 thể ≈ **500KB gzip** | **Sinh câu trên trình duyệt** từ bảng chia gọn: 1 file mỗi nhóm từ (động từ ~110KB gzip, đủ 20 thể; tính từ ~15KB), hàm sinh câu `lib/quiz/conjugation.ts` chạy ở client (~4KB JS). Nhiễu lọc theo đúng bài đã học (không đưa thể chưa học vào `c-which`). Unit test vẫn chạy hàm sinh trên **toàn bộ** dữ liệu + `checkDeck` như Q4/Q5. Runner thêm tham số chuyển JSON → câu hỏi | Đóng gói sẵn: tải nặng gấp ~5 lần khi chọn nhiều thể; nhiễu `c-which` lấy cả thể chưa học |
| Q6-2 | Minna xếp thể theo bài (ます 4 … sai khiến 48); N3 không xếp thể theo bài | Minna: **"Đã học tới bài B"** lọc cả từ lẫn thể (D6). N3: lọc bài từ vựng, mọi thể | Chỉ lọc thể (bỏ "đã học tới bài"): người học bài 15 vẫn gặp từ bài 40 |
| Q6-3 | `c-group` chỉ có 3 đáp án (I/II/III); khung hiện tại luôn 4 lựa chọn | **Cho phép câu 3 lựa chọn** (runner hiện theo số lựa chọn, phím 1–3; `checkDeck` cho phép pool 2 với kind `c-group`) | Bỏ `c-group`; hoặc ép 4 lựa chọn bằng lựa chọn vô lý ("Tính từ い") — lộ đáp án |
| Q6-4 | Nhiễu `c-to` cần "chia sai theo nhóm khác" → phải viết bộ chia động từ/tính từ bằng TS (pipeline Python đã có, nhưng web không gọi được) | **Viết bộ "chia sai" nhỏ trong TS** chỉ cho nhiễu (đáp án đúng luôn lấy từ `data/`); test: mọi nhiễu ≠ mọi dạng đúng của từ; bảng ca đã biết (書きます→て có かって/かきて, không có かいて; 帰ります↔食べます; いい; しずか) | Chỉ dùng "thể khác của chính từ" làm nhiễu: dễ đoán (độ dài/đuôi khác hẳn) |
| Q6-5 | `c-which`: たべられる vừa khả năng vừa bị động | **Cả hai đúng**; giải thích ghi "V2: khả năng = bị động". Không hỏi `c-which` cho thể ます-family? → **vẫn hỏi** ません/ました/ませんでした/ましょう (người mới cần), chỉ bỏ ます (trùng đề) | Bỏ hẳn từ V2 ở 2 thể này: mất 154 × 2 câu dễ nhầm nhất |

**Test:** unit — sinh câu cho mọi từ × thể × loại → `checkDeck` 0 lỗi, ≤ 2% câu thiếu nhiễu; bảng ca đã biết (Q6-4); 154 cặp khả năng/bị động có `accepted`; lọc bài B: không câu nào có thể/từ bài > B; 9 từ thiếu thể không sinh câu thể đó. E2E `conjugation-quiz.spec.ts` theo checklist §6 + câu 3 lựa chọn (phím 4 không chọn gì) + lọc bài + nút "Luyện tập" + Furigana.

**Sai khác so với spec Q6** (khi triển khai):

| # | Spec | Thực tế | Lý do |
|---|---|---|---|
| 1 | Bảng động từ ~110KB gzip | **71KB** gzip (725KB gốc); tính từ い 7KB, な 9KB | Ước lượng cũ dư |
| 2 | Hàm sinh chạy `checkDeck` như Q4/Q5 | Trên trình duyệt **không** gọi `checkDeck` (chiếm ~60% thời gian): nhiễu đã loại trùng đáp án + kiểm ruby lúc sinh, chỉ bỏ câu thiếu nhiễu / tự lộ; unit test chạy `checkDeck` trên toàn bộ dữ liệu (0 lỗi). Trường hợp nặng nhất (531 động từ × 20 thể × 3 loại) ~0,2–0,3s | Sinh lại mỗi lần đổi bộ lọc |
| 3 | (spec không nêu) | Bỏ 5 câu Chia thể mệnh lệnh của động từ kính ngữ (くださいます → ください…) | Đáp án nằm sẵn trong đề (quy tắc 5) |
| 4 | Nhiễu bù = thể khác của chính từ | Bù theo **cùng độ lịch sự** với đáp án rồi độ dài gần nhất (hỏi thể て → する/した/しろ, không phải しません); `c-which` cũng ưu tiên tên thể cùng độ lịch sự | Bù thể lịch sự cho câu thể thường lộ ngay |
| 5 | (spec không nêu) | URL chỉ ghi `the` / `dt` khi **không** chọn đủ; mobile: dòng "Thể" đặt nhãn trên, "Nhóm từ" xuống dòng (375px tràn 20px) | URL gọn; không cuộn ngang |

**Luồng làm bài (user yêu cầu 2026-11-12, áp dụng cho mọi trang quiz qua `QuizRunner`):** mở trang chỉ thấy bảng "Tùy chọn luyện tập" + nút **Bắt đầu** (chưa tải deck; nút `disabled` tới khi script sẵn sàng) → bấm Bắt đầu mới tải câu hỏi, hiện khung quiz và cuộn tới thẻ → trong lúc làm bài mọi tùy chọn bị **khóa** (input `disabled`, làm mờ, tiêu đề khung ghi "đã khóa") **trừ Furigana** (dòng `[data-q-keep]`) → tổng kết: "Làm lại câu sai" / "Lượt mới" giữ tùy chọn, **"Đổi tùy chọn"** mở khóa về bước thiết lập. Bộ lọc rỗng hoặc lỗi tải → mở khóa, bấm Bắt đầu để thử lại. Số câu tự nhập sai → không cho bắt đầu.

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
| **Q5** ✅ | **Quiz Kanji + bộ thủ** — spec chi tiết ở §4 "Q5 — spec": `lib/quiz/kanji.ts` (`k-hv`, `k-mean`, `k-char`, `k-read`, `r-of`, `r-name`, `r-char`), 32 file Deck, trang `/kanji/quiz/` + `/kanji/bo-thu/quiz/`; link từ `/kanji/n5|n4|n3` và `/kanji/bo-thu/` | **Xong 2026-11-12** — `lib/quiz/kanji.ts` (7 loại; giống hình = chung thành phần KanjiVG → cùng bộ → số nét gần; nhớ đệm → 32 deck ~2s), `[deck].json.ts` 30 file `/kanji/quiz/<gt|tv>-<cấp>-<loại>.json` + 2 file `/kanji/bo-thu/quiz/<ten|chu>.json`, trang `/kanji/quiz/` (cấp, xếp theo, bài, loại câu) + `/kanji/bo-thu/quiz/` (phạm vi N5 145 / N4 165 / N3 174 / 214, loại câu), nút "Luyện tập" ở `/kanji/n5|n4|n3` (cả cấp + từng bài, 2 cách xếp) và `/kanji/bo-thu/`, menu. Test: unit 53 (32 deck × checkDeck + kích thước, khoảng bài, 個 nhiều bài, 2 âm HV, 込匂, Q5-4, 休/憩, 聞 giống hình, 大学 たいがく/おおがく, 問 → 口 nhiễu 門, 何 → 亻, 書 → 曰, 几/己), e2e `kanji-quiz.spec.ts` 12 × 2 màn hình (cả `BASE_PATH=/jp-study/`) |
| **Q6** ✅ | **Quiz chia thể** (spec chi tiết ở §4 "Q6 — spec"): `lib/quiz/conjugation.ts` (quy tắc sinh lỗi nhóm/biến âm), `c-to`, `c-which`, `c-group`; endpoint theo nhóm; trang `/chia-the/quiz/` lọc nhóm từ + thể + bài; mục 6 trong STATUS hết TODO | **Xong 2026-11-12** — `lib/quiz/conjugation.ts` (bảng chia gọn `buildConjTable`, bộ chia sai `godan`/`ichidan`/biến âm て/い↔な, `conjItems` chạy trên trình duyệt), endpoint `/chia-the/quiz/<dong-tu|tinh-tu-i|tinh-tu-na>.json`, runner `setFilter(filter, decks, toItems)`, `checkDeck` cho phép câu 3 lựa chọn (`MIN_POOL_BY_KIND`), trang `/chia-the/quiz/` (nhóm từ, sách, đã học tới bài / bài N3, nhóm động từ, thể + Chọn hết/Bỏ chọn, loại câu, Furigana), nút "Luyện tập" ở trang thể + bảng chia, menu. Test: unit 23 (toàn bộ dữ liệu × checkDeck, 書きます/行きます/帰ります/食べます/いい/長い/きれい, 154 cặp khả năng = bị động, lọc bài 15/50, N3, 3 lựa chọn; thử bỏ bước loại trùng → 6 test đỏ), e2e `conjugation-quiz.spec.ts` 10 × 2 màn hình (cả `BASE_PATH`) |
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
- [ ] Mở trang chỉ có bảng tùy chọn + "Bắt đầu" (chưa tải deck); bấm Bắt đầu → khung quiz, tùy chọn khóa trừ Furigana; tổng kết → "Đổi tùy chọn" mở khóa; bộ lọc không còn câu → Bắt đầu báo rỗng, tùy chọn vẫn mở.
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
