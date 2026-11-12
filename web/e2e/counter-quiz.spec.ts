// E2E quiz đếm số /dem-so/quiz/ — khung QuizRunner (plan/quiz.md Q3, checklist §6).
import { expect, optionHeights, test, tokenColor } from "./fixtures";

const card = '[data-q="card"]';
const opt = ".q-opt";

test.beforeEach(async ({ page }) => {
  await page.goto("dem-so/quiz/");
  await expect(page.locator(card)).toBeVisible();
});

test("tải trang: thẻ câu hỏi, 4 lựa chọn, câu 1 / 10, loading ẩn", async ({ page }) => {
  await expect(page.locator('[data-q="loading"]')).toBeHidden();
  await expect(page.locator(opt)).toHaveCount(4);
  await expect(page.locator('[data-q="index"]')).toHaveText("1");
  await expect(page.locator('[data-q="of"]')).toHaveText(" / 10");
  await expect(page.locator('[data-q="prompt"]')).toHaveText(/^[\d,]+\D/);
});

test("trả lời: nút đúng tô màu success, nút sai nền danger-soft, hiện phản hồi + link", async ({ page }) => {
  await page.keyboard.press("1");
  const right = page.locator(`${opt}[data-state="right"]`);
  await expect(right).toHaveCount(1);
  await expect(right).toHaveCSS("color", await tokenColor(page, "--color-success"));
  const wrong = page.locator(`${opt}[data-state="wrong"]`);
  if ((await wrong.count()) === 1) {
    await expect(wrong).toHaveCSS("background-color", await tokenColor(page, "--color-danger-soft", "backgroundColor"));
  }
  await expect(page.locator('[data-q="feedback"]')).toBeVisible();
  await expect(page.locator('[data-q="link"]')).toHaveAttribute("href", /\/dem-so\/[a-z-]+\/$/);
  await expect(page.locator('[data-q="total"]')).toHaveText("1");
  await expect(page.locator(opt).first()).toBeDisabled();
});

test("không chấm 2 lần một câu", async ({ page }) => {
  await page.keyboard.press("1");
  await page.keyboard.press("2");
  await expect(page.locator('[data-q="total"]')).toHaveText("1");
});

test("đi hết lượt 10 câu → tổng kết → làm lại câu sai đúng số câu sai", async ({ page }) => {
  for (let i = 0; i < 10; i++) {
    // chọn lần lượt 1–4 → gần như chắc chắn có câu sai
    await page.keyboard.press(String((i % 4) + 1));
    await page.keyboard.press("Enter");
  }
  const summary = page.locator('[data-q="summary"]');
  await expect(summary).toBeVisible();
  await expect(page.locator('[data-q="sum-total"]')).toHaveText("10");
  const right = Number(await page.locator('[data-q="sum-right"]').textContent());
  const wrongItems = page.locator('[data-q="sum-wrong"] li');
  await expect(wrongItems).toHaveCount(10 - right); // mỗi câu trong lượt 10 câu là câu khác nhau
  if (right === 10) return;
  await page.locator('[data-q="retry"]').click();
  await expect(page.locator('[data-q="of"]')).toHaveText(` / ${10 - right}`);
});

test("Kết thúc lượt sớm → tổng kết số câu đã làm", async ({ page }) => {
  await page.keyboard.press("1");
  await page.locator('[data-q="finish"]').click();
  await expect(page.locator('[data-q="summary"]')).toBeVisible();
  await expect(page.locator('[data-q="sum-total"]')).toHaveText("1");
});

test("Lượt mới sau tổng kết bắt đầu lại từ câu 1", async ({ page }) => {
  await page.keyboard.press("1");
  await page.locator('[data-q="finish"]').click();
  await page.locator('[data-q="restart"]').click();
  await expect(page.locator(card)).toBeVisible();
  await expect(page.locator('[data-q="total"]')).toHaveText("0");
});

test("URL → bộ lọc: ?tro=hon&o=tat-ca chỉ hỏi ～本, Combobox không cướp focus", async ({ page }) => {
  await page.goto("dem-so/quiz/?tro=hon&o=tat-ca");
  await expect(page.locator(card)).toBeVisible();
  await expect(page.locator("[data-combo] .combo-text")).toContainText("本");
  await expect(page.locator("#m-all")).toBeChecked();
  expect(await page.evaluate(() => !!document.activeElement?.closest("[data-combo]"))).toBe(false);
  for (let i = 0; i < 6; i++) {
    await expect(page.locator('[data-q="prompt"]')).toHaveText(/本$/);
    await page.keyboard.press("1");
    await page.keyboard.press("Enter");
  }
});

test("đổi bộ lọc → URL cập nhật; 100 câu → ' / 100'", async ({ page }) => {
  await page.locator("label:has(#g-h)").click();
  await expect(page).toHaveURL(/nhom=h/);
  await page.locator("label:has(#q-size-100)").click();
  await expect(page.locator('[data-q="of"]')).toHaveText(" / 100");
});

test("bộ lọc không còn câu → thông báo rỗng", async ({ page }) => {
  await page.goto("dem-so/quiz/?tro=nin&nhom=h");
  await expect(page.locator('[data-q="empty"]')).toBeVisible();
  await expect(page.locator(card)).toBeHidden();
});

test("URL rác → vẫn chạy với bộ lọc mặc định", async ({ page }) => {
  await page.goto("dem-so/quiz/?tro=zzz&nhom=%3Cx%3E&o=1");
  await expect(page.locator(opt)).toHaveCount(4);
  await expect(page.locator("#m-changed")).toBeChecked();
});

test("không cuộn ngang; nút Câu tiếp không xuống dòng", async ({ page }) => {
  await page.keyboard.press("2");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const next = page.locator('[data-q="next"]');
  const box = await next.boundingBox();
  const lineHeight = await next.evaluate((b) => parseFloat(getComputedStyle(b).lineHeight));
  expect(box!.height).toBeLessThan(lineHeight * 2);
});

test("quiz một loại: không hiện nhãn loại câu; bảng tùy chọn có nhãn 'Trợ số từ'", async ({ page }) => {
  await expect(page.locator('[data-q="kind"]')).toBeHidden();
  await expect(page.locator("fieldset legend")).toHaveText("Tùy chọn luyện tập");
  await expect(page.locator("fieldset").getByText("Trợ số từ:")).toBeVisible();
});

test("bảng tùy chọn: mọi điều khiển cao bằng nhau 32px (Combobox, Nhóm âm, Ô hỏi, Số câu)", async ({ page }) => {
  const hs = await optionHeights(page);
  expect(hs.length).toBeGreaterThanOrEqual(4);
  expect(new Set(hs)).toEqual(new Set([32]));
});
