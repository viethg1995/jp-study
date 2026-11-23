// E2E trang bài từ vựng trên mobile (LessonView):
// - bảng "Hiển thị" thu gọn: mặc định chỉ hiện 3 ô bật/tắt + nút tóm tắt; PC luôn mở, không có nút;
// - vuốt ngang ở chế độ Từng thẻ: trái → thẻ sau, phải → thẻ trước (quay vòng), vuốt dọc không đổi thẻ.
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const current = ".word-list .word-card:visible";

/** Giả lập một lần vuốt (touchstart → touchend) trên thẻ đang xem. */
async function swipe(page: Page, dx: number, dy = 0): Promise<void> {
  await page.locator(current).evaluate(
    (el, [ddx, ddy]) => {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const at = (cx: number, cy: number): Touch => new Touch({ identifier: 1, target: el, clientX: cx, clientY: cy });
      el.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [at(x, y)], changedTouches: [at(x, y)] }));
      el.dispatchEvent(new TouchEvent("touchend", { bubbles: true, touches: [], changedTouches: [at(x + ddx, y + ddy)] }));
    },
    [dx, dy] as const,
  );
}

test("mobile: bảng Hiển thị thu gọn, nút ghi tóm tắt lựa chọn", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "chỉ mobile");
  await page.goto("vocabulary/1/");
  const btn = page.locator(".display-opts-btn");
  const summary = page.locator("[data-display-summary]");
  await expect(btn).toBeVisible();
  await expect(page.locator("#display-opts")).toBeHidden();
  await expect(page.locator("label:has(#toggle-furigana)")).toBeVisible();
  await expect(page.locator("label:has(#toggle-vi)")).toBeVisible();
  await expect(summary).toHaveText("Lưới · Tuần tự · Kanji");

  await btn.click();
  await expect(page.locator("#display-opts")).toBeVisible();
  await page.locator("label:has(#view-single)").click();
  await page.locator("label:has(#part-2)").click();
  await expect(summary).toHaveText("Từng thẻ · Tuần tự · Kanji · Phần 2");

  await btn.click();
  await expect(page.locator("#display-opts")).toBeHidden();
});

test("PC: bảng Hiển thị luôn mở, không có nút thu gọn", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "chỉ desktop");
  await page.goto("vocabulary/1/");
  await expect(page.locator(".display-opts-btn")).toBeHidden();
  await expect(page.locator("#display-opts")).toBeVisible();
});

test("mobile: vuốt trái/phải chuyển thẻ, quay vòng; vuốt dọc / kéo ngắn không đổi", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "chỉ mobile");
  await page.goto("vocabulary/1/");
  await page.locator(".display-opts-btn").click();
  await page.locator("label:has(#view-single)").click();
  await expect(page.locator(current)).toHaveAttribute("id", "mn-01-001");

  await swipe(page, -120);
  await expect(page.locator(current)).toHaveAttribute("id", "mn-01-002");
  await expect(page.locator(current).locator(".card-pos")).toHaveText("2 / 45");
  await expect(page.locator("#flip-mn-01-002")).not.toBeChecked(); // vuốt không lật thẻ

  await swipe(page, 120);
  await expect(page.locator(current)).toHaveAttribute("id", "mn-01-001");
  await swipe(page, 120); // thẻ đầu → vuốt phải về thẻ cuối
  await expect(page.locator(current)).toHaveAttribute("id", "mn-01-045");

  await swipe(page, -40); // kéo ngắn
  await swipe(page, -60, 150); // chủ yếu dọc
  await expect(page.locator(current)).toHaveAttribute("id", "mn-01-045");
});
