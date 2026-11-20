// @ts-check
import { readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages: đặt khi deploy, vd SITE_URL=https://<user>.github.io BASE_PATH=/<repo>
// Chạy local: mặc định site localhost, base "/".
const SITE = process.env.SITE_URL ?? "http://localhost:4321";
const BASE = process.env.BASE_PATH ?? "/";

/**
 * Ghi dist/sitemap.xml từ danh sách trang HTML đã build (không cần thêm dependency).
 * Bỏ trang 404 và endpoint có đuôi file (.json, .txt).
 * @returns {import("astro").AstroIntegration}
 */
function sitemap() {
  return {
    name: "jp-sitemap",
    hooks: {
      "astro:build:done": ({ dir, pages, logger }) => {
        const root = new URL(BASE.replace(/\/?$/, "/"), SITE);
        const esc = (/** @type {string} */ s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
        const urls = pages
          .map((p) => p.pathname.replace(/^\//, ""))
          .filter((p) => !/^404\/?$/.test(p) && !/\.[a-z0-9]+\/?$/i.test(p))
          .map((p) => new URL(p === "" || p.endsWith("/") ? p : `${p}/`, root).href)
          .sort();
        const xml =
          '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join("\n") +
          "\n</urlset>\n";
        writeFileSync(new URL("sitemap.xml", dir), xml, "utf-8");
        logger.info(`sitemap.xml: ${urls.length} URL`);
      },
    },
  };
}

/**
 * CSS của fontsource khai báo mỗi subset 2 bản: woff2 + woff. Mọi trình duyệt còn hỗ trợ đều đọc woff2,
 * nên sau khi build: bỏ `url(...woff) format("woff")` khỏi các file CSS và xóa file .woff không còn ai dùng.
 * CSS font nhẹ hơn khoảng 30%, dist/ nhẹ hơn khoảng một nửa.
 * @returns {import("astro").AstroIntegration}
 */
function fontsWoff2Only() {
  return {
    name: "jp-fonts-woff2-only",
    hooks: {
      "astro:build:done": ({ dir, logger }) => {
        const assets = join(fileURLToPath(dir), "_astro");
        const files = readdirSync(assets);
        const woffRef = /,\s*url\([^)]*?\.woff\)\s*format\(["']?woff["']?\)/g;
        let stripped = 0;
        const cssTexts = [];
        for (const f of files.filter((n) => n.endsWith(".css"))) {
          const path = join(assets, f);
          const css = readFileSync(path, "utf-8");
          const out = css.replace(woffRef, () => (stripped++, ""));
          if (out !== css) writeFileSync(path, out, "utf-8");
          cssTexts.push(out);
        }
        const allCss = cssTexts.join("\n");
        let removed = 0;
        for (const f of files.filter((n) => n.endsWith(".woff"))) {
          if (allCss.includes(f)) continue; // vẫn còn CSS tham chiếu → giữ
          unlinkSync(join(assets, f));
          removed++;
        }
        logger.info(`woff2-only: bỏ ${stripped} tham chiếu .woff, xóa ${removed} file .woff`);
      },
    },
  };
}

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: "ignore",
  integrations: [sitemap(), fontsWoff2Only()],
  vite: {
    plugins: [tailwindcss()],
  },
});
