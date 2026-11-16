# D2 — Worker: chấm đoạn văn 2 chiều

## Spec

### API

`POST /grade { exerciseId, answer, direction?, turnstileToken? }`

| `exerciseId` | `direction` | Ý nghĩa |
|---|---|---|
| `t-LL-NN` | bỏ qua | Câu đơn — như cũ |
| `p-nX-NNN` | `"ja-vi"` | Đoạn tiếng Nhật → học viên dịch sang tiếng Việt |
| `p-nX-NNN` | `"vi-ja"` | Đoạn tiếng Việt → học viên dịch sang tiếng Nhật |

Đoạn văn thiếu/sai `direction` → `bad_request`. Phản hồi giữ nguyên dạng `GradeResult` (`sentences[]` một mục mỗi câu của đoạn).

### Thay đổi

- `exercises.ts`: `SCHEMA_VERSION = 2`; thêm `getPassage(id)`.
- `prompt.ts`:
  - `PROMPT_VERSION = 2` (khóa cache đổi).
  - Giữ prompt câu đơn. Thêm `passageUserPrompt(passage, direction, answer)`:
    - `vi-ja`: đề = `vi` từng câu, bản mẫu = `ja_text` + `ja_alt` — dùng lại `SYSTEM_PROMPT` hiện có (chấm tiếng Nhật).
    - `ja-vi`: đề = `ja_text` từng câu, bản mẫu = `vi` + `vi_alt` — **system prompt mới** `SYSTEM_PROMPT_JA_VI`: chấm bản dịch tiếng Việt; trọng tâm là học viên **hiểu đúng** tiếng Nhật (sai nghĩa từ, hiểu sai trợ từ/thể phủ định/thì/bị động…); không bắt lỗi chính tả/văn phong tiếng Việt trừ khi làm đổi nghĩa; bản mẫu chỉ tham khảo.
  - Ngữ cảnh đoạn: gửi kèm cả đoạn để AI hiểu đại từ/lược chủ ngữ.
- `result.ts`: giữ `ERROR_TYPES`; với `ja-vi` prompt hướng dẫn dùng `meaning` / `vocabulary` / `particle` / `conjugation` (hiểu sai thể/thì) / `other`; không dùng `spelling`, `politeness`.
- `index.ts`:
  - `cacheKey` gồm `direction`.
  - Độ dài bài làm: dùng chung `MAX_ANSWER_CHARS` 1000 (P5), không thêm biến.
  - `PROVIDER_TIMEOUT_MS` đoạn văn 60s (đoạn dài, ~10–20 câu).
  - `parseGrade(raw, sentenceCount)` dùng số câu của đoạn.

### Kiểm tra

- `npm run check` pass.
- Thử bằng script bundle esbuild (như lúc thêm `openai-compat`): 1 đoạn × 2 chiều, bài làm có lỗi cố ý → kết quả qua zod, bắt đúng lỗi.
- Sau deploy: `curl /grade` thật 2 chiều, gửi lại → `cached:true`.

## Sai khác so với spec

(ghi khi làm)
