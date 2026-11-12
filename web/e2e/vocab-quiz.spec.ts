// E2E quiz từ vựng /vocabulary/quiz/ (Q4): tải deck theo bộ lọc, URL, loại câu, nút "Luyện tập bài này".
import { expect, test } from "./fixtures";

const card = '[data-q="card"]';
const prompt = '[data-q="prompt"]';

test("mặc định: N5, bài 1–25, loại Nghĩa → câu hỏi tiếng Nhật, đáp án tiếng Việt; URL ghi bộ lọc", async ({ page }) => {
  await page.goto("vocabulary/quiz/");
  await expect(page.locator(card)).toBeVisible();
  await expect(page).toHaveURL(/cap=n5&tu=1&den=25&loai=nghia/);
  await expect(page.locator('[data-q="question"]')).toHaveText("Nghĩa là gì?");
  await expect(page.locator(prompt)).toHaveAttribute("lang", "ja");
  await expect(page.locator(".q-opt")).toHaveCount(4);
});

test("URL ?cap=n4&tu=30&den=30&loai=hv → Hán-Việt bài 30, đáp án viết hoa", async ({ page }) => {
  await page.goto("vocabulary/quiz/?cap=n4&tu=30&den=30&loai=hv");
  await expect(page.locator(card)).toBeVisible();
  await expect(page.locator("#cap-n4")).toBeChecked();
  await expect(page.locator("#q-from")).toHaveValue("30");
  await expect(page.locator("#q-to")).toHaveValue("30");
  await expect(page.locator("#loai-hv")).toBeChecked();
  await expect(page.locator("#loai-nghia")).not.toBeChecked();
  for (let i = 0; i < 4; i++) {
    await expect(page.locator('[data-q="hint"]')).toContainText("Bài 30");
    const opts = await page.locator(".q-opt").allTextContents();
    for (const o of opts) expect(o.replace(/^\d/, "")).toBe(o.replace(/^\d/, "").toUpperCase());
    await page.keyboard.press("1");
    await page.keyboard.press("Enter");
  }
});

test("chọn nhiều loại câu → tải nhiều file, câu hỏi trộn loại", async ({ page }) => {
  const loaded: string[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith(".json")) loaded.push(r.url().split("/").pop()!);
  });
  await page.goto("vocabulary/quiz/?cap=n5&tu=1&den=5&loai=doc,nghia,tu");
  await expect(page.locator(card)).toBeVisible();
  expect(loaded.sort()).toEqual(["n5-doc.json", "n5-nghia.json", "n5-tu.json"]);
  await page.locator("label:has(#q-size-all)").click();
  const questions = new Set<string>();
  for (let i = 0; i < 15; i++) {
    questions.add((await page.locator('[data-q="question"]').textContent()) ?? "");
    await page.keyboard.press("1");
    await page.keyboard.press("Enter");
  }
  expect(questions.size).toBeGreaterThan(1);
});

test("đổi cấp → khoảng bài về cả cấp mới (N3: 1–14), URL cập nhật", async ({ page }) => {
  await page.goto("vocabulary/quiz/?cap=n5&tu=3&den=7");
  await expect(page.locator(card)).toBeVisible();
  await page.locator("label:has(#cap-n3)").click();
  await expect(page.locator("#q-from")).toHaveValue("1");
  await expect(page.locator("#q-to")).toHaveValue("14");
  await expect(page).toHaveURL(/cap=n3&tu=1&den=14/);
  await expect(page.locator(card)).toBeVisible();
});

test("bỏ hết loại câu → thông báo rỗng, không lỗi", async ({ page }) => {
  await page.goto("vocabulary/quiz/");
  await expect(page.locator(card)).toBeVisible();
  await page.locator("label:has(#loai-nghia)").click();
  await expect(page.locator('[data-q="empty"]')).toBeVisible();
});

test("điền từ: câu có chỗ trống, gợi ý là câu dịch tiếng Việt", async ({ page }) => {
  await page.goto("vocabulary/quiz/?cap=n5&tu=1&den=3&loai=dien");
  await expect(page.locator(card)).toBeVisible();
  await expect(page.locator(prompt)).toContainText("＿＿＿");
  await expect(page.locator('[data-q="question"]')).toHaveText("Điền từ thích hợp");
  await expect(page.locator('[data-q="hint"]')).not.toBeEmpty();
});

