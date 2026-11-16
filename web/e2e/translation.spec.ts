// Luyện dịch: tab Câu đơn / Đoạn văn, trang đoạn văn (chọn chiều, furigana, chấm), trang câu đơn (chấm).
// Bản build e2e không có PUBLIC_GRADER_URL → test chèn URL máy chấm giả vào HTML trang và trả kết quả giả,
// không thêm "cửa sau" nào vào code chạy thật.
import type { Page, Request } from "@playwright/test";
import { expect, test } from "./fixtures";

const GRADER = "https://grader.test";
const PASSAGE = "dich/doan/p-n5-001/";
const PASSAGE_SENTENCES = 13;

interface Graded {
  requests: Record<string, unknown>[];
}

/** Bật máy chấm giả: sửa HTML (graderUrl + bỏ disabled nút Chấm bài) và trả GradeResult có `count` câu. */
async function fakeGrader(page: Page, count: number): Promise<Graded> {
  const graded: Graded = { requests: [] };
  await page.route(
    (url) => url.pathname.includes("/dich/"),
    async (route) => {
      if (route.request().resourceType() !== "document") return route.fallback();
      const res = await route.fetch();
      const html = (await res.text())
        .replace(/"graderUrl":"[^"]*"/, `"graderUrl":"${GRADER}"`)
        // thuộc tính disabled (không phải class "disabled:opacity-40")
        .replace(/(<button[^>]*id="t-submit"[^>]*?)\sdisabled(="")?(?=[\s>])/, "$1");
      await route.fulfill({ response: res, body: html });
    },
  );
  await page.route(`${GRADER}/grade`, async (route) => {
    const req: Request = route.request();
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    graded.requests.push(req.postDataJSON() as Record<string, unknown>);
    const sentences = Array.from({ length: count }, (_, i) => ({
      index: i + 1,
      learner: i === count - 1 ? "" : `câu ${i + 1}`,
      verdict: i === 0 ? "wrong" : i === count - 1 ? "missing" : "correct",
      corrected: i === 0 ? "câu sửa" : `câu ${i + 1}`,
      errors: i === 0 ? [{ type: "meaning", excerpt: "câu 1", explanation_vi: "Hiểu sai ý." }] : [],
    }));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ ok: true, provider: "fake", cached: false, result: { overall: "wrong", summary_vi: "Nhận xét giả.", sentences } }),
    });
  });
  return graded;
}

async function noHorizontalScroll(page: Page): Promise<void> {
  const [sw, w] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(sw).toBeLessThanOrEqual(w);
}

test("tab Câu đơn ↔ Đoạn văn, danh sách đoạn theo cấp", async ({ page }) => {
  await page.goto("dich/");
  await expect(page.locator('a[aria-current="page"]', { hasText: "Câu đơn" })).toBeVisible();
  await page.getByRole("link", { name: "Đoạn văn", exact: true }).first().click();
  await expect(page).toHaveURL(/\/dich\/doan\/$/);
  await expect(page.locator("h1")).toHaveText("Luyện dịch đoạn văn");
  await expect(page.locator("section#n5 h2")).toHaveText("N5");
  await page.locator(`a[href$="${PASSAGE}"]`).click();
  await expect(page.locator("h1")).toHaveText("Ngày chủ nhật mưa");
  await noHorizontalScroll(page);
});

test("đoạn văn: mặc định Nhật → Việt, furigana bật/tắt, đổi chiều ghi URL", async ({ page }) => {
  await page.goto(PASSAGE);
  const ja = page.locator('[data-dir-only="ja-vi"][lang="ja"]');
  const vi = page.locator('[data-dir-only="vi-ja"][lang="vi"]');
  await expect(page.locator("#dir-ja-vi")).toBeChecked();
  await expect(ja).toBeVisible();
  await expect(vi).toBeHidden();
  await expect(ja.locator("p")).toHaveCount(3); // 3 đoạn (para)
  await expect(page.locator("#t-answer")).toHaveAttribute("lang", "vi");

  const rt = ja.locator("rt").first();
  await expect(rt).toHaveCSS("visibility", "visible");
  await page.getByText("Ẩn furigana").click();
  await expect(rt).toHaveCSS("visibility", "hidden");

  await page.locator('label:has(#dir-vi-ja)').click();
  await expect(page).toHaveURL(/chieu=vi-ja/);
  await expect(vi).toBeVisible();
  await expect(ja).toBeHidden();
  await expect(page.getByText("Ẩn furigana")).toBeHidden();
  await expect(page.locator("#t-answer")).toHaveAttribute("lang", "ja");
  await noHorizontalScroll(page);
});

