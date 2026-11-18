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

// ---------------------------------------------------------------- Đoạn văn (p-nX-NNN)

/** Chiều dịch đoạn văn — khớp DIRECTIONS ở worker/src/exercises.ts. */
export type Direction = "ja-vi" | "vi-ja";
export const DIRECTIONS: readonly Direction[] = ["ja-vi", "vi-ja"];
export const DEFAULT_DIRECTION: Direction = "ja-vi"; // giống bài đọc hiểu
export const DIRECTION_LABELS: Record<Direction, string> = { "ja-vi": "Nhật → Việt", "vi-ja": "Việt → Nhật" };

export type PassageLevel = "n5" | "n4" | "n3";
export const PASSAGE_LEVELS: readonly PassageLevel[] = ["n5", "n4", "n3"];
export const LEVEL_LABELS: Record<PassageLevel, string> = { n5: "N5", n4: "N4", n3: "N3" };

export type PassageGenre = "letter" | "diary" | "notice" | "essay" | "dialogue" | "email";
export const GENRE_LABELS: Record<PassageGenre, string> = {
  letter: "Thư",
  diary: "Nhật ký",
  notice: "Thông báo",
  essay: "Bài viết",
  dialogue: "Hội thoại",
  email: "Email",
};

export function passagePath(id: string): string {
  return `dich/doan/${id}/`;
}

/** Đọc ?chieu=… — giá trị lạ hoặc thiếu → mặc định. */
export function parseDirection(value: string | null): Direction {
  return DIRECTIONS.includes(value as Direction) ? (value as Direction) : DEFAULT_DIRECTION;
}

