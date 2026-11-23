// E2E 2 công tắc furigana ở trang bài từ vựng (LessonView + global.css):
// "Ẩn furigana" ẩn mọi furigana, kể cả kana ở tiêu đề thẻ (わたし trên 私) khi nhấn mạnh Kanji;
// "Hiện furigana từ vựng" chỉ dùng được khi đang Ẩn → trả lại cách đọc của từ của thẻ (tiêu đề + từ tô xanh),
// chữ Hán khác trong câu vẫn ẩn; bỏ Ẩn → tự bỏ chọn + khóa.
import type { Page } from "@playwright/test";
import { expect, openDisplayOptions, test } from "./fixtures";

const card = "#mn-01-001"; // 私 / わたし
const headKana = `${card} .headword .hw-kana`;
// thẻ đầu tiên có cả furigana của từ đang học lẫn furigana chữ Hán khác trong câu ví dụ
const pickCard = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const el = [...document.querySelectorAll<HTMLElement>(".word-list .word-card")].find(
      (c) => c.querySelector(".sentence .target rt") && c.querySelector(".sentence > span:not(.target) rt"),
    );
    return el ? `#${el.id}` : "";
  });

test("Ẩn furigana ẩn cả kana tiêu đề; Hiện furigana từ vựng chỉ trả lại từ của thẻ; bỏ Ẩn → tự bỏ chọn + khóa", async ({ page }) => {
  await page.goto("vocabulary/1/");
  const furi = page.locator("#toggle-furigana");
  const vocab = page.locator("#toggle-vocab-reading");
  const mixed = await pickCard(page);
  expect(mixed).not.toBe("");
  const targetRt = page.locator(`${mixed} .sentence .target rt`).first();
  const otherRt = page.locator(`${mixed} .sentence > span:not(.target) rt`).first();

  // mặc định: kana tiêu đề + furigana chữ khác hiện, từ đang học ẩn; "Hiện furigana từ vựng" bị khóa
  await expect(page.locator(headKana)).toBeVisible();
  await expect(otherRt).toBeVisible();
  await expect(targetRt).toBeHidden();
  await expect(vocab).toBeDisabled();
  await expect(vocab).not.toBeChecked();

  // Ẩn furigana → ẩn hết, kể cả kana tiêu đề; mở khóa "Hiện furigana từ vựng"
  await page.locator("label:has(#toggle-furigana)").click();
  await expect(furi).toBeChecked();
  await expect(page.locator(headKana)).toBeHidden();
  await expect(otherRt).toBeHidden();
  await expect(targetRt).toBeHidden();
  await expect(vocab).toBeEnabled();

  // + Hiện furigana từ vựng → chỉ từ của thẻ hiện cách đọc
  await page.locator("label:has(#toggle-vocab-reading)").click();
  await expect(vocab).toBeChecked();
  await expect(page.locator(headKana)).toBeVisible();
  await expect(targetRt).toBeVisible();
  await expect(otherRt).toBeHidden();

  // bỏ Ẩn furigana → "Hiện furigana từ vựng" tự bỏ chọn + khóa, về mặc định
  await page.locator("label:has(#toggle-furigana)").click();
  await expect(vocab).not.toBeChecked();
  await expect(vocab).toBeDisabled();
  await expect(page.locator(headKana)).toBeVisible();
  await expect(otherRt).toBeVisible();
  await expect(targetRt).toBeHidden();
});

test("nhấn mạnh Hiragana: Ẩn furigana không ẩn kana (chữ chính của tiêu đề)", async ({ page }) => {
  await page.goto("vocabulary/1/");
  await openDisplayOptions(page);
  await page.locator("label:has(#focus-kana)").click();
  await page.locator("label:has(#toggle-furigana)").click();
  await expect(page.locator(headKana)).toBeVisible();
});
