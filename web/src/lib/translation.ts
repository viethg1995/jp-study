// Luyện dịch — kiểu dữ liệu trả về từ máy chấm (Cloudflare Worker, thư mục worker/).
// ĐỒNG BỘ với worker/src/result.ts (gradeResult) và mã lỗi ở worker/src/index.ts.

export type ErrorType = "particle" | "conjugation" | "vocabulary" | "word_order" | "politeness" | "meaning" | "spelling" | "other";
export type Verdict = "correct" | "minor" | "wrong" | "missing";

export interface GradeResult {
  overall: "good" | "minor" | "wrong";
  summary_vi: string;
  sentences: {
    index: number;
    learner: string;
    verdict: Verdict;
    corrected: string;
    errors: { type: ErrorType; excerpt: string; explanation_vi: string }[];
  }[];
}

export type GradeResponse =
  | { ok: true; result: GradeResult; provider: string; cached: boolean }
  | { ok: false; error: string; message_vi: string };

export const ERROR_LABELS: Record<ErrorType, string> = {
  particle: "Trợ từ",
  conjugation: "Chia thể",
  vocabulary: "Từ vựng",
  word_order: "Trật tự câu",
  politeness: "Lịch sự / thể thường",
  meaning: "Sai ý",
  spelling: "Chính tả",
  other: "Khác",
};

export const VERDICT_LABELS: Record<Verdict, string> = {
  correct: "Đúng",
  minor: "Gần đúng",
  wrong: "Sai",
  missing: "Chưa dịch",
};

export const MAX_ANSWER_CHARS = 1000; // khớp MAX_ANSWER_CHARS trong worker/wrangler.jsonc

export function exercisePath(id: string): string {
  return `dich/${id}/`;
}
