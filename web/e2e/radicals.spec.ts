// E2E trang bộ thủ /kanji/bo-thu/<số>/: nhóm "Bộ chính của" / "Có mặt trong" theo cấp, lọc cấp bằng CSS,
// và liên kết ngược "Có bộ" trên trang chữ.
import { expect, test } from "./fixtures";

test.describe("/kanji/bo-thu/<số>/", () => {
  test("bộ 口 (30): hai nhóm, lọc N4 chỉ còn khối N4", async ({ page }) => {
    await page.goto("kanji/bo-thu/30/");
    await expect(page.locator("h1")).toHaveText("Bộ Khẩu");
    await expect(page.getByRole("region", { name: "Bộ chính của" })).toBeVisible();
    const parts = page.getByRole("region", { name: "Có mặt trong" });
    await expect(parts).toBeVisible();
    // 語 có 口 ở phần 吾 nhưng bộ chính là 言 → nằm ở "Có mặt trong"
    await expect(parts.locator('a[href$="/kanji/語/"]')).toHaveCount(1);

    await page.getByRole("radio", { name: "N4" }).check({ force: true });
    for (const lv of ["n5", "n3"]) await expect(page.locator(`.lvg[data-lv="${lv}"]`).first()).toBeHidden();
    await expect(page.locator('.lvg[data-lv="n4"]').first()).toBeVisible();

    await page.getByRole("radio", { name: "Tất cả" }).check({ force: true });
    await expect(page.locator('.lvg[data-lv="n5"]').first()).toBeVisible();
  });

  test("trang chữ 休: dòng 'Có bộ' dẫn tới bộ 木", async ({ page }) => {
    await page.goto("kanji/休/");
    const link = page.locator('a[href$="/kanji/bo-thu/75/"]');
    await expect(link).toBeVisible();
    await link.click();
    await expect(page.locator("h1")).toHaveText("Bộ Mộc");
    await expect(page.locator('a[href$="/kanji/休/"]')).toHaveCount(1);
  });
});
