// E2E trang Từ nối /tu-noi/ (STATUS mục 8): danh sách nhóm theo chức năng, lọc loại / cấp bằng CSS, neo #cn-…,
// "Dùng thay được", link từ vựng, menu; mobile: thanh lọc dính + chip nhóm, thẻ thu gọn câu ví dụ, nút lên đầu, không cuộn ngang.
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
  await expect(noni).toContainText("Cấu trúc:");
  await expect(noni.locator(".cn-structure .font-bold")).toHaveText("〜のに、〜。");
  // mục lục: mẫu nối vế hiện khung câu, từ nối câu hiện chữ trần
  await expect(page.locator('.cn-index a[href="#cn-shi"]')).toHaveText("〜し、〜し、〜");
  await expect(page.locator('.cn-index a[href="#cn-soshite"]')).toHaveText("そして");
  await expect(noni.locator(".cn-examples li")).toHaveCount(3);
  // mobile: câu ví dụ thu gọn → mở bằng nút "Ví dụ (3)"
  const toggle = noni.locator(".cn-toggle");
  if (await toggle.isVisible()) await toggle.click();
  await expect(noni.locator(".sentence .target").first()).toHaveText("のに");
  await expect(noni.locator("ruby").first()).toBeVisible();
  // không hiện thông tin biên tập
  await expect(page.locator("main")).not.toContainText(/ai-draft|chờ duyệt/);
});

test("lọc loại + cấp bằng CSS; nhóm rỗng và mục lục ẩn theo", async ({ page }) => {
  test.slow(); // 75 thẻ × nhiều lần đếm :visible — quá 30s khi máy bận
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

// Từ 2026-11-22 mọi tổ hợp loại × cấp đều có mục (nối mệnh đề N3: うちに, ところに…) → không nút lọc nào bị ẩn.
// Logic ẩn nút lọc của tổ hợp rỗng (biến `missing` ở tu-noi/index.astro) vẫn giữ cho dữ liệu sau này.
test("tổ hợp nối mệnh đề × N3 có mục → nút lọc hiện, không ra trang trống", async ({ page }) => {
  await page.goto("tu-noi/");
  const n3 = page.locator("label:has(#tn-l-n3)");
  const clause = page.locator("label:has(#tn-t-clause)");
  await clause.click();
  await expect(n3).toBeVisible();
  await n3.click();
  await expect(page.locator("#cn-uchini")).toBeVisible();
  await expect(page.locator("#cn-soreni")).toBeHidden();
  for (const card of await page.locator(visible).all()) {
    await expect(card).toHaveAttribute("data-type", "clause");
    await expect(card).toHaveAttribute("data-level", "n3");
  }
  await expect(page.locator("section.cn-group:visible").first()).toBeVisible();
});

test("neo, Dùng thay được, link từ vựng, menu", async ({ page }) => {
  await page.goto("tu-noi/#cn-demo");
  await expect(page.locator("#cn-demo")).toBeInViewport();
  await page.locator("#cn-demo footer a", { hasText: "しかし" }).click();
  await expect(page).toHaveURL(/#cn-shikashi$/);
  await expect(page.locator("#cn-shikashi")).toBeInViewport();
  // vào bằng neo → thẻ đích tự mở (mobile thu gọn mặc định)
  await expect(page.locator("#cn-shikashi .cn-examples")).toBeVisible();
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

test.describe("mobile", () => {
  test.use({ viewport: { width: 375, height: 740 } });

  test("thẻ thu gọn câu ví dụ, bấm để mở / thu gọn; trang ngắn lại", async ({ page }) => {
    await page.goto("tu-noi/");
    const kara = page.locator("#cn-kara");
    await expect(kara.locator(".cn-examples")).toBeHidden();
    await expect(kara.locator(".cn-toggle")).toHaveText(/Ví dụ \(3\)/);
    await kara.locator(".cn-toggle").click();
    await expect(kara.locator(".cn-examples")).toBeVisible();
    await expect(kara.locator(".cn-toggle")).toHaveText(/Thu gọn/);
    await kara.locator(".cn-toggle").click();
    await expect(kara.locator(".cn-examples")).toBeHidden();
    // so với khi mở hết câu ví dụ (không dùng ngưỡng px cứng — tăng theo số mục); đo 2026-11-22: ~14.000 / ~30.000px
    const collapsed = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.addStyleTag({ content: ".cn-card .cn-examples { display: block !important; }" });
    const expanded = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(collapsed).toBeLessThan(expanded * 0.6);
  });

  test("thanh lọc dính khi cuộn; chip nhóm nhảy tới nhóm không bị che; nút lên đầu", async ({ page }) => {
    await page.goto("tu-noi/");
    const toTop = page.locator("[data-back-to-top]");
    await expect(toTop).toBeHidden();
    await page.evaluate(() => scrollTo(0, 4000));
    await expect(page.locator(".cn-bar")).toBeInViewport();
    await expect(toTop).toBeVisible();
    // đổi lọc ngay giữa trang, không cần cuộn lên
    await page.locator("label:has(#tn-t-clause)").click();
    await expect(page.locator(".cn-chips a", { hasText: "Lựa chọn" })).toBeHidden();
    await page.locator("label:has(#tn-t-all)").click();
    await page.locator(".cn-chips a", { hasText: "Đối lập" }).click();
    await expect(page).toHaveURL(/#fn-contrast$/);
    const heading = page.locator("#fn-contrast");
    const barBottom = await page.locator(".cn-bar").evaluate((e) => e.getBoundingClientRect().bottom);
    const headTop = await heading.evaluate((e) => e.getBoundingClientRect().top);
    expect(headTop).toBeGreaterThanOrEqual(barBottom - 1);
    await toTop.click();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  });

  test("desktop không có nút thu gọn (luôn mở)", async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(new URL("tu-noi/", test.info().project.use.baseURL).href);
    await expect(page.locator("#cn-kara .cn-toggle")).toBeHidden();
    await expect(page.locator("#cn-kara .cn-examples")).toBeVisible();
    await expect(page.locator(".cn-chips")).toBeHidden();
    await expect(page.locator(".cn-index")).toBeVisible();
    await page.close();
  });
});
