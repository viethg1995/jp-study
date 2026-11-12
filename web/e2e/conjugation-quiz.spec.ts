// E2E quiz chia thể /chia-the/quiz/ (Q6): sinh câu trên trình duyệt từ bảng chia gọn, bộ lọc + URL, câu 3 lựa chọn,
// khóa tùy chọn trong lúc làm bài (trừ Furigana).
import { backToSetup, expect, optionHeights, startQuiz, test } from "./fixtures";

const card = '[data-q="card"]';
const prompt = '[data-q="prompt"]';
const opt = ".q-opt";

test("mặc định: Động từ, Minna, đã học tới bài 50, loại Chia; bấm Bắt đầu mới tải 1 file bảng chia", async ({ page }) => {
  const loaded: string[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith(".json")) loaded.push(r.url().split("/").pop()!);
  });
  await page.goto("chia-the/quiz/");
  await expect(page).toHaveURL(/nhom=dong-tu&sach=minna&bai=50&loai=chia/);
  expect(loaded).toEqual([]);
  await expect(page.locator("#q-furi-on")).toBeChecked(); // có dòng Furigana
  await startQuiz(page);
  expect(loaded).toEqual(["dong-tu.json"]);
  await expect(page.locator('[data-q="question"]')).toHaveText(/^Chia sang /);
  await expect(page.locator(opt)).toHaveCount(4);
});

test("đã học tới bài 15: chỉ hiện 7 thể (ます…て), câu hỏi chỉ hỏi các thể đó", async ({ page }) => {
  await page.goto("chia-the/quiz/?bai=15");
  const visible = page.locator('label[data-form-group="verb"]:visible');
  await expect(visible).toHaveCount(7);
  const names = await visible.allTextContents();
  await startQuiz(page);
  for (let i = 0; i < 8; i++) {
    const q = ((await page.locator('[data-q="question"]').textContent()) ?? "").replace("Chia sang ", "");
    expect(names.some((n) => n.includes(q)), q).toBe(true);
    await expect(page.locator('[data-q="hint"]')).toHaveText(/Bài (\d|1[0-5])$/);
    await page.keyboard.press("1");
    await page.keyboard.press("Enter");
  }
});

test("Nhóm động từ: 3 lựa chọn, phím 4 không chọn gì, phím 1–3 chấm", async ({ page }) => {
  await page.goto("chia-the/quiz/?loai=nhom");
  await startQuiz(page);
  await expect(page.locator(opt)).toHaveCount(3);
  await page.keyboard.press("4");
  await expect(page.locator('[data-q="total"]')).toHaveText("0");
  await page.keyboard.press("3");
  await expect(page.locator('[data-q="total"]')).toHaveText("1");
  await expect(page.locator('[data-q="explain"]')).toContainText("Nhóm");
});

test("Nhận thể: đáp án là tên thể; sau khi trả lời có giải thích", async ({ page }) => {
  await page.goto("chia-the/quiz/?loai=the");
  await startQuiz(page);
  await expect(page.locator('[data-q="question"]')).toHaveText("Đây là thể nào?");
  await page.keyboard.press("1");
  await expect(page.locator('[data-q="explain"]')).toContainText("→");
});

test("đổi nhóm từ → Tính từ い: ẩn dòng Nhóm, ẩn loại 'Nhóm động từ', tải bảng tính từ, URL cập nhật", async ({ page }) => {
  await page.goto("chia-the/quiz/?loai=chia,nhom");
  await page.locator("label:has(#nhom-tinh-tu-i)").click();
  await expect(page).toHaveURL(/nhom=tinh-tu-i/);
  await expect(page.locator('[role="group"][aria-label="Nhóm động từ"]')).toBeHidden();
  await expect(page.locator("label:has(#loai-nhom)")).toBeHidden();
  await startQuiz(page);
  await expect(page.locator('[data-q="kind"]')).toHaveText("Chia");
});

