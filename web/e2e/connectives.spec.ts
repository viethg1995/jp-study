// E2E trang Từ nối /tu-noi/ (STATUS mục 8): danh sách nhóm theo chức năng, lọc loại / cấp bằng CSS, neo #cn-…,
// "Dùng thay được", link từ vựng, menu, mobile không cuộn ngang.
import { expect, test } from "./fixtures";

const visible = "article.cn-card:visible";

test("trang Từ nối: đủ mục, nhóm chức năng, ví dụ có furigana và tô từ nối", async ({ page }) => {
  await page.goto("tu-noi/");
  await expect(page.locator("h1")).toHaveText("Từ nối");
  await expect(page.locator("h1")).toHaveCount(1);
  const total = await page.locator("article.cn-card").count();
  expect(total).toBeGreaterThanOrEqual(40);
  await expect(page.locator("section.cn-group h2", { hasText: "Đối lập" })).toBeVisible();
  const noni = page.locator("#cn-noni");
  await expect(noni.locator("h3")).toHaveText("のに");
  await expect(noni).toContainText("thế mà");
  await expect(noni).toContainText("Cách nối:");
  await expect(noni.locator(".cn-examples li")).toHaveCount(3);
  await expect(noni.locator(".sentence .target").first()).toHaveText("のに");
  await expect(noni.locator("ruby").first()).toBeVisible();
  // không hiện thông tin biên tập
  await expect(page.locator("main")).not.toContainText(/ai-draft|chờ duyệt/);
});

test("lọc loại + cấp bằng CSS; nhóm rỗng và mục lục ẩn theo", async ({ page }) => {
  await page.goto("tu-noi/");
  const total = await page.locator(visible).count();
  await page.locator("label:has(#tn-t-clause)").click();
  const clause = await page.locator(visible).count();
  expect(clause).toBeGreaterThan(0);
  expect(clause).toBeLessThan(total);
  await expect(page.locator("#cn-soshite")).toBeHidden();
  await expect(page.locator("#cn-noni")).toBeVisible();
  // Lựa chọn: chỉ có từ nối câu (または, それとも) → nhóm ẩn khi lọc "Nối mệnh đề"
  await expect(page.locator("section.cn-group", { hasText: "Lựa chọn" })).toBeHidden();
  await page.locator("label:has(#tn-l-n5)").click();
  await expect(page.locator("#cn-noni")).toBeHidden(); // のに: N4
  await expect(page.locator("#cn-kara")).toBeVisible();
  for (const card of await page.locator(visible).all()) {
    await expect(card).toHaveAttribute("data-type", "clause");
    await expect(card).toHaveAttribute("data-level", "n5");
  }
  await expect(page.locator(".cn-index a:visible", { hasText: "のに" })).toHaveCount(0);
  await page.locator("label:has(#tn-t-all)").click();
  await page.locator("label:has(#tn-l-all)").click();
  await expect(page.locator(visible)).toHaveCount(total);
});

test("tổ hợp không có mục (nối mệnh đề N3) → ẩn nút lọc, không ra trang trống", async ({ page }) => {
  await page.goto("tu-noi/");
  const n3 = page.locator("label:has(#tn-l-n3)");
  const clause = page.locator("label:has(#tn-t-clause)");
  await clause.click();
  await expect(n3).toBeHidden();
  await expect(page.locator("label:has(#tn-l-n5)")).toBeVisible();
  await page.locator("label:has(#tn-t-all)").click();
  await expect(n3).toBeVisible();
  await n3.click();
  await expect(clause).toBeHidden();
  await expect(page.locator(visible).first()).toBeVisible();
  await expect(page.locator(".cn-index")).toBeVisible();
});

test("neo, Dùng thay được, link từ vựng, menu", async ({ page }) => {
  await page.goto("tu-noi/#cn-demo");
  await expect(page.locator("#cn-demo")).toBeInViewport();
  await page.locator("#cn-demo footer a", { hasText: "しかし" }).click();
  await expect(page).toHaveURL(/#cn-shikashi$/);
  await expect(page.locator("#cn-shikashi")).toBeInViewport();
  await page.locator("#cn-demo footer a", { hasText: "Từ vựng bài 19" }).click();
  await expect(page).toHaveURL(/\/vocabulary\/19\/#mn-19-019$/);
  await page.goto("./");
  await expect(page.locator(`a[href$="tu-noi/"]`).first()).toBeAttached();
});

test("mobile: không cuộn ngang", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("tu-noi/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
