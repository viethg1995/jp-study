// Hằng số + tiện ích SEO dùng chung (Base.astro và các trang tự soạn description).

export const SITE_NAME = "日本語 · Học tiếng Nhật";
export const SITE_TAGLINE = "Học tiếng Nhật N5–N3 cho người Việt";
export const DEFAULT_DESCRIPTION =
  "Học tiếng Nhật miễn phí cho người Việt theo giáo trình みんなの日本語 N5–N4 và N3: từ vựng có ví dụ, Kanji (âm Hán-Việt, On/Kun, thứ tự nét), chia thể động từ – tính từ, trợ số từ và cách đếm.";

/** Gộp khoảng trắng và cắt ở ranh giới từ cho vừa meta description (~160 ký tự). */
export function clip(text: string, max = 160): string {
  const s = text.replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:·–-]+$/, "")}…`;
}

/** Bỏ cú pháp ruby {漢字|かな} → 漢字. */
export const plainRuby = (r: string): string => r.replace(/\{([^{}|]+)\|[^{}|]+\}/g, "$1");
