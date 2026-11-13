// E2E trang tổng /luyen-tap/ (Q8): bộ lọc bài + phần ↔ URL, chỉ tải file của cấp/phần đã chọn, trộn đều theo phần,
// nhãn góc thẻ, khóa/thu gọn khi làm bài, menu + thẻ trang chủ, SEO.
import { backToSetup, expect, optionHeights, startQuiz, test } from "./fixtures";

const kind = '[data-q="kind"]';

/** Tên file JSON được tải (theo thứ tự yêu cầu). */
function trackJson(page: import("@playwright/test").Page): string[] {
  const loaded: string[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith(".json")) loaded.push(new URL(r.url()).pathname.replace(/^.*?\/(vocabulary|kanji|chia-the|luyen-tap)\//, "$1/"));
  });
  return loaded;
}

test("mặc định: bài 1–25, đủ 4 phần; bấm Bắt đầu mới tải, chỉ file N5", async ({ page }) => {
  const loaded = trackJson(page);
  await page.goto("luyen-tap/");
  await expect(page).toHaveURL(/\?tu=1&den=25$/);
  await expect(page.locator("#q-from")).toHaveValue("1");
  await expect(page.locator("#q-to")).toHaveValue("25");
  for (const p of ["tu-vung", "kanji", "chia-the", "dem-so"]) await expect(page.locator(`#phan-${p}`)).toBeChecked();
  expect(loaded).toEqual([]);
  await startQuiz(page);
  expect(loaded).toHaveLength(10);
  expect(loaded.filter((f) => /n4/.test(f))).toEqual([]);
  expect(loaded).toContain("luyen-tap/dem-so.json");
  await expect(page.locator(".q-opt")).toHaveCount(4);
});

test("lượt 20 câu: mỗi phần 5 câu; nhãn góc thẻ ghi phần · loại câu", async ({ page }) => {
  await page.goto("luyen-tap/?tu=1&den=50");
  await page.locator("label:has(#q-size-20)").click();
  await startQuiz(page);
  const parts: Record<string, number> = {};
  for (let i = 0; i < 20; i++) {
    const label = (await page.locator(kind).textContent()) ?? "";
    expect(label).toMatch(/^(Từ vựng · (Đọc|Nghĩa|Điền từ)|Kanji · (Hán-Việt|Nghĩa|Cách đọc)|Chia thể · (Chia|Nhận thể)|Đếm số)$/);
    const part = label.split(" · ")[0]!;
    parts[part] = (parts[part] ?? 0) + 1;
    await page.keyboard.press("1");
    await page.keyboard.press("Enter");
  }
  expect(parts).toEqual({ "Từ vựng": 5, Kanji: 5, "Chia thể": 5, "Đếm số": 5 });
});

test("URL ?tu=30&den=32&phan=kanji → chỉ tải Kanji N4, chỉ hỏi Kanji", async ({ page }) => {
  const loaded = trackJson(page);
  await page.goto("luyen-tap/?tu=30&den=32&phan=kanji");
  await expect(page.locator("#phan-tu-vung")).not.toBeChecked();
  await expect(page.locator("#phan-kanji")).toBeChecked();
  await startQuiz(page);
  expect(loaded.sort()).toEqual(["kanji/quiz/tv-n4-doc.json", "kanji/quiz/tv-n4-hv.json", "kanji/quiz/tv-n4-nghia.json"]);
  for (let i = 0; i < 5; i++) {
    await expect(page.locator(kind)).toHaveText(/^Kanji · /);
    await expect(page.locator('[data-q="info"]')).toContainText(/Bài 3[0-2]/);
    await page.keyboard.press("1");
    await page.keyboard.press("Enter");
  }
});

test("đổi bộ lọc → URL cập nhật; 'từ' lớn hơn 'đến' kéo 'đến' theo", async ({ page }) => {
  await page.goto("luyen-tap/");
  await page.locator("label:has(#phan-dem-so)").click();
  await expect(page).toHaveURL(/phan=tu-vung,kanji,chia-the$/);
  await page.locator("#q-from").selectOption("30");
  await expect(page.locator("#q-to")).toHaveValue("30");
  await expect(page).toHaveURL(/tu=30&den=30/);
});

