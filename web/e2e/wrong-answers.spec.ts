// E2E câu hay sai (Q10, plan/quiz/q10-wrong-answers.md): lưu ID câu sai (jp:quiz:wrong) → dòng "Câu hỏi: Câu hay sai (N)"
// trên mọi trang quiz, ôn lại (?on=sai), đúng 3 lần liên tiếp → xóa, dùng chung giữa trang từng phần và trang tổng,
// nút Xóa theo loại câu của trang, localStorage bị chặn → vẫn chạy.
import type { Page } from "@playwright/test";
import { backToSetup, expect, startQuiz, test } from "./fixtures";

const KEY = "jp:quiz:wrong";
type Store = { v: 1; items: Record<string, { w: number; s: number; t: number }> };

const readStore = (page: Page): Promise<Store | null> => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null") as Store | null, KEY);
async function seed(page: Page, items: Store["items"]): Promise<void> {
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify({ v: 1, items })] as const);
  await page.reload();
}
const reviewLabel = (page: Page) => page.locator("label:has(#q-review-wrong)");
/** Câu đầu của deck Nghĩa N5 (đáp án là chữ Việt thường — bấm được theo nội dung). */
async function firstMeanItem(page: Page): Promise<{ id: string; answer: string }> {
  const deck = (await (await page.request.get("vocabulary/quiz/n5-nghia.json")).json()) as { items: { id: string; answer: string }[] };
  return deck.items[0]!;
}

test("trả lời sai → lưu; tải lại trang → 'Câu hay sai (N)'; ôn → lượt chỉ gồm các câu đó", async ({ page }) => {
  await page.goto("vocabulary/quiz/?cap=n5&tu=1&den=3&loai=nghia");
  await expect(page.locator('[data-q="wrong-row"]')).toBeVisible();
  await expect(reviewLabel(page)).toHaveText("Câu hay sai (0)");
  await expect(page.locator("#q-review-wrong")).toBeDisabled();
  await startQuiz(page);
  const wrongPrompts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const prompt = (await page.locator('[data-q="prompt"]').textContent()) ?? "";
    await page.keyboard.press("1");
    if ((await page.locator('.q-opt[data-state="wrong"]').count()) > 0) wrongPrompts.push(prompt);
    await page.keyboard.press("Enter");
  }
  const n = wrongPrompts.length;
  test.skip(n === 0, "lượt này chọn 1 đúng hết (hiếm)");
  await expect(page.locator('[data-q="sum-saved"]')).toHaveText(`Đã lưu ${n} câu sai để ôn lại · Ôn câu hay sai →`);
  expect(Object.keys((await readStore(page))!.items)).toHaveLength(n);

  await page.reload();
  await expect(reviewLabel(page)).toHaveText(`Câu hay sai (${n})`);
  await page.locator("label:has(#q-review-wrong)").click();
  await expect(page).toHaveURL(/loai=nghia&on=sai$/);
  await startQuiz(page);
  await expect(page.locator('[data-q="locked-summary"]')).toContainText("Câu hỏi: Câu hay sai");
  await expect(page.locator('[data-q="of"]')).toHaveText(` / ${n}`);
  const asked: string[] = [];
  for (let i = 0; i < n; i++) {
    asked.push((await page.locator('[data-q="prompt"]').textContent()) ?? "");
    await page.keyboard.press("1");
    await page.keyboard.press("Enter");
  }
  expect(asked.sort()).toEqual([...wrongPrompts].sort());
  await expect(page.locator('[data-q="sum-saved"]')).toContainText(/^Đã nhớ \d+ câu \(đúng 3 lần liên tiếp\) · Còn \d+ câu hay sai$/);
});

test("link 'Ôn câu hay sai →' ở tổng kết: về thiết lập, chọn sẵn Câu hay sai, giữ bộ lọc", async ({ page }) => {
  const it = await firstMeanItem(page);
  await page.goto("vocabulary/quiz/?cap=n5&loai=nghia");
  await seed(page, { [it.id]: { w: 1, s: 0, t: 1 } });
  await startQuiz(page);
  // trả lời sai đến khi có ít nhất 1 câu được lưu trong lượt
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("1");
    await page.keyboard.press("Enter");
  }
  const link = page.locator('[data-q="sum-review"]');
  test.skip((await link.count()) === 0, "lượt này chọn 1 đúng hết (hiếm)");
  await link.click();
  await expect(page.locator("#q-review-wrong")).toBeChecked();
  await expect(page).toHaveURL(/cap=n5&tu=1&den=25&loai=nghia&on=sai$/);
});

