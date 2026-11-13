# Q5 — Quiz Kanji + bộ thủ

> Phần chung (quyết định D1–D6, kiến trúc, bất biến, luồng làm bài, checklist): [README.md](README.md). File này chỉ chứa riêng task Q5.

Trạng thái: ✅ xong 2026-11-12

## Nội dung

**Quiz Kanji + bộ thủ** — spec bên dưới: `lib/quiz/kanji.ts` (`k-hv`, `k-mean`, `k-char`, `k-read`, `r-of`, `r-name`, `r-char`), 32 file Deck, trang `/kanji/quiz/` + `/kanji/bo-thu/quiz/`; link từ `/kanji/n5|n4|n3` và `/kanji/bo-thu/`

## Tiêu chí xong / kết quả

**Xong 2026-11-12** — `lib/quiz/kanji.ts` (7 loại; giống hình = chung thành phần KanjiVG → cùng bộ → số nét gần; nhớ đệm → 32 deck ~2s), `[deck].json.ts` 30 file `/kanji/quiz/<gt|tv>-<cấp>-<loại>.json` + 2 file `/kanji/bo-thu/quiz/<ten|chu>.json`, trang `/kanji/quiz/` (cấp, xếp theo, bài, loại câu) + `/kanji/bo-thu/quiz/` (phạm vi N5 145 / N4 165 / N3 174 / 214, loại câu), nút "Luyện tập" ở `/kanji/n5|n4|n3` (cả cấp + từng bài, 2 cách xếp) và `/kanji/bo-thu/`, menu. Test: unit 53 (32 deck × checkDeck + kích thước, khoảng bài, 個 nhiều bài, 2 âm HV, 込匂, Q5-4, 休/憩, 聞 giống hình, 大学 たいがく/おおがく, 問 → 口 nhiễu 門, 何 → 亻, 書 → 曰, 几/己), e2e `kanji-quiz.spec.ts` 12 × 2 màn hình (cả `BASE_PATH=/jp-study/`)

## Spec (đã chốt Q5-1…Q5-5 theo đề xuất, 2026-11-12)

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

**Bất biến / test** (`lib/quiz/kanji.test.ts`, chạy trên dữ liệu thật): 30 + 2 deck qua `checkDeck` (5 quy tắc), ≤ 2% câu bị loại vì thiếu nhiễu, kích thước file; trường hợp đã biết: chữ 2 âm HV có `accepted`, 込/匂 không có câu `k-hv`/`k-char`, 問 → `r-of` đáp án 口 có nhiễu 門, 休/憩 không là nhiễu của nhau ở `k-mean`, không đề/đáp án nào chứa chữ đang hỏi (`k-mean`/`k-char`), `k-read` 大学 hỏi 1 lần, nhiễu On↔Kun không trùng cách đọc đúng nào của từ. **E2E** `kanji-quiz.spec.ts` + `radical-quiz.spec.ts` theo checklist ([README](README.md#checklist)) (URL, đổi Xếp theo → khoảng bài, nút "Luyện tập" ở trang cấp và trang bộ thủ, 32px, mobile).

**Sai khác so với spec Q5** (khi triển khai):

| # | Spec | Thực tế | Lý do |
|---|---|---|---|
| 1 | Deck < 300KB ([README D1](README.md#quyết-định)), ước < 200KB | `tv-n5-doc` 526KB gốc / 81KB gzip (1.317 câu); các file khác ≤ 382KB / ≤ 61KB gzip | 530 chữ × ≤ 3 từ. Chỉ tải khi chọn "Cách đọc"; giải thích đã rút gọn (nghĩa nằm ở gợi ý) |
| 2 | Q5-3: lấy từ ví dụ của chữ | **Bỏ từ chỉ gồm đúng chữ đó** (何 → なに) | Đứng riêng thì âm nào của chữ cũng có thể đúng (なに / なん) → không chấm chắc được |
| 3 | Nhiễu đổi âm On ↔ Kun | Chỉ đổi khi âm thay thế dài/ngắn hơn ≤ 1 kana | Âm quá khác độ dài lộ là sai (お風呂 → おふせぼね) |
| 4 | Q5-5: hiện dạng biến thể (何 → 亻) | Hiện dạng trong chữ, **trừ khi dạng đó là một bộ khác** (書: KanjiVG ghi 日, gốc 曰 → hiện 曰 · Viết) | Hiện 日 · Viết dễ nhầm bộ Nhật |
| 5 | (spec không nêu) | Chữ đang hỏi trong câu "Cách đọc" tô xanh + gạch chân (cú pháp `[[…]]`, `renderRuby` ở runner) | Từ ghép nhiều chữ — người học cần biết đang hỏi âm của chữ nào |

**Chỉnh sau khi user test tay Q5 (2026-11-12):** giải thích quiz Kanji mỗi ý một dòng (chữ · âm · nghĩa / On / Kun; `explain` nhận `\n`, QuizRunner `whitespace-pre-line`); quiz bộ thủ thêm dòng **Số nét: từ – đến** (1–17, mỗi mục kèm số bộ, URL `net-tu`/`net-den`) + "Đang chọn: N bộ" đếm theo phạm vi × số nét — chọn khoảng thay vì dropdown chọn nhiều (học theo thứ tự nét; nhóm 11–17 nét chỉ 1–6 bộ mỗi nhóm).

**Lỗi dữ liệu bộ thủ (sửa ở pipeline `radicals.json`, không sửa `data/`):** tên dính số từ PDF — 戶 "Hộ 6", 斗 "Đầu 7", 方 "Phương 9"; thiếu biến thể quen thuộc (人 không có 亻, 水 không có 氵, 心 không có 忄… — chỉ 27/214 bộ có `variants`) → quiz "Tên bộ" hỏi 水 mà không kèm 氵.
