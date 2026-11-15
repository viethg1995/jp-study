// E2E gõ kana (Q9, plan/quiz/q09-kana-input.md): dòng "Trả lời: Gõ kana" → câu loại gõ được hiện ô nhập (romaji chuyển
// kana ngay khi gõ), Enter chấm / sang câu; câu loại khác vẫn 4 lựa chọn; URL ?tra-loi=go; câu sai lưu như Q10.
import type { Page } from "@playwright/test";
import { expect, startQuiz, test } from "./fixtures";

const input = '[data-q="type-input"]';
const prompt = '[data-q="prompt"]';

/** Bỏ qua ("Không biết") tới khi gặp câu có đề `want`; false nếu hết lượt mà không gặp. */
async function skipTo(page: Page, want: string, max = 100): Promise<boolean> {
  for (let i = 0; i < max; i++) {
    if (((await page.locator(prompt).textContent()) ?? "").trim() === want) return true;
    await page.locator('[data-q="type-giveup"]').click();
    await page.keyboard.press("Enter");
    if (!(await page.locator(prompt).isVisible())) return false;
  }
  return false;
}

test("Từ vựng Đọc + Gõ kana: ô nhập thay 4 lựa chọn; gõ romaji hiện kana ngay; Enter chấm, Enter sang câu", async ({ page }) => {
  await page.goto("vocabulary/quiz/?cap=n5&tu=1&den=1&loai=doc");
  await page.locator("label:has(#q-ans-type)").click();
  await expect(page).toHaveURL(/loai=doc&tra-loi=go$/);
  await page.locator("label:has(#q-size-100)").click();
  await startQuiz(page);
  await expect(page.locator('[data-q="locked-summary"]')).toContainText("Trả lời: Gõ kana");
  await expect(page.locator(input)).toBeVisible();
  await expect(page.locator(input)).toBeFocused();
  await expect(page.locator(".q-opt").first()).toBeHidden();
  expect(await skipTo(page, "学生")).toBe(true);
  await page.keyboard.type("gakus");
  await expect(page.locator(input)).toHaveValue("がくs");
  await page.keyboard.type("ei");
  await expect(page.locator(input)).toHaveValue("がくせい");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-q="verdict"]')).toHaveText("Đúng!");
  await expect(page.locator(input)).toHaveAttribute("data-state", "right");
  await expect(page.locator('[data-q="typed"]')).toBeHidden();
  const before = await page.locator('[data-q="index"]').textContent();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-q="index"]')).not.toHaveText(before ?? "");
  await expect(page.locator(input)).toBeFocused();
});

test("gõ sai → 'Bạn gõ: …', lưu câu sai; ô trống + Enter không chấm; Không biết → sai, không có dòng 'Bạn gõ'", async ({ page }) => {
  await page.goto("vocabulary/quiz/?cap=n5&tu=1&den=1&loai=doc&tra-loi=go");
  await expect(page.locator("#q-ans-type")).toBeChecked();
  await startQuiz(page);
  await page.keyboard.press("Enter"); // ô trống
  await expect(page.locator('[data-q="feedback"]')).toBeHidden();
  await page.keyboard.type("gakuse"); // sai cho mọi câu bài 1 (がくせい thiếu い)
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-q="verdict"]')).toContainText("Chưa đúng — đáp án:");
  await expect(page.locator('[data-q="typed"]')).toHaveText("Bạn gõ: がくせ");
  await expect(page.locator(input)).toHaveAttribute("data-state", "wrong");
  const saved = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("jp:quiz:wrong") ?? "{}").items ?? {}));
  expect(saved).toHaveLength(1);
  await page.keyboard.press("Enter");
  await page.locator('[data-q="type-giveup"]').click();
  await expect(page.locator('[data-q="verdict"]')).toContainText("Chưa đúng");
  await expect(page.locator('[data-q="typed"]')).toBeHidden();
  await expect(page.locator('[data-q="right"]')).toHaveText("0");
});

test("Luyện tập trộn: câu Đọc gõ, câu Nghĩa / Điền từ vẫn 4 lựa chọn + ghi chú", async ({ page }) => {
  await page.goto("luyen-tap/?phan=tu-vung&tra-loi=go");
  await startQuiz(page);
  const seen = { typed: 0, pick: 0 };
  for (let i = 0; i < 10; i++) {
    const kind = (await page.locator('[data-q="kind"]').textContent()) ?? "";
    if (kind === "Từ vựng · Đọc") {
      await expect(page.locator(input)).toBeVisible();
      await expect(page.locator('[data-q="type-note"]')).toBeHidden();
      seen.typed++;
      await page.locator('[data-q="type-giveup"]').click();
    } else {
      await expect(page.locator(".q-opt")).toHaveCount(4);
      await expect(page.locator(input)).toBeHidden();
      await expect(page.locator('[data-q="type-note"]')).toHaveText("Loại câu này chỉ có trắc nghiệm");
      seen.pick++;
      await page.keyboard.press("1");
    }
    await page.keyboard.press("Enter");
  }
  expect(seen.typed).toBeGreaterThan(0);
  expect(seen.pick).toBeGreaterThan(0);
});

test("Đếm số · Số: gõ 'ichipa-sento' cho 1% (katakana trong đáp án)", async ({ page }) => {
  await page.goto("dem-so/quiz/?loai=so&nhom-so=thap-phan&tra-loi=go");
  await page.locator("label:has(#q-size-100)").click();
  await startQuiz(page);
  expect(await skipTo(page, "1%")).toBe(true);
  await page.keyboard.type("ichipa-sento");
  await expect(page.locator(input)).toHaveValue("いちぱーせんと");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-q="verdict"]')).toHaveText("Đúng!");
});

test("Bộ thủ không có dòng 'Trả lời'; mặc định 'Chọn đáp án' không ghi vào URL / tóm tắt", async ({ page }) => {
  await page.goto("kanji/bo-thu/quiz/");
  await expect(page.locator("#q-ans-type")).toHaveCount(0);
  await page.goto("vocabulary/quiz/");
  await expect(page.locator("#q-ans-pick")).toBeChecked();
  await expect(page).not.toHaveURL(/tra-loi/);
  await startQuiz(page);
  await expect(page.locator('[data-q="locked-summary"]')).not.toContainText("Trả lời");
});

test("không cuộn ngang khi gõ; ô nhập đủ rộng", async ({ page }) => {
  await page.goto("chia-the/quiz/?tra-loi=go");
  await startQuiz(page);
  const typed = await page.locator(input).isVisible();
  if (typed) {
    await page.keyboard.type("tabemashita");
    await page.keyboard.press("Enter");
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