test("mạng chậm → hiện 'Đang tải câu hỏi…' rồi mới ra câu hỏi", async ({ page }) => {
  await page.route("**/vocabulary/quiz/*.json", async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await page.goto("vocabulary/quiz/?loai=doc");
  await expect(page.locator('[data-q="loading"]')).toBeVisible();
  await expect(page.locator('[data-q="loading"]')).toHaveText("Đang tải câu hỏi…");
  await expect(page.locator(card)).toBeVisible({ timeout: 15_000 });
});

test("lỗi mạng → báo lỗi; đổi bộ lọc thì thử tải lại", async ({ page, jsErrors }) => {
  let fail = true;
  await page.route("**/vocabulary/quiz/*.json", (route) => (fail ? route.abort() : route.continue()));
  await page.goto("vocabulary/quiz/?loai=doc");
  await expect(page.locator('[data-q="loading"]')).toContainText("Không tải được");
  fail = false;
  await page.locator("label:has(#loai-nghia)").click();
  await expect(page.locator(card)).toBeVisible();
  jsErrors.length = 0; // lỗi tải tài nguyên do cố ý chặn — không phải lỗi trang
});

test("trả lời → link tới đúng thẻ từ trong trang bài", async ({ page }) => {
  await page.goto("vocabulary/quiz/?cap=n5&tu=4&den=4&loai=nghia");
  await expect(page.locator(card)).toBeVisible();
  await page.keyboard.press("1");
  const href = await page.locator('[data-q="link"]').getAttribute("href");
  expect(href).toMatch(/\/vocabulary\/4\/#mn-04-\d{3}$/);
  await page.locator('[data-q="link"]').click();
  const id = href!.split("#")[1]!;
  await expect(page.locator(`[id="${id}"]`)).toBeAttached();
});

test("nút 'Luyện tập bài này' ở bài 5 (Minna) và N3 bài 2 mở quiz lọc đúng bài", async ({ page }) => {
  await page.goto("vocabulary/5/");
  await page.locator("[data-lesson-quiz]").click();
  await expect(page).toHaveURL(/vocabulary\/quiz\/\?cap=n5&tu=5&den=5/);
  await expect(page.locator(card)).toBeVisible();
  await expect(page.locator('[data-q="hint"]')).toContainText("Bài 5");

  await page.goto("vocabulary/n3/2/");
  await page.locator("[data-lesson-quiz]").click();
  await expect(page).toHaveURL(/cap=n3&tu=2&den=2/);
  await expect(page.locator('[data-q="hint"]')).toContainText("N3 · Bài 2");
});

test("không cuộn ngang (nghĩa dài, câu ví dụ dài)", async ({ page }) => {
  for (const loai of ["nghia", "dien"]) {
    await page.goto(`vocabulary/quiz/?cap=n3&loai=${loai}`);
    await expect(page.locator(card)).toBeVisible();
    await page.keyboard.press("1");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, loai).toBeLessThanOrEqual(0);
  }
});

test("trộn đều: chọn 5 loại, lượt 20 câu → mỗi loại đúng 4 câu; nhãn loại câu hiện trên thẻ", async ({ page }) => {
  await page.goto("vocabulary/quiz/?cap=n5&loai=doc,nghia,tu,hv,dien");
  await page.locator("label:has(#q-size-20)").click();
  await expect(page.locator('[data-q="of"]')).toHaveText(" / 20");
  const counts: Record<string, number> = {};
  for (let i = 0; i < 20; i++) {
    const badge = page.locator('[data-q="kind"]');
    await expect(badge).toBeVisible();
    const k = (await badge.textContent()) ?? "";
    counts[k] = (counts[k] ?? 0) + 1;
    await page.keyboard.press("1");
    await page.keyboard.press("Enter");
  }
  expect(counts).toEqual({ "Đọc": 4, "Nghĩa": 4, "Từ": 4, "Hán-Việt": 4, "Điền từ": 4 });
  await expect(page.locator('[data-q="summary"]')).toBeVisible();
});

test("loại câu chọn nhiều: nút đang chọn có ✓, có dòng giải thích trộn đều", async ({ page }) => {
  await page.goto("vocabulary/quiz/?loai=doc,hv");
  await expect(page.locator("label:has(#loai-doc)")).toContainText("✓");
  await expect(page.locator("label:has(#loai-hv)")).toContainText("✓");
  await expect(page.locator("label:has(#loai-nghia) span[aria-hidden]")).toBeHidden();
  await expect(page.getByText("Chọn nhiều để trộn")).toBeVisible();
});

test("số câu tự nhập: 7 → lượt 7 câu; gõ số trong ô không chọn đáp án; số sai báo lỗi, giữ lượt cũ", async ({ page }) => {
  await page.goto("vocabulary/quiz/?cap=n5&loai=nghia");
  await expect(page.locator('[data-q="card"]')).toBeVisible();
  await page.locator("label:has(#q-size-custom)").click();
  const input = page.locator('[data-q="size-input"]');
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();
  await input.fill("7");
  await input.press("Enter");
  await expect(page.locator('[data-q="of"]')).toHaveText(" / 7");
  await expect(page.locator('[data-q="total"]')).toHaveText("0"); // gõ "7" không bị coi là chọn đáp án
  await input.fill("0");
  await input.press("Enter");
  await expect(page.locator('[data-q="size-error"]')).toBeVisible();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator('[data-q="of"]')).toHaveText(" / 7");
  // ô type=number tự chặn chữ; còn lại phải tự kiểm: ngoài khoảng, số lẻ
  for (const bad of ["1000", "2.5"]) {
    await input.fill(bad);
    await input.press("Enter");
    await expect(page.locator('[data-q="size-error"]'), bad).toBeVisible();
    await expect(page.locator('[data-q="of"]')).toHaveText(" / 7");
  }
  await input.fill("3");
  await input.press("Enter");
  await expect(page.locator('[data-q="size-error"]')).toBeHidden();
  await page.locator('[data-q="prompt"]').click(); // rời ô nhập
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("1");
    await page.keyboard.press("Enter");
  }
  await expect(page.locator('[data-q="summary"]')).toBeVisible();
  await expect(page.locator('[data-q="sum-total"]')).toHaveText("3");
  await page.locator("label:has(#q-size-10)").click();
  await expect(page.locator('[data-q="size-box"]')).toBeHidden();
  await expect(page.locator('[data-q="of"]')).toHaveText(" / 10");
});