test("đúng 3 lần liên tiếp → đã nhớ, xóa khỏi danh sách; 0 câu → nút Câu hay sai bị khóa", async ({ page }) => {
  const it = await firstMeanItem(page);
  await page.goto("vocabulary/quiz/");
  await seed(page, { [it.id]: { w: 2, s: 2, t: 1 } }); // đã đúng 2 lần liên tiếp
  await page.goto("vocabulary/quiz/?cap=n5&loai=nghia&on=sai");
  await expect(page.locator("#q-review-wrong")).toBeChecked(); // ?on=sai
  await expect(reviewLabel(page)).toHaveText("Câu hay sai (1)");
  await startQuiz(page);
  await expect(page.locator('[data-q="of"]')).toHaveText(" / 1");
  await page.locator(".q-opt", { hasText: it.answer }).first().click();
  await expect(page.locator('[data-q="verdict"]')).toHaveText("Đúng!");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-q="sum-saved"]')).toHaveText("Đã nhớ 1 câu (đúng 3 lần liên tiếp) · Còn 0 câu hay sai");
  expect((await readStore(page))!.items).toEqual({});
  await backToSetup(page);
  await expect(reviewLabel(page)).toHaveText("Câu hay sai (0)");
  await expect(page.locator("#q-review-all")).toBeChecked();
  await expect(page).not.toHaveURL(/on=sai/);
});

test("dùng chung theo ID: câu sai từ vựng đếm ở Luyện tập, không đếm ở Kanji; ?on=sai mà 0 câu → về Tất cả", async ({ page }) => {
  const it = await firstMeanItem(page);
  await page.goto("luyen-tap/");
  await seed(page, { [it.id]: { w: 1, s: 0, t: 1 } });
  await expect(reviewLabel(page)).toHaveText("Câu hay sai (1)");
  await page.goto("kanji/quiz/?on=sai");
  await expect(reviewLabel(page)).toHaveText("Câu hay sai (0)");
  await expect(page.locator("#q-review-all")).toBeChecked();
  await expect(page).not.toHaveURL(/on=sai/);
});

test("Xóa (xác nhận) chỉ xóa câu sai thuộc loại câu của trang", async ({ page }) => {
  const it = await firstMeanItem(page);
  await page.goto("vocabulary/quiz/");
  await seed(page, { [it.id]: { w: 1, s: 0, t: 1 }, "k-hv:k-日": { w: 1, s: 0, t: 1 } });
  await expect(reviewLabel(page)).toHaveText("Câu hay sai (1)");
  page.once("dialog", (d) => {
    expect(d.message()).toContain("Xóa 1 câu hay sai");
    void d.accept();
  });
  await page.locator('[data-q="wrong-clear"]').click();
  await expect(reviewLabel(page)).toHaveText("Câu hay sai (0)");
  await expect(page.locator('[data-q="wrong-clear"]')).toBeHidden();
  expect(Object.keys((await readStore(page))!.items)).toEqual(["k-hv:k-日"]);
});

test("localStorage bị chặn → dòng 'Câu hỏi' ẩn, quiz vẫn chạy, không lỗi JS", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("blocked", "SecurityError");
    };
  });
  await page.goto("vocabulary/quiz/?cap=n5&tu=1&den=3&loai=nghia");
  await expect(page.locator('[data-q="wrong-row"]')).toBeHidden();
  await startQuiz(page);
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("1");
    await page.keyboard.press("Enter");
  }
  await expect(page.locator('[data-q="locked-summary"]')).not.toContainText("Câu hỏi");
});

test("mọi trang quiz có dòng 'Câu hỏi'", async ({ page }) => {
  for (const url of ["vocabulary/quiz/", "kanji/quiz/", "kanji/bo-thu/quiz/", "chia-the/quiz/", "dem-so/quiz/", "luyen-tap/"]) {
    await page.goto(url);
    await expect(page.locator('[data-q="wrong-row"]'), url).toBeVisible();
  }
});
