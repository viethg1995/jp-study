// Mọi truy cập localStorage đi qua file này (CLAUDE.md luật 7, gate check:storage).
// Key phải có tiền tố jp: và đăng ký trong bảng ở .claude/rules/web.md.
// localStorage có thể bị chặn (chế độ riêng tư, iframe) → mọi thao tác bọc try/catch, lỗi thì bỏ qua.

export const KEYS = {
  sidebar: "jp:ui:sidebar", // "collapsed" | "expanded"
} as const;

export function readString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* bị chặn → bỏ qua, chỉ mất ghi nhớ */
  }
}

/** Đoạn script chạy inline trong <head> (trước khi vẽ trang) để áp trạng thái menu thu gọn,
 *  tránh menu "nháy" từ mở sang thu gọn. Giữ ở đây để mọi chỗ đọc localStorage nằm trong storage.ts. */
export const SIDEBAR_BOOT_SCRIPT = `try{if(localStorage.getItem("jp:ui:sidebar")==="collapsed")document.documentElement.classList.add("sidebar-collapsed")}catch(e){}`;
