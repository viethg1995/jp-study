// E2E Q13 (plan/quiz/q13-conj-n3-rows.md): từ N3 trùng từ Minna có hàng chia riêng (quiz Chia thể sách N3 hỏi được)
// nhưng không có trang riêng — mọi link về trang hàng Minna; trang Minna có link "N3 · Bài N".
import { expect, startQuiz, test } from "./fixtures";

const prompt = '[data-q="prompt"]';

test("quiz Chia thể sách N3 bài 3 hỏi được 倒れる (trùng Minna); 'Xem bảng chia' mở trang Minna", async ({ page }) => {
  await page.goto("chia-the/quiz/?sach=n3&tu=3&den=3&loai=chia");
  await page.locator("label:has(#q-size-100)").click();
  await startQuiz(page);
  for (let i = 0; i < 100; i++) {
    const reading = await page.locator(`${prompt} rt`).allTextContents();
    const text = ((await page.locator(prompt).textContent()) ?? "").replace(reading.join(""), "");
    await page.keyboard.press("1");
    if (text === "倒れる") {
      await expect(page.locator('[data-q="link"]')).toHaveAttribute("href", /\/chia-the\/dong-tu\/mn-39-002\/$/);
      await page.locator('[data-q="link"]').click();
      await expect(page).toHaveURL(/\/chia-the\/dong-tu\/mn-39-002\/$/);
      await expect(page.locator("h1")).toContainText("倒");
      return;
    }
    await page.keyboard.press("Enter");
    if (!(await page.locator(prompt).isVisible())) break;
  }
  throw new Error("lượt không có câu 倒れる");
});

test("không có trang riêng cho từ N3 trùng; trang Minna có link 'N3 · Bài 3' về từ vựng N3", async ({ page }) => {
  const res = await page.request.get("chia-the/dong-tu/n3-101/");
  expect(res.status()).toBe(404);
  await page.goto("chia-the/dong-tu/mn-39-002/");
  const n3 = page.locator("[data-n3-same]");
  await expect(n3).toHaveText("N3 · Bài 3");
  await n3.click();
  await expect(page).toHaveURL(/\/vocabulary\/n3\/3\/#n3-101$/);
});

test("trang từ vựng N3 bài 3: link bảng chia của 倒れる về trang Minna", async ({ page }) => {
  await page.goto("vocabulary/n3/3/");
  await expect(page.locator('#n3-101 a[href*="/chia-the/"]').first()).toHaveAttribute("href", /\/chia-the\/dong-tu\/mn-39-002\/$/);
});
