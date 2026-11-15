// E2E quiz từ vựng /vocabulary/quiz/ (Q4): tải deck khi bấm Bắt đầu, URL, loại câu, nút "Luyện tập bài này",
// khóa tùy chọn trong lúc làm bài (trừ Furigana).
import { backToSetup, expect, optionHeights, startQuiz, test } from "./fixtures";

const card = '[data-q="card"]';
const prompt = '[data-q="prompt"]';

test("mặc định: N5, bài 1–25, loại Nghĩa; chưa tải deck trước khi bấm Bắt đầu", async ({ page }) => {
  const loaded: string[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith(".json")) loaded.push(r.url().split("/").pop()!);
  });
  await page.goto("vocabulary/quiz/");
  await expect(page).toHaveURL(/cap=n5&tu=1&den=25&loai=nghia/);
  await expect(page.locator(card)).toBeHidden();
  expect(loaded).toEqual([]);
  await startQuiz(page);
  expect(loaded).toEqual(["n5-nghia.json"]);
  await expect(page.locator('[data-q="question"]')).toHaveText("Nghĩa là gì?");
  await expect(page.locator(prompt)).toHaveAttribute("lang", "ja");
  await expect(page.locator(".q-opt")).toHaveCount(4);
});

test("URL ?cap=n4&tu=30&den=30&loai=hv → Hán-Việt bài 30, đáp án viết hoa", async ({ page }) => {
  await page.goto("vocabulary/quiz/?cap=n4&tu=30&den=30&loai=hv");
  await expect(page.locator("#cap-n4")).toBeChecked();
  await expect(page.locator("#q-from")).toHaveValue("30");
  await expect(page.locator("#q-to")).toHaveValue("30");
  await expect(page.locator("#loai-hv")).toBeChecked();
  await expect(page.locator("#loai-nghia")).not.toBeChecked();
  await startQuiz(page);
  for (let i = 0; i < 4; i++) {
    await expect(page.locator('[data-q="info"]')).toContainText("Bài 30");
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
  await page.locator("label:has(#q-size-20)").click();
  await startQuiz(page);
  expect(loaded.sort()).toEqual(["n5-doc.json", "n5-nghia.json", "n5-tu.json"]);
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
  await page.locator("label:has(#cap-n3)").click();
  await expect(page.locator("#q-from")).toHaveValue("1");
  await expect(page.locator("#q-to")).toHaveValue("14");
  await expect(page).toHaveURL(/cap=n3&tu=1&den=14/);
  await startQuiz(page);
  await expect(page.locator('[data-q="info"]')).toContainText("N3 · Bài");
});

test("đang làm bài: khóa Cấp, Bài, Loại câu, Số câu; Furigana vẫn đổi được; Đổi tùy chọn → mở khóa", async ({ page }) => {
  await page.goto("vocabulary/quiz/?loai=tu");
  await startQuiz(page);
  await expect(page.locator('[data-q="start"]')).toBeHidden();
  for (const sel of ["#cap-n4", "#q-from", "#q-to", "#loai-doc", "#q-size-20", "#q-size-custom"]) await expect(page.locator(sel)).toBeDisabled();
  // khung thu gọn còn 1 dòng tóm tắt; Furigana đổi bằng nút trong thẻ (bật/tắt chính radio của bảng)
  await expect(page.locator(".quiz-options > *:visible")).toHaveCount(0);
  const furi = page.locator('[data-q="furi-btn"]');
  await expect(furi).toHaveAttribute("aria-pressed", "true");
  await furi.click();
  await expect(furi).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#q-furi-off")).toBeChecked();
  await expect(page.locator('[data-q="locked-summary"]')).toHaveText("Cấp: N5 · Bài: 1 – 25 · Loại câu: Từ · Số câu: 10");
  await backToSetup(page);
  await expect(page.locator(card)).toBeHidden();
  await expect(page.locator("#cap-n4")).toBeVisible(); // mở lại đủ các dòng
  await expect(page.locator("#q-from")).toBeVisible();
  await expect(page.locator("#cap-n4")).toBeEnabled();
  await page.locator("label:has(#cap-n4)").click();
  await expect(page).toHaveURL(/cap=n4/);
  await startQuiz(page);
  await expect(page.locator('[data-q="info"]')).toContainText(/Bài (2[6-9]|[34]\d|50)/);
});

test("bỏ hết loại câu → bấm Bắt đầu báo rỗng, không lỗi", async ({ page }) => {
  await page.goto("vocabulary/quiz/");
  await page.locator("label:has(#loai-nghia)").click();
  await page.locator('[data-q="start"]').click();
  await expect(page.locator('[data-q="empty"]')).toBeVisible();
  await expect(page.locator("#loai-nghia")).toBeEnabled();
});

test("điền từ: câu có chỗ trống, gợi ý là câu dịch tiếng Việt", async ({ page }) => {
  await page.goto("vocabulary/quiz/?cap=n5&tu=1&den=3&loai=dien");
  await startQuiz(page);
  await expect(page.locator(prompt)).toContainText("＿＿＿");
  await expect(page.locator('[data-q="question"]')).toHaveText("Điền từ thích hợp");
  await expect(page.locator('[data-q="hint"]')).not.toBeEmpty();
});

test("điền từ đã chia (Q4b): bài 14 có câu thể て — 4 lựa chọn đều đuôi て/で, giải thích ghi tên thể", async ({ page }) => {
  await page.goto("vocabulary/quiz/?cap=n5&tu=14&den=14&loai=dien");
  await page.locator("label:has(#q-size-20)").click();
  await startQuiz(page);
  let found = 0;
  for (let i = 0; i < 20 && (await page.locator(prompt).isVisible()); i++) {
    // chữ hiển thị của lựa chọn: bỏ furigana (rt) và số thứ tự phím tắt
    const opts = await page.locator(".q-opt").evaluateAll((els) =>
      els.map((el) => {
        const c = el.cloneNode(true) as HTMLElement;
        c.querySelectorAll("rt, kbd, .kbd-hint").forEach((x) => x.remove());
        return (c.textContent ?? "").replace(/^\s*\d\s*/, "").trim();
      }),
    );
    const te = opts.filter((o) => /[てで]$/.test(o)).length;
    await page.keyboard.press("1");
    if (te >= 3) {
      expect(opts.every((o) => /[てで]$/.test(o)), opts.join(" / ")).toBe(true);
      await expect(page.locator('[data-q="explain"]')).toContainText(/ = Thể て/);
      found++;
    }
    await page.keyboard.press("Enter");
  }
  expect(found).toBeGreaterThan(0);
});

test("mạng chậm → hiện 'Đang tải câu hỏi…' rồi mới ra câu hỏi", async ({ page }) => {
  await page.route("**/vocabulary/quiz/*.json", async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await page.goto("vocabulary/quiz/?loai=doc");
  await page.locator('[data-q="start"]').click();
  await expect(page.locator('[data-q="loading"]')).toBeVisible();
  await expect(page.locator('[data-q="loading"]')).toHaveText("Đang tải câu hỏi…");
  await expect(page.locator(card)).toBeVisible({ timeout: 15_000 });
});

test("lỗi mạng → báo lỗi, mở khóa tùy chọn; bấm Bắt đầu lại thì tải lại", async ({ page, jsErrors }) => {
  let fail = true;
  await page.route("**/vocabulary/quiz/*.json", (route) => (fail ? route.abort() : route.continue()));
  await page.goto("vocabulary/quiz/?loai=doc");
  await page.locator('[data-q="start"]').click();
  await expect(page.locator('[data-q="loading"]')).toContainText("Không tải được");
  await expect(page.locator("#loai-nghia")).toBeEnabled();
  fail = false;
  await startQuiz(page);
  jsErrors.length = 0; // lỗi tải tài nguyên do cố ý chặn — không phải lỗi trang
});

test("trả lời → link tới đúng thẻ từ trong trang bài", async ({ page }) => {
  await page.goto("vocabulary/quiz/?cap=n5&tu=4&den=4&loai=nghia");
  await startQuiz(page);
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
  await startQuiz(page);
  await expect(page.locator('[data-q="info"]')).toContainText("Bài 5");

  await page.goto("vocabulary/n3/2/");
  await page.locator("[data-lesson-quiz]").click();
  await expect(page).toHaveURL(/cap=n3&tu=2&den=2/);
  await startQuiz(page);
  await expect(page.locator('[data-q="info"]')).toContainText("N3 · Bài 2");
});

test("không cuộn ngang (nghĩa dài, câu ví dụ dài)", async ({ page }) => {
  for (const loai of ["nghia", "dien"]) {
    await page.goto(`vocabulary/quiz/?cap=n3&loai=${loai}`);
    await startQuiz(page);
    await page.keyboard.press("1");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, loai).toBeLessThanOrEqual(0);
  }
});

test("trộn đều: chọn 5 loại, lượt 20 câu → mỗi loại đúng 4 câu; nhãn loại câu hiện trên thẻ", async ({ page }) => {
  await page.goto("vocabulary/quiz/?cap=n5&loai=doc,nghia,tu,hv,dien");
  await page.locator("label:has(#q-size-20)").click();
  await startQuiz(page);
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

test("số câu tự nhập: số sai báo lỗi và không cho bắt đầu; 3 → lượt 3 câu; Đổi tùy chọn → 10 câu", async ({ page }) => {
  await page.goto("vocabulary/quiz/?cap=n5&loai=nghia");
  await page.locator("label:has(#q-size-custom)").click();
  const input = page.locator('[data-q="size-input"]');
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();
  // ô type=number tự chặn chữ; còn lại phải tự kiểm: 0, ngoài khoảng, số lẻ
  for (const bad of ["0", "101", "2.5"]) {
    await input.fill(bad);
    await input.press("Enter");
    await expect(page.locator('[data-q="size-error"]'), bad).toBeVisible();
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await page.locator('[data-q="start"]').click();
    await expect(page.locator(card), bad).toBeHidden();
  }
  await input.fill("3");
  await input.press("Enter");
  await expect(page.locator('[data-q="size-error"]')).toBeHidden();
  await startQuiz(page);
  await expect(page.locator('[data-q="of"]')).toHaveText(" / 3");
  await expect(page.locator('[data-q="total"]')).toHaveText("0");
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("1");
    await page.keyboard.press("Enter");
  }
  await expect(page.locator('[data-q="summary"]')).toBeVisible();
  await expect(page.locator('[data-q="sum-total"]')).toHaveText("3");
  await backToSetup(page);
  await page.locator("label:has(#q-size-10)").click();
  await expect(page.locator('[data-q="size-box"]')).toBeHidden();
  await startQuiz(page);
  await expect(page.locator('[data-q="of"]')).toHaveText(" / 10");
});

test("bảng tùy chọn: mọi điều khiển cao bằng nhau 32px (Cấp, Bài, Loại câu, Số câu, ô nhập số)", async ({ page }) => {
  await page.goto("vocabulary/quiz/?loai=doc,nghia");
  await page.locator("label:has(#q-size-custom)").click();
  const hs = await optionHeights(page);
  expect(hs.length).toBeGreaterThanOrEqual(5);
  expect(new Set(hs)).toEqual(new Set([32]));
});

test("Furigana: Ẩn → ẩn cách đọc ở câu hỏi và lựa chọn; phản hồi vẫn hiện; Hiện → hiện lại", async ({ page }) => {
  await page.goto("vocabulary/quiz/?cap=n5&loai=tu,dien");
  await expect(page.locator("#q-furi-on")).toBeChecked();
  await startQuiz(page);
  await page.locator('[data-q="furi-btn"]').click(); // đổi được giữa lượt (nút trong thẻ)
  const askRt = page.locator('[data-q="prompt"] rt, [data-q="options"] rt');
  let checkedAsk = false, checkedFeedback = false;
  for (let i = 0; i < 30 && !(checkedAsk && checkedFeedback); i++) {
    if ((await askRt.count()) > 0) {
      for (const v of await askRt.evaluateAll((els) => els.map((e) => getComputedStyle(e).visibility))) expect(v).toBe("hidden");
      checkedAsk = true;
    }
    await page.keyboard.press("1");
    const fbRt = page.locator('[data-q="feedback"] rt');
    if ((await fbRt.count()) > 0) {
      await expect(fbRt.first()).toBeVisible();
      checkedFeedback = true;
    }
    await page.keyboard.press("Enter");
    if (await page.locator('[data-q="summary"]').isVisible()) await page.locator('[data-q="restart"]').click();
  }
  expect(checkedAsk && checkedFeedback).toBe(true);
  await page.locator('[data-q="furi-btn"]').click();
  if ((await askRt.count()) > 0) await expect(askRt.first()).toBeVisible();
});

test("quiz đếm số không có dòng Furigana (câu hỏi không có furigana)", async ({ page }) => {
  await page.goto("dem-so/quiz/");
  await expect(page.locator("#q-furi-off")).toHaveCount(0);
  await expect(page.locator('[data-q="furi-btn"]')).toHaveCount(0);
});

test("chip Furigana trong thẻ: có chữ 'Furigana', bật = '✓ Furigana', tắt = không ✓", async ({ page }) => {
  await page.goto("vocabulary/quiz/");
  await startQuiz(page);
  const furi = page.locator('[data-q="furi-btn"]');
  // innerText = chữ đang hiển thị (dấu ✓ ẩn bằng CSS vẫn nằm trong textContent)
  await expect.poll(() => furi.innerText()).toBe("✓ Furigana");
  await furi.click();
  await expect.poll(() => furi.innerText()).toBe("Furigana");
});
