// E2E quiz Kanji /kanji/quiz/ và bộ thủ /kanji/bo-thu/quiz/ (Q5): bộ lọc + URL, tải deck, nút "Luyện tập", giao diện.
import { expect, optionHeights, test } from "./fixtures";

const card = '[data-q="card"]';
const prompt = '[data-q="prompt"]';

test.describe("/kanji/quiz/", () => {
  test("mặc định: N5, Giáo trình Kanji, bài 1–26, loại Hán-Việt; URL ghi bộ lọc", async ({ page }) => {
    await page.goto("kanji/quiz/");
    await expect(page.locator(card)).toBeVisible();
    await expect(page).toHaveURL(/cap=n5&xep=gt&tu=1&den=26&loai=hv/);
    await expect(page.locator('[data-q="question"]')).toHaveText("Âm Hán-Việt là gì?");
    await expect(page.locator(prompt)).toHaveAttribute("lang", "ja");
    const opts = await page.locator(".q-opt").allTextContents();
    expect(opts).toHaveLength(4);
    for (const o of opts) expect(o.replace(/^\d/, "")).toBe(o.replace(/^\d/, "").toUpperCase());
    await expect(page.locator("#q-furi-on")).toHaveCount(0); // không có furigana ở trang này
  });

  test("URL ?cap=n3&xep=gt&tu=1&den=1&loai=nghia → tải đúng file, gợi ý 'Kanji N3 · Bài 1'", async ({ page }) => {
    const loaded: string[] = [];
    page.on("request", (r) => {
      if (r.url().endsWith(".json")) loaded.push(r.url().split("/").pop()!);
    });
    await page.goto("kanji/quiz/?cap=n3&xep=gt&tu=1&den=1&loai=nghia");
    await expect(page.locator(card)).toBeVisible();
    expect(loaded).toEqual(["gt-n3-nghia.json"]);
    for (let i = 0; i < 3; i++) {
      await expect(page.locator('[data-q="hint"]')).toContainText("Kanji N3 · Bài 1");
      await page.keyboard.press("1");
      await page.keyboard.press("Enter");
    }
  });

  test("đổi Xếp theo → khoảng bài về cả nhóm mới (Bài từ vựng N4: 26–50), URL cập nhật", async ({ page }) => {
    await page.goto("kanji/quiz/?cap=n4&tu=3&den=5");
    await expect(page.locator(card)).toBeVisible();
    await page.locator("label:has(#xep-tv)").click();
    await expect(page.locator("#q-from")).toHaveValue("26");
    await expect(page.locator("#q-to")).toHaveValue("50");
    await expect(page).toHaveURL(/cap=n4&xep=tv&tu=26&den=50/);
    await expect(page.locator('[data-q="hint"]')).toContainText("Từ vựng · Bài");
  });

  test("Cách đọc: chữ đang hỏi được tô trong từ, đáp án kana; sau khi trả lời có giải thích On/Kun", async ({ page }) => {
    await page.goto("kanji/quiz/?cap=n5&xep=tv&loai=doc");
    await expect(page.locator(card)).toBeVisible();
    const target = page.locator(`${prompt} [data-q="target"]`);
    await expect(target).toHaveCount(1);
    expect(((await target.textContent()) ?? "").length).toBe(1);
    await expect(page.locator('[data-q="hint"]')).toContainText("nghĩa:");
    await page.keyboard.press("1");
    await expect(page.locator('[data-q="explain"]')).toContainText(/đọc .+ \((âm On|âm Kun|cách đọc đặc biệt)\)/);
  });

  test("Bộ thủ của chữ: đáp án dạng 'chữ · Tên', link sang trang chữ", async ({ page }) => {
    await page.goto("kanji/quiz/?cap=n5&loai=bo");
    await expect(page.locator(card)).toBeVisible();
    await expect(page.locator('[data-q="question"]')).toHaveText("Thuộc bộ thủ nào?");
    for (const o of await page.locator(".q-opt").allTextContents()) expect(o).toMatch(/ · /);
    await page.keyboard.press("1");
    const href = await page.locator('[data-q="link"]').getAttribute("href");
    expect(decodeURIComponent(href!)).toMatch(/\/kanji\/.\/$/u);
    await page.locator('[data-q="link"]').click();
    await expect(page.locator("h1")).toBeVisible();
  });

  test("trộn đều 5 loại: lượt 20 câu → mỗi loại 4 câu", async ({ page }) => {
    await page.goto("kanji/quiz/?cap=n5&loai=hv,nghia,chu,doc,bo");
    await page.locator("label:has(#q-size-20)").click();
    await expect(page.locator('[data-q="of"]')).toHaveText(" / 20");
    const counts: Record<string, number> = {};
    for (let i = 0; i < 20; i++) {
      const k = (await page.locator('[data-q="kind"]').textContent()) ?? "";
      counts[k] = (counts[k] ?? 0) + 1;
      await page.keyboard.press("1");
      await page.keyboard.press("Enter");
    }
    expect(counts).toEqual({ "Hán-Việt": 4, "Nghĩa": 4, "Chữ": 4, "Cách đọc": 4, "Bộ thủ": 4 });
  });

  test("nút 'Luyện tập' trên trang /kanji/n5/: theo bài giáo trình và theo bài từ vựng", async ({ page }) => {
    await page.goto("kanji/n5/");
    await page.locator('[data-level-quiz]').click();
    await expect(page).toHaveURL(/kanji\/quiz\/\?cap=n5/);
    await expect(page.locator(card)).toBeVisible();

    await page.goto("kanji/n5/");
    await page.locator("#gt-n5-3 [data-lesson-quiz]").click();
    await expect(page).toHaveURL(/cap=n5&xep=gt&tu=3&den=3/);
    await expect(page.locator('[data-q="hint"]')).toContainText("Kanji N5 · Bài 3");

    await page.goto("kanji/n5/");
    await page.locator("label:has(#kview-vocab)").click();
    await page.locator("#tv-n5-4 [data-lesson-quiz]").click();
    await expect(page).toHaveURL(/cap=n5&xep=tv&tu=4&den=4/);
    await expect(page.locator('[data-q="hint"]')).toContainText("Từ vựng · Bài 4");
  });

  test("không cuộn ngang; mọi điều khiển cao 32px", async ({ page }) => {
    await page.goto("kanji/quiz/?cap=n3&loai=nghia,doc");
    await expect(page.locator(card)).toBeVisible();
    await page.keyboard.press("1");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const hs = await optionHeights(page);
    expect(hs.length).toBeGreaterThanOrEqual(6);
    expect(new Set(hs)).toEqual(new Set([32]));
  });
});

