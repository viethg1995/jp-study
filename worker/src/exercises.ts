// Đề dịch lấy từ data/translation.json (output pipeline), đóng gói vào worker lúc deploy.
// Sửa/thêm đề → chạy pipeline build-translation → deploy lại worker (và web).
import data from "../../data/translation.json";

export interface Exercise {
  id: string;
  lesson: number;
  title_vi: string;
  prompt_lang: "vi" | "en";
  focus_vi: string[];
  sentences: { prompt: string; references: string[]; note_vi: string | null }[];
}

const SCHEMA_VERSION = 1;
if (data.schema_version !== SCHEMA_VERSION) {
  throw new Error(`translation.json schema_version ${data.schema_version} ≠ ${SCHEMA_VERSION}`);
}
const byId = new Map<string, Exercise>((data.exercises as Exercise[]).map((e) => [e.id, e]));

export function getExercise(id: string): Exercise | undefined {
  return byId.get(id);
}