test("Sách N3: hiện ô Bài từ–đến, ẩn 'Đã học tới'; đề là thể từ điển", async ({ page }) => {
  await page.goto("chia-the/quiz/?sach=n3&tu=2&den=3");
  await expect(page.locator("#q-from")).toBeVisible();
  await expect(page.locator("#q-upto")).toBeHidden();
  await expect(page.locator("#q-from")).toHaveValue("2");
  await startQuiz(page);
  await expect(page.locator('[data-q="hint"]')).toContainText(/N3 · Bài [23]$/);
  const reading = await page.locator(`${prompt} rt`).allTextContents();
  const text = ((await page.locator(prompt).textContent()) ?? "").replace(reading.join(""), "");
  expect(text).toMatch(/[うくぐすつぬぶむる]$/);
});

test("lọc thể từ URL (?the=te); Bỏ chọn → Bắt đầu báo rỗng; Chọn hết → chạy lại", async ({ page }) => {
  await page.goto("chia-the/quiz/?the=te");
  await startQuiz(page);
  await expect(page.locator('[data-q="question"]')).toHaveText("Chia sang Thể て");
  await backToSetup(page);
  await page.locator('button[data-forms="none"]').click();
  await page.locator('[data-q="start"]').click();
  await expect(page.locator('[data-q="empty"]')).toBeVisible();
  await page.locator('button[data-forms="all"]').click();
  await expect(page).not.toHaveURL(/the=/);
  await startQuiz(page);
});

test("đang làm bài: khóa nhóm từ, bài, thể, nút Chọn hết; Furigana vẫn đổi được", async ({ page }) => {
  await page.goto("chia-the/quiz/");
  await startQuiz(page);
  for (const sel of ["#nhom-tinh-tu-i", "#sach-n3", "#q-upto", "#dt-V1", "#the-verb-te", "#loai-the", 'button[data-forms="none"]']) {
    await expect(page.locator(sel)).toBeDisabled();
  }
  // khung thu gọn: tóm tắt + dòng Furigana
  await expect(page.locator('[data-q="locked-summary"]')).toHaveText(
    "Nhóm từ: Động từ · Sách: Minna · Đã học tới: Bài 50 · Nhóm: Tất cả · Thể: Tất cả · Loại câu: Chia · Số câu: 10",
  );
  await expect(page.locator(".quiz-options > *:visible")).toHaveCount(1);
  await expect(page.locator("#q-upto")).toBeHidden();
  await page.locator("label:has(#q-furi-off)").click();
  const rts = page.locator('[data-q="prompt"] rt, [data-q="options"] rt');
  if ((await rts.count()) > 0) {
    for (const v of await rts.evaluateAll((els) => els.map((e) => getComputedStyle(e).visibility))) expect(v).toBe("hidden");
  }
  await backToSetup(page);
  await expect(page.locator("#nhom-tinh-tu-i")).toBeEnabled();
});

test("nút Luyện tập ở trang thể và bảng chia", async ({ page }) => {
  await page.goto("chia-the/the/dong-tu/te/");
  await page.locator("[data-form-quiz]").click();
  await expect(page).toHaveURL(/chia-the\/quiz\/\?nhom=dong-tu&.*the=te/);
  await startQuiz(page);
  await expect(page.locator('[data-q="question"]')).toHaveText("Chia sang Thể て");
  await page.goto("chia-the/tinh-tu-na/");
  await page.locator("[data-group-quiz]").click();
  await expect(page).toHaveURL(/nhom=tinh-tu-na/);
  await startQuiz(page);
});

test("không cuộn ngang; điều khiển 32px", async ({ page }) => {
  await page.goto("chia-the/quiz/?loai=chia,the,nhom");
  expect(new Set(await optionHeights(page))).toEqual(new Set([32]));
  await startQuiz(page);
  await page.keyboard.press("1");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.locator(card)).toBeVisible();
});
