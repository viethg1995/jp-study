// E2E nút "↑ Lên đầu" dùng chung (components/layout/BackToTop.astro, gắn trong Base): desktop + mobile.
import { expect, test } from "./fixtures";

test("nút lên đầu: ẩn ở đầu trang, hiện khi cuộn, bấm về đầu", async ({ page }) => {
  await page.goto("vocabulary/n3/3/");
  const btn = page.locator("[data-back-to-top]");
  await expect(btn).toBeHidden();
  await page.evaluate(() => scrollTo(0, 2000));
  await expect(btn).toBeVisible();
  await btn.click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expect(btn).toBeHidden();
});
