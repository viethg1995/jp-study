// E2E quiz đếm số /dem-so/quiz/ — khung QuizRunner (plan/quiz/q03-runner.md, checklist ở plan/quiz/README.md).
// Luồng: bảng tùy chọn + "Bắt đầu" → khung quiz (tùy chọn khóa) → tổng kết → "Đổi tùy chọn".
import { backToSetup, expect, optionHeights, startQuiz, test, tokenColor } from "./fixtures";

const card = '[data-q="card"]';
const opt = ".q-opt";

test.beforeEach(async ({ page }) => {
  await page.goto("dem-so/quiz/");
});

test("mở trang: chỉ có bảng tùy chọn + nút Bắt đầu; bấm Bắt đầu → câu 1 / 10, 4 lựa chọn", async ({ page }) => {
  await expect(page.locator(card)).toBeHidden();
  await expect(page.locator('[data-q="loading"]')).toBeHidden();
  await expect(page.locator('[data-q="start"]')).toBeVisible();
  await startQuiz(page);
  await expect(page.locator('[data-q="start"]')).toBeHidden();
  await expect(page.locator(opt)).toHaveCount(4);
  await expect(page.locator('[data-q="index"]')).toHaveText("1");
  await expect(page.locator('[data-q="of"]')).toHaveText(" / 10");
  await expect(page.locator('[data-q="prompt"]')).toHaveText(/^[\d,]+\D/);
});

test("trả lời: nút đúng tô màu success, nút sai nền danger-soft, hiện phản hồi + link", async ({ page }) => {
  await startQuiz(page);
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
  await startQuiz(page);
  await page.keyboard.press("1");
  await page.keyboard.press("2");
  await expect(page.locator('[data-q="total"]')).toHaveText("1");
});

test("đi hết lượt 10 câu → tổng kết → làm lại câu sai đúng số câu sai", async ({ page }) => {
  await startQuiz(page);
  for (let i = 0; i < 10; i++) {
    // chọn lần lượt 1–4 → gần như chắc chắn có câu sai
    await page.keyboard.press(String((i % 4) + 1));
    await page.keyboard.press("Enter");
  }
  await expect(page.locator('[data-q="summary"]')).toBeVisible();
  await expect(page.locator('[data-q="sum-total"]')).toHaveText("10");
  const right = Number(await page.locator('[data-q="sum-right"]').textContent());
  await expect(page.locator('[data-q="sum-wrong"] li')).toHaveCount(10 - right); // mỗi câu trong lượt 10 câu là câu khác nhau
  if (right === 10) return;
  await page.locator('[data-q="retry"]').click();
  await expect(page.locator('[data-q="of"]')).toHaveText(` / ${10 - right}`);
});

test("Kết thúc lượt sớm → hỏi lại; Làm tiếp / Esc giữ lượt; Kết thúc → tổng kết; Lượt mới từ câu 1, vẫn khóa tùy chọn", async ({ page }) => {
  await startQuiz(page);
  // chưa làm câu nào → kết thúc luôn, không hỏi
  await page.locator('[data-q="finish"]').click();
  await expect(page.locator('[data-q="summary"]')).toBeVisible();
  await page.locator('[data-q="restart"]').click();
  await page.keyboard.press("1");
  const confirm = page.locator('[data-q="finish-confirm"]');
  await page.locator('[data-q="finish"]').click();
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText("Đã làm 1 câu");
  await expect(page.locator('[data-q="finish-cancel"]')).toBeFocused();
  await page.keyboard.press("Enter"); // Enter trên "Làm tiếp" không được sang câu tiếp
  await expect(confirm).toBeHidden();
  await expect(page.locator('[data-q="index"]')).toHaveText("1");
  await page.locator('[data-q="finish"]').click();
  await page.keyboard.press("Escape");
  await expect(confirm).toBeHidden();
  await page.locator('[data-q="finish"]').click();
  await page.locator('[data-q="finish-ok"]').click();
  await expect(page.locator('[data-q="summary"]')).toBeVisible();
  await expect(page.locator('[data-q="sum-total"]')).toHaveText("1");
  await page.locator('[data-q="restart"]').click();
  await expect(page.locator(card)).toBeVisible();
  await expect(page.locator('[data-q="total"]')).toHaveText("0");
  await expect(page.locator("#g-h")).toBeDisabled();
});

