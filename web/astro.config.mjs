// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages: đặt khi deploy, vd SITE_URL=https://<user>.github.io BASE_PATH=/<repo>
// Chạy local: mặc định site localhost, base "/".
export default defineConfig({
  site: process.env.SITE_URL ?? "http://localhost:4321",
  base: process.env.BASE_PATH ?? "/",
  trailingSlash: "ignore",
  vite: {
    plugins: [tailwindcss()],
  },
});