test.describe("/kanji/bo-thu/quiz/", () => {
  test("mặc định: phạm vi Kanji N5, cả 2 loại câu; URL ghi bộ lọc", async ({ page }) => {
    await page.goto("kanji/bo-thu/quiz/");
    await expect(page.locator(card)).toBeVisible();
    await expect(page).toHaveURL(/pham-vi=n5&net-tu=1&net-den=17&loai=ten,chu/);
    await expect(page.locator("[data-radical-count]")).toHaveText("Đang chọn: 145 bộ");
    await expect(page.locator("label:has(#pv-n5)")).toContainText("145");
    await expect(page.locator("label:has(#pv-tat-ca)")).toContainText("214");
  });

  test("Số nét: URL net-tu=3&net-den=3 → chỉ hỏi bộ 3 nét, đếm 31 bộ; đổi ô chọn → URL + số đếm cập nhật", async ({ page }) => {
    await page.goto("kanji/bo-thu/quiz/?pham-vi=tat-ca&net-tu=3&net-den=3");
    await expect(page.locator(card)).toBeVisible();
    await expect(page.locator("#q-snet-from")).toHaveValue("3");
    await expect(page.locator("#q-snet-to")).toHaveValue("3");
    await expect(page.locator("[data-radical-count]")).toHaveText("Đang chọn: 31 bộ");
    for (let i = 0; i < 5; i++) {
      await expect(page.locator('[data-q="hint"]')).toHaveText("3 nét");
      await page.keyboard.press("1");
      await page.keyboard.press("Enter");
    }
    await page.locator("#q-snet-to").selectOption("4");
    await expect(page).toHaveURL(/net-tu=3&net-den=4/);
    await expect(page.locator("[data-radical-count]")).toHaveText("Đang chọn: 65 bộ");
    // "từ" lớn hơn "đến" → kéo "đến" theo
    await page.locator("#q-snet-from").selectOption("6");
    await expect(page.locator("#q-snet-to")).toHaveValue("6");
  });

  test("phạm vi + số nét không còn bộ nào → 'Đang chọn: 0 bộ' và thông báo rỗng", async ({ page }) => {
    await page.goto("kanji/bo-thu/quiz/?pham-vi=n5&net-tu=17&net-den=17");
    await expect(page.locator("[data-radical-count]")).toHaveText("Đang chọn: 0 bộ");
    await expect(page.locator('[data-q="empty"]')).toBeVisible();
  });

  test("Tên bộ: hỏi chữ bộ → chọn 'Tên · nghĩa'; link sang trang bộ thủ", async ({ page }) => {
    await page.goto("kanji/bo-thu/quiz/?loai=ten");
    await expect(page.locator(card)).toBeVisible();
    await expect(page.locator('[data-q="question"]')).toHaveText("Tên bộ thủ này là gì?");
    await expect(page.locator('[data-q="hint"]')).toHaveText(/^\d+ nét$/);
    await page.keyboard.press("1");
    await expect(page.locator('[data-q="link"]')).toHaveAttribute("href", /\/kanji\/bo-thu\/(\d+\/|#net-\d+)$/);
  });

  test("Chữ của bộ, phạm vi cả 214: đề tiếng Việt, đáp án chữ bộ", async ({ page }) => {
    await page.goto("kanji/bo-thu/quiz/?pham-vi=tat-ca&loai=chu");
    await expect(page.locator(card)).toBeVisible();
    await expect(page.locator("#pv-tat-ca")).toBeChecked();
    await expect(page.locator(prompt)).toHaveAttribute("lang", "vi");
    await expect(page.locator('[data-q="question"]')).toHaveText("Bộ thủ nào?");
  });

  test("nút 'Luyện tập' ở trang /kanji/bo-thu/; không cuộn ngang; điều khiển 32px", async ({ page }) => {
    await page.goto("kanji/bo-thu/");
    await page.locator("[data-radical-quiz]").click();
    await expect(page).toHaveURL(/kanji\/bo-thu\/quiz\//);
    await expect(page.locator(card)).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(new Set(await optionHeights(page))).toEqual(new Set([32]));
  });
});
