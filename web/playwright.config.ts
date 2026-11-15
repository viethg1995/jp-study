// Test e2e trên bản build tĩnh (dist/). Chạy: npm run build && npm run test:e2e
// Lần đầu trên máy mới: npx playwright install --only-shell chromium
import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 4400);
const BASE = (process.env.BASE_PATH ?? "/").replace(/\/?$/, "/");

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  // Giới hạn worker + nới thời gian chờ: máy dev hay bận việc khác (đã gặp load ~97 làm test chập chờn)
  workers: process.env.CI ? 2 : 4,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  outputDir: "test-results",
  use: {
    baseURL: `http://localhost:${PORT}${BASE}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1280, height: 900 } } },
    { name: "mobile", use: { browserName: "chromium", viewport: { width: 375, height: 800 }, hasTouch: true } },
  ],
  webServer: {
    command: "node scripts/serve-dist.mjs",
    url: `http://localhost:${PORT}${BASE}`,
    env: { PORT: String(PORT), BASE_PATH: BASE },
    reuseExistingServer: !process.env.CI,
  },
});
