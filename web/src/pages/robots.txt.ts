// robots.txt trỏ tới sitemap (sitemap.xml do integration trong astro.config.mjs ghi lúc build).
// Lưu ý: site dạng <user>.github.io/<repo>/ thì Google chỉ đọc robots.txt ở gốc domain —
// file này vẫn hữu ích khi dùng domain riêng; còn không thì nộp sitemap qua Search Console.
import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
  const sitemap = site ? new URL(`${base}sitemap.xml`, site).href : `${base}sitemap.xml`;
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
