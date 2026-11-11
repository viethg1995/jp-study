// Cấu hình menu — nguồn duy nhất cho thanh menu bên trái (Sidebar) và các thẻ phần học ở trang chủ.
// Icon là chữ Hán (glyph) mang nghĩa của phần học. Mục chưa có trang: href = null → hiện "Sắp có".

export interface NavChild {
  label: string;
  href: string; // tương đối với BASE_URL, không có "/" đầu
}

export interface NavItem {
  id: string;
  label: string;
  glyph: string; // chữ Hán làm icon
  glyphMeaning: string; // giải thích icon (tooltip)
  description: string; // mô tả ngắn cho thẻ ở trang chủ
  href: string | null;
  children?: NavChild[];
  home?: boolean; // chỉ hiện ở menu, không làm thẻ trang chủ
}

export const NAV: NavItem[] = [
  { id: "home", label: "Trang chủ", glyph: "家", glyphMeaning: "家 — nhà", description: "", href: "", home: true },
  {
    id: "vocabulary",
    label: "Từ vựng",
    glyph: "語",
    glyphMeaning: "語 — ngôn ngữ, từ",
    description: "Từ vựng theo bài: kanji, furigana, âm Hán-Việt, câu ví dụ, flashcard",
    href: "vocabulary/",
    children: [
      { label: "N5 · Bài 1–25", href: "vocabulary/#n5" },
      { label: "N4 · Bài 26–50", href: "vocabulary/#n4" },
      { label: "N3 · Bài 1–14", href: "vocabulary/#n3" },
    ],
  },
  {
    id: "kanji",
    label: "Kanji",
    glyph: "字",
    glyphMeaning: "字 — chữ",
    description: "Chữ Hán trong từ vựng: âm On/Kun, Hán-Việt, bộ thủ, số nét",
    href: "kanji/",
    children: [
      { label: "N5", href: "kanji/#gt-n5" },
      { label: "N4", href: "kanji/#gt-n4" },
      { label: "N3", href: "kanji/#gt-n3" },
      { label: "Bộ thủ", href: "kanji/bo-thu/" },
    ],
  },
  {
    id: "conjugation",
    label: "Chia thể",
    glyph: "活",
    glyphMeaning: "活 — 活用: chia thể",
    description: "Chia động từ, tính từ, danh từ từ thể ます theo cách học ở Việt Nam",
    href: "chia-the/",
    children: [
      { label: "Quy tắc", href: "chia-the/" },
      { label: "Động từ", href: "chia-the/dong-tu/" },
      { label: "Tính từ い", href: "chia-the/tinh-tu-i/" },
      { label: "Tính từ な", href: "chia-the/tinh-tu-na/" },
    ],
  },
  {
    id: "counters",
    label: "Đếm số",
    glyph: "数",
    glyphMeaning: "数 — số",
    description: "Số đếm, trợ số từ (～人, ～枚, ～本…), biến âm và ví dụ",
    href: "dem-so/",
    children: [
      { label: "Trợ số từ", href: "dem-so/" },
      { label: "Số đếm", href: "dem-so/so-dem/" },
      { label: "Biến âm", href: "dem-so/bien-am/" },
    ],
  },
  {
    id: "conjunctions",
    label: "Từ nối",
    glyph: "接",
    glyphMeaning: "接 — 接続詞: từ nối",
    description: "Từ nối thường gặp: ý nghĩa, cách dùng, ví dụ",
    href: null,
  },
];

/** Mục đang mở: so đường dẫn hiện tại (đã bỏ BASE_URL) với href. */
export function isActive(item: NavItem, path: string): boolean {
  if (item.href === null) return false;
  if (item.home) return path === "" || path === "/";
  return path.replace(/^\//, "").startsWith(item.href);
}
