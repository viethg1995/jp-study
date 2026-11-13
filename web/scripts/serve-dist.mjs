// Server tĩnh cho dist/ — dùng cho test e2e (playwright.config.ts). Không dùng `astro preview`
// vì bản Astro này chạy preview kiểu nền và từ chối khởi động khi đã có một server preview khác.
// Phục vụ dưới BASE_PATH (mặc định "/") giống GitHub Pages; thư mục → index.html; không thấy → 404.html.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const PORT = Number(process.env.PORT ?? 4400);
const BASE = (process.env.BASE_PATH ?? "/").replace(/\/?$/, "/");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

if (!existsSync(join(DIST, "index.html"))) {
  console.error("serve-dist: chưa có web/dist — chạy `npm run build` trước khi `npm run test:e2e`.");
  process.exit(1);
}

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  if (!path.startsWith(BASE)) {
    res.writeHead(404).end();
    return;
  }
  let file = normalize(join(DIST, path.slice(BASE.length)));
  if (!file.startsWith(DIST)) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  const found = existsSync(file);
  const body = readFileSync(found ? file : join(DIST, "404.html"));
  res.writeHead(found ? 200 : 404, { "Content-Type": TYPES[extname(found ? file : ".html")] ?? "application/octet-stream" });
  res.end(body);
}).listen(PORT, () => console.log(`serve-dist: http://localhost:${PORT}${BASE}`));
