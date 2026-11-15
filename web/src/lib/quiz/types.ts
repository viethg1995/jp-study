// Kiểu dữ liệu chung cho mọi quiz (plan/quiz/README.md, Kiến trúc). Câu hỏi sinh lúc build bằng hàm thuần ở lib/quiz/<phần>.ts,
// đóng gói thành Deck (file JSON tĩnh), trang chỉ hiển thị.

export type TagValue = string | number;

export interface QuizItem {
  /** `${kind}:${id dữ liệu}` vd "v-read:mn-05-001" — cố định, sau này làm khóa lưu câu sai (Q10). */
  id: string;
  /** Loại câu hỏi: "v-read", "k-hv", "c-to", "n-ctr"… */
  kind: string;
  /** Câu hỏi; tiếng Nhật dùng cú pháp ruby {漢字|かな} (lib/ruby.ts). */
  prompt: string;
  promptLang: "ja" | "vi";
  /**
   * Gợi ý CẦN để trả lời, luôn hiện dưới đề: câu dịch của câu điền từ, "nghĩa: …" của từ nhiều cách đọc.
   * Thông tin phụ (bài, loại từ, số nét…) → `info`.
   */
  hint: string | null;
  /** Thông tin phụ, ẩn sau icon ⓘ cạnh nhãn loại câu (hover / chạm): "Bài 15", "Tính từ い\nrẻ\nBài 8" ("\n" = xuống dòng). */
  info?: string | null;
  /** Câu dẫn riêng ("Đọc thế nào?"); không có → dùng câu dẫn chung của trang (prop `question` của QuizRunner). */
  question?: string;
  /** Đáp án hiện trong 4 lựa chọn (có thể chứa ruby). */
  answer: string;
  /** Cách trả lời đúng khác — không đưa vào lựa chọn, nhưng chấm là đúng và hiện ở phần giải thích. */
  accepted: string[];
  /** Đáp án nhiễu, "giống thật nhất" xếp trước; không chứa answer/accepted (checkDeck). */
  pool: string[];
  /** Giải thích hiện sau khi trả lời; "\n" = xuống dòng. */
  explain: string | null;
  /** Trang chi tiết, tương đối với BASE_URL, không có "/" đầu. */
  href: string;
  /** Giá trị để lọc: { level: "n5", lesson: [5, 30], group: "V1" }. Mảng = nhiều giá trị (khớp nếu một giá trị khớp). */
  tags: Record<string, TagValue | TagValue[]>;
}

/** File JSON tĩnh một deck (tải lười). */
export interface Deck {
  version: 1;
  name: string;
  items: QuizItem[];
}

/** Luật lọc một tag: danh sách giá trị cho phép, hoặc khoảng số (đóng hai đầu). */
export type TagRule = readonly TagValue[] | { min?: number; max?: number };
/** Lọc theo tag; khóa đặc biệt "kind" lọc theo QuizItem.kind. Thiếu khóa = không giới hạn. */
export type Filter = Record<string, TagRule>;

export interface Options {
  options: string[];
  /** Vị trí đáp án đúng trong options. */
  correct: number;
}