test("đoạn văn: ?chieu=vi-ja mở đúng chiều; đổi chiều khi đã có chữ thì hỏi", async ({ page }) => {
  await page.goto(`${PASSAGE}?chieu=vi-ja`);
  await expect(page.locator("#dir-vi-ja")).toBeChecked();
  await page.locator("#t-answer").fill("わたしは");

  page.once("dialog", (d) => void d.dismiss());
  await page.locator('label:has(#dir-ja-vi)').click();
  await expect(page.locator("#dir-vi-ja")).toBeChecked();
  await expect(page.locator("#t-answer")).toHaveValue("わたしは");

  page.once("dialog", (d) => void d.accept());
  await page.locator('label:has(#dir-ja-vi)').click();
  await expect(page.locator("#dir-ja-vi")).toBeChecked();
  await expect(page.locator("#t-answer")).toHaveValue("");
  await expect(page).toHaveURL(/chieu=ja-vi/);
});

test("đoạn văn: chấm bài gửi đúng chiều, hiện câu gốc + kết quả từng câu", async ({ page }) => {
  const graded = await fakeGrader(page, PASSAGE_SENTENCES);
  await page.goto(PASSAGE);
  await page.locator("#t-answer").fill("Vào chủ nhật tôi chơi quần vợt.");
  await page.locator("#t-submit").click();

  const items = page.locator("#t-sentences > li");
  await expect(items).toHaveCount(PASSAGE_SENTENCES);
  expect(graded.requests[0]).toMatchObject({ exerciseId: "p-n5-001", direction: "ja-vi" });
  await expect(page.locator("#t-summary")).toContainText(`Đúng ${PASSAGE_SENTENCES - 2} / ${PASSAGE_SENTENCES} câu`);
  // câu gốc (tiếng Nhật) hiện trên mỗi câu; bài làm tiếng Việt không mang font Nhật
  await expect(items.first().locator(".t-source")).toHaveAttribute("lang", "ja");
  await expect(items.first().locator(".t-learner")).toHaveAttribute("lang", "vi");
  await expect(items.first()).toHaveAttribute("data-verdict", "wrong");
  await expect(items.last()).toHaveAttribute("data-verdict", "missing");

  // đổi chiều → kết quả cũ biến mất
  page.once("dialog", (d) => void d.accept());
  await page.locator('label:has(#dir-vi-ja)').click();
  await expect(page.locator("#t-result")).toBeHidden();
  await page.locator("#t-answer").fill("わたしは日曜日にテニスをします。");
  await page.locator("#t-submit").click();
  await expect(items).toHaveCount(PASSAGE_SENTENCES);
  expect(graded.requests[1]).toMatchObject({ exerciseId: "p-n5-001", direction: "vi-ja" });
  await expect(items.first().locator(".t-learner")).toHaveAttribute("lang", "ja");
  await noHorizontalScroll(page);
});

test("câu đơn: chấm bài hiện kết quả (không gửi direction)", async ({ page }) => {
  const graded = await fakeGrader(page, 5);
  await page.goto("dich/t-01-01/");
  await page.locator("#t-answer").fill("わたしはランです。");
  await page.locator("#t-submit").click();
  await expect(page.locator("#t-sentences > li")).toHaveCount(5);
  expect(graded.requests[0]).toMatchObject({ exerciseId: "t-01-01" });
  expect(graded.requests[0]).not.toHaveProperty("direction");
  await noHorizontalScroll(page);
});
