// @ts-check
import { writeFileSync } from "node:fs";
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

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: "ignore",
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
