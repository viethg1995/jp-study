// Nạp bằng `node --import ./scripts/register-ts.mjs --test …` (script "test" trong package.json).
// Code trong src/ import không có đuôi (`./counters`) theo kiểu Vite, còn Node chỉ nhận đường dẫn đủ đuôi.
// Hook này thử lần lượt `.ts`, `/index.ts` khi import tương đối không tìm thấy. Astro/Vite không đi qua file này.
// registerHooks (đồng bộ) có từ Node 22.15 — package.json yêu cầu ≥ 22.18.
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (err) {
      const relative = specifier.startsWith("./") || specifier.startsWith("../");
      if (!relative || err?.code !== "ERR_MODULE_NOT_FOUND" || /\.[cm]?[jt]s$/.test(specifier)) throw err;
      for (const suffix of [".ts", "/index.ts"]) {
        try {
          return next(specifier + suffix, context);
        } catch {
          // thử đuôi tiếp theo
        }
      }
      throw err;
    }
  },
});
