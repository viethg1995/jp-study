// E2E trang bộ thủ /kanji/bo-thu/<số>/: nhóm "Bộ chính của" / "Có mặt trong" theo cấp, lọc cấp bằng CSS,
// liên kết ngược "Có bộ" trên trang chữ, nút bộ trước / sau và link luyện tập theo nhóm số nét.
import { expect, startQuiz, test } from "./fixtures";

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

test.describe("bộ thủ: trước / sau + luyện tập theo số nét", () => {
  test("bộ 30 → Sau → bộ kế → Trước → về bộ 30; bộ 1 không có Trước", async ({ page }) => {
    await page.goto("kanji/bo-thu/30/");
    await page.locator("[data-rad-next]").click();
    await expect(page).toHaveURL(/kanji\/bo-thu\/31\/$/);
    await expect(page.locator("h1")).toHaveText("Bộ Vi");
    await page.locator("[data-rad-prev]").click();
    await expect(page).toHaveURL(/kanji\/bo-thu\/30\/$/);

    await page.goto("kanji/bo-thu/1/");
    await expect(page.locator("[data-rad-prev]")).toHaveCount(0);
    await expect(page.locator("[data-rad-next]")).toBeVisible();
  });

  test("danh sách: Luyện tập → nhóm 3 nét mở quiz lọc đúng 31 bộ", async ({ page }) => {
    await page.goto("kanji/bo-thu/");
    await expect(page.locator("[data-group-quiz]")).toHaveCount(17);
    await page.locator("#net-3 [data-group-quiz]").click();
    await expect(page).toHaveURL(/kanji\/bo-thu\/quiz\/\?pham-vi=tat-ca&net-tu=3&net-den=3/);
    await expect(page.locator("#q-snet-from")).toHaveValue("3");
    await expect(page.locator("#q-snet-to")).toHaveValue("3");
    await expect(page.locator("#pv-tat-ca")).toBeChecked();
    await expect(page.locator("[data-radical-count]")).toHaveText("Đang chọn: 31 bộ");
    await startQuiz(page);
  });

  test("trang chi tiết: Luyện nhóm N nét dẫn tới quiz đúng số nét", async ({ page }) => {
    await page.goto("kanji/bo-thu/30/");
    const link = page.locator("[data-group-quiz]");
    await expect(link).toHaveText(/Luyện nhóm 3 nét/);
    await link.click();
    await expect(page.locator("#q-snet-from")).toHaveValue("3");
    await expect(page.locator("#q-snet-to")).toHaveValue("3");
  });
});
