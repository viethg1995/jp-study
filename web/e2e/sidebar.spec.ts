// E2E menu trái (Sidebar): tải trang luôn mở rộng (bỏ qua trạng thái cũ jp:ui:sidebar), nhóm mục con mặc định đóng
// (kể cả nhóm chứa trang đang xem), thu gọn rồi mở lại → mọi nhóm đóng lại như ban đầu.
import { expect, test } from "./fixtures";

const groups = "#sidebar .nav-children";

test("tải trang: menu mở rộng, mọi nhóm mục con đóng (kể cả nhóm đang xem)", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "nút thu gọn chỉ có trên desktop");
  // Trình duyệt người dùng cũ còn lưu "collapsed" → không còn tác dụng
  await page.addInitScript(() => localStorage.setItem("jp:ui:sidebar", "collapsed"));
  await page.goto("kanji/n5/");
  await expect(page.locator("html")).not.toHaveClass(/sidebar-collapsed/);
  await expect(page.locator("#sidebar-toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(groups).first()).toBeAttached();
  for (const ul of await page.locator(groups).all()) await expect(ul).toBeHidden();
  await expect(page.locator('#sidebar a.nav-child[aria-current="page"]')).toBeHidden();
});

test("bấm ▾ xổ nhóm; thu gọn rồi mở lại → nhóm đóng lại", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "nút thu gọn chỉ có trên desktop");
  await page.goto("");
  const kanji = page.locator('label[for="nav-group-kanji"]');
  const vocab = page.locator('label[for="nav-group-vocabulary"]');
  await kanji.click();
  await vocab.click();
  await expect(page.locator(`${groups}:visible`)).toHaveCount(2);

  const toggle = page.locator("#sidebar-toggle");
  await toggle.click();
  await expect(page.locator("html")).toHaveClass(/sidebar-collapsed/);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(page.locator("html")).not.toHaveClass(/sidebar-collapsed/);
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(`${groups}:visible`)).toHaveCount(0);
});

test("mobile: mở ☰ → nhóm đóng, bấm ▾ thì xổ; đóng ☰ rồi mở lại → nhóm đóng lại", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "menu trượt chỉ có trên mobile");
  await page.goto("kanji/n5/");
  await page.locator(".nav-burger").click();
  await expect(page.locator(`${groups}:visible`)).toHaveCount(0);
  await page.locator('label[for="nav-group-kanji"]').click();
  await page.locator('label[for="nav-group-vocabulary"]').click();
  await expect(page.locator(`${groups}:visible`)).toHaveCount(2);
  await expect(page.locator('#sidebar a.nav-child[aria-current="page"]')).toBeVisible();

  // Đóng bằng nền mờ (bấm phía phải, ngoài menu) rồi mở lại
  await page.locator(".nav-backdrop").click({ position: { x: 360, y: 400 } });
  await expect(page.locator("#nav-open")).not.toBeChecked();
  await page.locator(".nav-burger").click();
  await expect(page.locator(`${groups}:visible`)).toHaveCount(0);
});