test("Chia thể trên trang tổng: gợi ý có nhóm từ; Đếm số hỏi 'Đọc thế nào?'", async ({ page }) => {
  await page.goto("luyen-tap/?phan=chia-the");
  await startQuiz(page);
  await expect(page.locator('[data-q="info"]')).toHaveText(/^(Động từ|Tính từ い|Tính từ な)/);
  await backToSetup(page);
  await page.goto("luyen-tap/?phan=dem-so");
  await startQuiz(page);
  await expect(page.locator('[data-q="question"]')).toHaveText("Đọc thế nào?");
});

test("bỏ hết phần → Bắt đầu báo rỗng, tùy chọn vẫn mở", async ({ page }) => {
  await page.goto("luyen-tap/");
  for (const p of ["tu-vung", "kanji", "chia-the", "dem-so"]) await page.locator(`label:has(#phan-${p})`).click();
  await page.locator('[data-q="start"]').click();
  await expect(page.locator('[data-q="empty"]')).toBeVisible();
  await expect(page.locator("#phan-kanji")).toBeEnabled();
});

test("đang làm bài: khung thu gọn còn tóm tắt + Furigana; Đổi tùy chọn → mở lại", async ({ page }) => {
  await page.goto("luyen-tap/?tu=1&den=10&phan=tu-vung,kanji");
  await startQuiz(page);
  await expect(page.locator('[data-q="locked-summary"]')).toHaveText("Bài: 1 – 10 · Phần: Từ vựng, Kanji · Số câu: 10");
  await expect(page.locator(".quiz-options > *:visible")).toHaveCount(1);
  await expect(page.locator("#q-from")).toBeDisabled();
  await backToSetup(page);
  await expect(page.locator("#q-from")).toBeEnabled();
});

test("menu và thẻ trang chủ dẫn tới /luyen-tap/; link luyện sâu từng phần", async ({ page }) => {
  await page.goto("");
  await page.locator('main a[href$="/luyen-tap/"]').click();
  await expect(page).toHaveURL(/\/luyen-tap\//);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /từ vựng, Kanji, chia thể, đếm số/);
  await expect(page.locator('#sidebar a[href$="/luyen-tap/"]')).toHaveCount(1);
  await page.locator('[data-part-page="kanji"]').click();
  await expect(page).toHaveURL(/\/kanji\/quiz\//);
});

test("không cuộn ngang; điều khiển 32px", async ({ page }) => {
  await page.goto("luyen-tap/");
  expect(new Set(await optionHeights(page))).toEqual(new Set([32]));
  await startQuiz(page);
  await page.keyboard.press("1");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("ô ⓘ thông tin: ẩn mặc định; bấm/chạm → hiện bài + loại từ, bấm lại hoặc Esc → ẩn; sang câu mới → đóng", async ({ page }) => {
  await page.goto("luyen-tap/?phan=chia-the");
  await startQuiz(page);
  const btn = page.locator('[data-q="info-btn"]');
  const pop = page.locator('[data-q="info"]');
  await expect(btn).toBeVisible();
  await expect(pop).toBeHidden();
  await expect(page.locator('[data-q="hint"]')).toBeHidden(); // chia thể: không còn dòng gợi ý dưới đề
  await btn.click();
  await expect(pop).toBeVisible();
  await expect(btn).toHaveAttribute("aria-expanded", "true");
  expect(((await pop.innerText()) ?? "").split("\n")[0]).toMatch(/^(Động từ|Tính từ い|Tính từ な)$/);
  await expect(pop).toContainText(/Bài \d+/);
  await page.keyboard.press("Escape");
  await page.mouse.move(0, 0); // desktop: chuột còn trên icon thì vẫn hiện theo hover (đúng thiết kế)
  await expect(pop).toBeHidden();
  await btn.click();
  await page.locator('[data-q="question"]').click(); // bấm ra ngoài
  await expect(pop).toBeHidden();
  await btn.click();
  await page.keyboard.press("1");
  await page.locator('[data-q="next"]').click();
  await expect(pop).toBeHidden();
});

test("ô ⓘ: máy có chuột → rê chuột vào icon là hiện", async ({ page, isMobile }, info) => {
  test.skip(info.project.name === "mobile" || isMobile, "chỉ thiết bị có chuột");
  await page.goto("luyen-tap/?phan=tu-vung");
  await startQuiz(page);
  await page.locator('[data-q="info-btn"]').hover();
  await expect(page.locator('[data-q="info"]')).toBeVisible();
  await expect(page.locator('[data-q="info"]')).toContainText(/Bài \d+/);
});