test("đang làm bài: mọi tùy chọn bị khóa (Combobox, Nhóm âm, Ô hỏi, Số câu); Đổi tùy chọn → mở khóa", async ({ page }) => {
  await startQuiz(page);
  // khung thu gọn: chỉ còn 1 dòng tóm tắt (không có dòng Furigana ở quiz này)
  await expect(page.locator('[data-q="locked-summary"]')).toHaveText("Trợ số từ: Tất cả trợ số từ · Nhóm âm: Tất cả · Ô hỏi: Cần nhớ (149) · Số câu: 10");
  await expect(page.locator(".quiz-options > *:visible")).toHaveCount(0);
  await expect(page.locator(".combo-trigger")).toBeDisabled();
  for (const id of ["#g-h", "#m-all", "#q-size-20", "#q-size-custom"]) await expect(page.locator(id)).toBeDisabled();
  await backToSetup(page);
  await expect(page.locator(card)).toBeHidden();
  await expect(page.locator('[data-q="locked-note"]')).toBeHidden();
  await expect(page.locator("#g-h")).toBeEnabled();
});

test("URL → bộ lọc: ?tro=hon&o=tat-ca chỉ hỏi ～本, Combobox không cướp focus", async ({ page }) => {
  await page.goto("dem-so/quiz/?tro=hon&o=tat-ca");
  await expect(page.locator("[data-combo] .combo-text")).toContainText("本");
  await expect(page.locator("#m-all")).toBeChecked();
  expect(await page.evaluate(() => !!document.activeElement?.closest("[data-combo]"))).toBe(false);
  await startQuiz(page);
  for (let i = 0; i < 6; i++) {
    await expect(page.locator('[data-q="prompt"]')).toHaveText(/本$/);
    await page.keyboard.press("1");
    await page.keyboard.press("Enter");
  }
});

test("đổi bộ lọc trước khi bắt đầu → URL cập nhật; chọn 100 câu → ' / 100'", async ({ page }) => {
  await page.locator("label:has(#g-h)").click();
  await expect(page).toHaveURL(/nhom=h/);
  await page.locator("label:has(#q-size-100)").click();
  await expect(page.locator(card)).toBeHidden(); // chưa bắt đầu
  await startQuiz(page);
  await expect(page.locator('[data-q="of"]')).toHaveText(" / 100");
});

test("bộ lọc không còn câu → bấm Bắt đầu báo rỗng, tùy chọn vẫn mở", async ({ page }) => {
  await page.goto("dem-so/quiz/?tro=nin&nhom=h");
  await page.locator('[data-q="start"]').click();
  await expect(page.locator('[data-q="empty"]')).toBeVisible();
  await expect(page.locator(card)).toBeHidden();
  await expect(page.locator("#g-all")).toBeEnabled();
  await page.locator("label:has(#g-all)").click(); // đổi tùy chọn → ẩn thông báo cũ
  await expect(page.locator('[data-q="empty"]')).toBeHidden();
});

test("URL rác → vẫn chạy với bộ lọc mặc định", async ({ page }) => {
  await page.goto("dem-so/quiz/?tro=zzz&nhom=%3Cx%3E&o=1");
  await expect(page.locator("#m-changed")).toBeChecked();
  await startQuiz(page);
  await expect(page.locator(opt)).toHaveCount(4);
});

test("không cuộn ngang; nút Câu tiếp không xuống dòng", async ({ page }) => {
  await startQuiz(page);
  await page.keyboard.press("2");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const next = page.locator('[data-q="next"]');
  const box = await next.boundingBox();
  const lineHeight = await next.evaluate((b) => parseFloat(getComputedStyle(b).lineHeight));
  expect(box!.height).toBeLessThan(lineHeight * 2);
});

test("quiz một loại: không hiện nhãn loại câu; bảng tùy chọn có nhãn 'Trợ số từ'", async ({ page }) => {
  await expect(page.locator("fieldset legend")).toContainText("Tùy chọn luyện tập");
  await expect(page.locator("fieldset").getByText("Trợ số từ:")).toBeVisible();
  await startQuiz(page);
  await expect(page.locator('[data-q="kind"]')).toBeHidden();
});

test("bảng tùy chọn: mọi điều khiển cao bằng nhau 32px (Combobox, Nhóm âm, Ô hỏi, Số câu)", async ({ page }) => {
  const hs = await optionHeights(page);
  expect(hs.length).toBeGreaterThanOrEqual(4);
  expect(new Set(hs)).toEqual(new Set([32]));
});

test("thanh tiến độ theo số câu đã trả lời; nút Câu tiếp ẩn (giữ chỗ) tới khi trả lời", async ({ page }) => {
  await startQuiz(page);
  const bar = page.locator('[data-q="progressbar"]');
  await expect(bar).toHaveAttribute("aria-valuenow", "0");
  await expect(page.locator('[data-q="next"]')).toBeHidden();
  await page.keyboard.press("1");
  await expect(bar).toHaveAttribute("aria-valuenow", "10");
  await expect(page.locator('[data-q="next"]')).toBeVisible();
  await page.keyboard.press("Enter");
  await page.keyboard.press("2");
  await expect(bar).toHaveAttribute("aria-valuenow", "20");
});
