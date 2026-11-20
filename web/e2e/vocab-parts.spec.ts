// E2E học theo phần ở trang bài từ vựng (LessonView + lib/vocab-parts.ts):
// bài 45 từ → 3 phần × 15; lọc ở Lưới và Từng thẻ, Trước/Sau quay vòng trong phần, URL ?phan=N; bài ngắn không có thanh phần.
import { expect, test } from "./fixtures";

const visibleCards = ".word-list .word-card:visible";

test("Minna bài 1: chọn phần → chỉ hiện 15 thẻ của phần, URL ?phan=2", async ({ page }) => {
  await page.goto("vocabulary/1/");
  await expect(page.locator("#part-all")).toBeChecked();
  await expect(page.locator(visibleCards)).toHaveCount(45);
  await expect(page.locator("label:has(#part-3)")).toHaveText("Phần 3 (15)");

  await page.locator("label:has(#part-2)").click();
  await expect(page).toHaveURL(/\?phan=2(#mn-01-016)?$/); // về thẻ đầu phần → #id của thẻ đó
  await expect(page.locator(visibleCards)).toHaveCount(15);
  await expect(page.locator(visibleCards).first()).toHaveAttribute("id", "mn-01-016");

  await page.locator("label:has(#part-all)").click();
  await expect(page).not.toHaveURL(/phan=/);
  await expect(page.locator(visibleCards)).toHaveCount(45);
});

test("Từng thẻ + ?phan=3: bắt đầu ở thẻ đầu phần, Trước quay vòng về thẻ cuối phần", async ({ page }) => {
  await page.goto("vocabulary/1/?phan=3");
  await expect(page.locator("#part-3")).toBeChecked();
  await page.locator("label:has(#view-single)").click();
  const current = page.locator(visibleCards);
  await expect(current).toHaveCount(1);
  await expect(current).toHaveAttribute("id", "mn-01-031");
  await expect(current.locator(".card-pos")).toHaveText("1 / 15");

  await current.getByRole("link", { name: /Trước/ }).click();
  await expect(page.locator(visibleCards)).toHaveAttribute("id", "mn-01-045");
  await expect(page.locator(visibleCards).locator(".card-pos")).toHaveText("15 / 15");
  await page.locator(visibleCards).getByRole("link", { name: /Sau/ }).click();
  await expect(page.locator(visibleCards)).toHaveAttribute("id", "mn-01-031");
});

test("Ngẫu nhiên chỉ xáo trong phần", async ({ page }) => {
  await page.goto("vocabulary/1/?phan=1");
  await page.locator("label:has(#view-single)").click();
  await page.locator("label:has(#order-random)").click();
  for (let i = 0; i < 15; i++) {
    const id = await page.locator(visibleCards).getAttribute("id");
    expect(Number(id?.slice(-3))).toBeLessThanOrEqual(15);
    await expect(page.locator(visibleCards).locator(".card-pos")).toHaveText(`${i + 1} / 15`);
    await page.locator(visibleCards).getByRole("link", { name: /Sau/ }).click();
  }
});

test("bài ngắn (Minna bài 25, 9 từ) không có thanh chọn phần", async ({ page }) => {
  await page.goto("vocabulary/25/");
  await expect(page.locator('input[name="part"]')).toHaveCount(0);
  await expect(page.locator(visibleCards)).toHaveCount(9);
});
