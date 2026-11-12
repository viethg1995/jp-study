// Fixture chung cho e2e:
// - chặn mạng ngoài (Google Fonts…): test không phụ thuộc Internet, sự kiện load không phải chờ font;
// - mọi test tự fail nếu trang có lỗi JS hoặc console.error.
import { test as base, expect, type Page } from "@playwright/test";

export const test = base.extend<{ jsErrors: string[] }>({
  jsErrors: [
    async ({ page }, use) => {
      await page.route(/^https?:\/\/(?!localhost[:/])/, (route) =>
        route.request().resourceType() === "stylesheet"
          ? route.fulfill({ status: 200, contentType: "text/css", body: "" })
          : route.abort(),
      );
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await use(errors);
      expect(errors, "lỗi JS/console trên trang").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

/** Màu thật (rgb) của một token CSS, vd "--color-success". */
export async function tokenColor(page: Page, token: string, prop: "color" | "backgroundColor" = "color"): Promise<string> {
  return page.evaluate(
    ([t, p]) => {
      const el = document.createElement("span");
      el.style[p as "color"] = `var(${t})`;
      document.body.append(el);
      const c = getComputedStyle(el)[p as "color"];
      el.remove();
      return c;
    },
    [token, prop] as const,
  );
}

/** Chiều cao (px) của mọi điều khiển trong bảng "Tùy chọn luyện tập" — phải bằng nhau (2rem). */
export async function optionHeights(page: Page): Promise<number[]> {
  return page
    .locator(
      // dải liền (overflow-hidden) đo cả dải; dải xuống dòng (flex-wrap) đo từng nút — khung của nó cao theo số dòng
      ".quiz-options select, .quiz-options input[type=number], .quiz-options .combo-trigger, .quiz-options [role=radiogroup] > div.overflow-hidden, .quiz-options [role=radiogroup] > div.flex-wrap > label, .quiz-options [role=group] label",
    )
    .evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => Math.round(e.getBoundingClientRect().height)));
}
