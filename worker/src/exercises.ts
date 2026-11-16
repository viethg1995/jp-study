// Đề dịch lấy từ data/translation.json (output pipeline), đóng gói vào worker lúc deploy.
// Sửa/thêm đề → chạy pipeline build-translation → deploy lại worker (và web).
import data from "../../data/translation.json";

/** Câu đơn t-LL-NN: đề Việt/Anh → học viên dịch sang tiếng Nhật. */
export interface Exercise {
  id: string;
  lesson: number;
  title_vi: string;
  prompt_lang: "vi" | "en";
  focus_vi: string[];
  sentences: { prompt: string; references: string[]; note_vi: string | null }[];
}

/** Đoạn văn p-nX-NNN: song ngữ theo câu, dùng cho 2 chiều. */
export interface Passage {
  id: string;
  level: "n5" | "n4" | "n3";
  title_vi: string;
  focus_vi: string[];
  sentences: { ja_text: string; ja_alt: string[]; vi: string; vi_alt: string[]; note_vi: string | null; para: number }[];
}

export type Direction = "ja-vi" | "vi-ja";
export const DIRECTIONS: readonly Direction[] = ["ja-vi", "vi-ja"];

const SCHEMA_VERSION = 2;
if (data.schema_version !== SCHEMA_VERSION) {
  throw new Error(`translation.json schema_version ${data.schema_version} ≠ ${SCHEMA_VERSION}`);
}
const byId = new Map<string, Exercise>((data.exercises as Exercise[]).map((e) => [e.id, e]));
const passageById = new Map<string, Passage>((data.passages as unknown as Passage[]).map((p) => [p.id, p]));

export function getExercise(id: string): Exercise | undefined {
  return byId.get(id);
}

export function getPassage(id: string): Passage | undefined {
  return passageById.get(id);
}
