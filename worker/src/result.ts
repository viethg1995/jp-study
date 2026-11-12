// Kết quả chấm — hợp đồng giữa worker và web (web/src/lib/translation.ts giữ bản interface tương ứng).
// GRADE_JSON_SCHEMA gửi cho AI (structured output); zod kiểm lại mọi câu trả lời trước khi trả về web.
import { z } from "zod";

export const ERROR_TYPES = [
  "particle", // trợ từ
  "conjugation", // chia thể / thì / phủ định
  "vocabulary", // dùng sai từ
  "word_order", // trật tự câu
  "politeness", // lẫn thể lịch sự / thể thường, kính ngữ
  "meaning", // sai / thiếu ý so với đề
  "spelling", // viết sai kana / kanji
  "other",
] as const;

export const gradeResult = z.object({
  overall: z.enum(["good", "minor", "wrong"]),
  summary_vi: z.string(),
  sentences: z.array(
    z.object({
      index: z.number().int().min(1),
      learner: z.string(),
      verdict: z.enum(["correct", "minor", "wrong", "missing"]),
      corrected: z.string(),
      errors: z.array(
        z.object({
          type: z.enum(ERROR_TYPES),
          excerpt: z.string(),
          explanation_vi: z.string(),
        }),
      ),
    }),
  ),
});
export type GradeResult = z.infer<typeof gradeResult>;

const str = { type: "string" } as const;

/** JSON Schema chuẩn (Anthropic, Workers AI): mọi object additionalProperties=false, mọi trường required. */
export const GRADE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["overall", "summary_vi", "sentences"],
  properties: {
    overall: { type: "string", enum: ["good", "minor", "wrong"] },
    summary_vi: str,
    sentences: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "learner", "verdict", "corrected", "errors"],
        properties: {
          index: { type: "integer" },
          learner: str,
          verdict: { type: "string", enum: ["correct", "minor", "wrong", "missing"] },
          corrected: str,
          errors: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["type", "excerpt", "explanation_vi"],
              properties: {
                type: { type: "string", enum: [...ERROR_TYPES] },
                excerpt: str,
                explanation_vi: str,
              },
            },
          },
        },
      },
    },
  },
} as const;

type Schema = { [k: string]: unknown };

/** Bản cho Gemini responseSchema (tập con OpenAPI): bỏ additionalProperties. */
export function geminiSchema(node: unknown = GRADE_JSON_SCHEMA): unknown {
  if (Array.isArray(node)) return node.map((n) => geminiSchema(n));
  if (node === null || typeof node !== "object") return node;
  const out: Schema = {};
  for (const [k, v] of Object.entries(node as Schema)) {
    if (k === "additionalProperties") continue;
    out[k] = geminiSchema(v);
  }
  return out;
}

/** Parse + kiểm tra câu trả lời của AI. Sai → ném lỗi để chuyển sang nhà cung cấp kế tiếp. */
export function parseGrade(raw: unknown, sentenceCount: number): GradeResult {
  const value = typeof raw === "string" ? (JSON.parse(stripFence(raw)) as unknown) : raw;
  const result = gradeResult.parse(value);
  if (result.sentences.length !== sentenceCount) {
    throw new Error(`AI trả ${result.sentences.length} câu, đề có ${sentenceCount}`);
  }
  return result;
}

function stripFence(s: string): string {
  const m = /```(?:json)?\s*([\s\S]*?)```/.exec(s);
  return (m ? m[1]! : s).trim();
}
