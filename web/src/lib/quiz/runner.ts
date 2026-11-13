// Phần chạy trên trình duyệt của components/quiz/QuizRunner.astro — chỉ vẽ DOM theo Session (session.ts).
// Trang gọi: const quiz = mountQuiz(root); quiz.setFilter(filter) — lần đầu và mỗi khi bộ lọc đổi.
// Luồng: THIẾT LẬP (chỉ bảng tùy chọn + nút "Bắt đầu") → bấm Bắt đầu: tải câu hỏi, KHÓA mọi tùy chọn trừ dòng
// [data-q-keep] (Furigana) → hết lượt: "Lượt mới" / "Làm lại câu sai" giữ tùy chọn, "Đổi tùy chọn" mở khóa về thiết lập.
// Câu hay sai (Q10): mỗi câu trả lời ghi vào jp:quiz:wrong (lib/quiz/wrong.ts qua lib/storage.ts); dòng "Câu hỏi" chọn
// "Câu hay sai" → áp thêm lên bộ lọc của trang, URL ?on=sai (runner tự gắn sau khi trang ghi URL trong setFilter).
// Gõ kana (Q9): dòng "Trả lời" chọn "Gõ kana" → câu loại gõ được (typing.ts) hiện ô nhập thay 4 lựa chọn, romaji chuyển
// kana ngay khi gõ (romaji.ts), chấm bằng Session.answerTyped; URL ?tra-loi=go (gắn như ?on=sai).
import { groupByTarget, parseRuby } from "../ruby";
import { isRuby } from "./validate";
import { filterItems, partOf } from "./core";
import { mulberry32, randomSeed } from "./random";
import { type AnswerResult, type Question, type Session, createSession } from "./session";
import type { Deck, Filter, QuizItem } from "./types";
import { KEYS, readString, storageAvailable, writeString } from "../storage";
import { toKana } from "./romaji";
import { isTypable } from "./typing";
import { REMEMBER_STREAK, type WrongStore, clearWrong, countWrong, parseStore, recordAnswer, reviewItems } from "./wrong";

export interface QuizController {
  /**
   * Ghi nhận bộ lọc (chỉ có tác dụng ở bước thiết lập; tải + bắt đầu khi người học bấm "Bắt đầu").
   * `decks`: URL các file Deck cần dùng (tải song song, nhớ đệm theo URL); bỏ trống = giữ dữ liệu hiện có
   * (nhúng sẵn / data-src). Mảng rỗng = không có câu nào.
   * `toItems`: file không phải Deck (bảng chia gọn của quiz chia thể, Q6-1) → hàm sinh câu chạy trên trình duyệt,
   * nhận JSON các file theo thứ tự `decks`; gọi lại mỗi lần setFilter (file vẫn nhớ đệm, không tải lại).
   */
  setFilter(filter: Filter, decks?: readonly string[], toItems?: (data: unknown[]) => QuizItem[]): void;
}

const JA = /[぀-ヿ㐀-鿿豈-﫿々]/u;
const OPTION_CLASS =
  "q-opt rounded-md border border-line bg-surface px-3 py-3 text-left text-lg text-ink hover:border-primary-line hover:bg-primary-soft disabled:cursor-default " +
  "data-[state=right]:border-success data-[state=right]:font-semibold data-[state=right]:text-success " +
  "data-[state=wrong]:border-danger data-[state=wrong]:bg-danger-soft data-[state=wrong]:text-danger";

/**
 * Vẽ chuỗi ruby {漢字|かな} thành <ruby> bằng DOM (không innerHTML); chuỗi thường giữ nguyên văn.
 * Phần [[…]] (chữ đang hỏi, vd [[大]]学) tô màu nhấn + gạch chân.
 */
export function renderRuby(el: HTMLElement, s: string): void {
  const segs = isRuby(s) ? parseRuby(s) : [{ text: s, reading: null, target: false }];
  el.replaceChildren(
    ...groupByTarget(segs).map((g) => {
      const nodes = g.segs.map((seg) => {
        if (!seg.reading) return document.createTextNode(seg.text);
        const ruby = document.createElement("ruby");
        const rt = document.createElement("rt");
        rt.textContent = seg.reading;
        ruby.append(seg.text, rt);
        return ruby;
      });
      if (!g.target) return nodes;
      const mark = document.createElement("span");
      mark.dataset.q = "target";
      mark.className = "text-primary underline decoration-2 underline-offset-8";
      mark.append(...nodes);
      return [mark];
    }).flat(),
  );
  const ja = JA.test(s);
  el.lang = ja ? "ja" : "vi";
  el.classList.toggle("jp", ja);
}

function rubySpan(s: string): HTMLSpanElement {
  const span = document.createElement("span");
  renderRuby(span, s);
  return span;
}

export function mountQuiz(root: HTMLElement): QuizController {
  const q = <T extends HTMLElement = HTMLElement>(name: string): T => {
    const el = root.querySelector<T>(`[data-q="${name}"]`);
    if (!el) throw new Error(`QuizRunner: thiếu [data-q="${name}"]`);
    return el;
  };
  const card = q("card"), summary = q("summary"), empty = q("empty"), loading = q("loading");
  const prompt = q("prompt"), hint = q("hint"), optionsBox = q("options");
  const feedback = q("feedback"), verdict = q("verdict"), accepted = q("accepted"), explain = q("explain");
  const link = q<HTMLAnchorElement>("link"), next = q<HTMLButtonElement>("next"), question = q("question");
  const defaultQuestion = question.textContent ?? "";
  const progress = q("progress"), progressbar = q("progressbar");
  const finishConfirm = q("finish-confirm"), finishOk = q<HTMLButtonElement>("finish-ok"), finishCancel = q<HTMLButtonElement>("finish-cancel");
  const infoWrap = q("info-wrap"), infoBtn = q<HTMLButtonElement>("info-btn"), infoPop = q("info");
  const kindBadge = q("kind"), sizeBox = q("size-box"), sizeInput = q<HTMLInputElement>("size-input"), sizeError = q("size-error");
  const kindsEl = root.querySelector("script[data-quiz-kinds]");
  const kindLabels = kindsEl ? (JSON.parse(kindsEl.textContent ?? "{}") as Record<string, string>) : {};
  // Trộn đều: "kind" = theo loại câu; "part" = theo phần học (tiền tố loại câu: v-, k-, c-, n-), trong phần theo loại câu
  const balance = root.dataset.balance;
  const groupOf = balance === "kind" ? (it: QuizItem): string => it.kind : balance === "part" ? partOf : undefined;
  const subOf = balance === "part" ? (it: QuizItem): string => it.kind : undefined;
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/?$/, "/");
  const rng = mulberry32(randomSeed());

  const startBar = q("start-bar"), startBtn = q<HTMLButtonElement>("start"), lockedNote = q("locked-note"), lockedSummary = q("locked-summary");
  const optionsPanel = root.querySelector<HTMLElement>(".quiz-options")!;

  // Câu hay sai (Q10)
  const canStore = storageAvailable();
  const wrongKinds = (root.dataset.wrongKinds ?? "").split(" ").filter(Boolean);
  const wrongRow = q("wrong-row"), wrongClear = q<HTMLButtonElement>("wrong-clear");
  const reviewAll = root.querySelector<HTMLInputElement>("#q-review-all")!, reviewWrong = root.querySelector<HTMLInputElement>("#q-review-wrong")!;
  const emptyText = empty.textContent ?? "";
  const loadStore = (): WrongStore => parseStore(readString(KEYS.quizWrong));
  const reviewing = (): boolean => canStore && reviewWrong.checked;
  // Gõ kana (Q9) — trang không bật `typing` thì không có dòng "Trả lời"
  const ansType = root.querySelector<HTMLInputElement>("#q-ans-type");
  const answerRow = root.querySelector<HTMLElement>('[data-q="answer-row"]');
  const typeBox = q<HTMLFormElement>("type-box"), typeInput = q<HTMLInputElement>("type-input");
  const typeSubmit = q<HTMLButtonElement>("type-submit"), typeGiveup = q<HTMLButtonElement>("type-giveup");
  const typedLine = q("typed"), typeNote = q("type-note"), kbdHint = q("kbd-hint");
  const typingMode = (): boolean => !!ansType?.checked;
  /** Câu hiện tại đang hỏi bằng ô nhập. */
  let typingNow = false;
  /** Kết quả lượt đang làm: số câu vừa lưu (sai) và số câu đã nhớ (đúng đủ REMEMBER_STREAK lần). */
  let roundSaved = 0, roundRemembered = 0;

  let all: QuizItem[] | null = null;
  let filter: Filter | null = null;
  let session: Session | null = null;
  /** Đang làm bài (đã bấm Bắt đầu) — tùy chọn bị khóa. */
  let running = false;
  /** File cần tải khi bấm Bắt đầu (setFilter / data-src); null = dùng `all` có sẵn. */
  let pending: { decks: readonly string[]; toItems?: (data: unknown[]) => QuizItem[] } | null = null;
  let disabledByLock: (HTMLInputElement | HTMLSelectElement | HTMLButtonElement)[] = [];
  let hiddenByLock: HTMLElement[] = [];

  /**
   * Tóm tắt tùy chọn đang chọn từ chính các dòng của bảng (không cần trang khai báo):
   * "Nhóm từ: Động từ · Đã học tới: Bài 50 · Thể: Tất cả · Số câu: 20". Dòng đang ẩn bị bỏ qua.
   */
  function summarize(): string {
    const parts: string[] = [];
    const clean = (el: Element): string => (el.textContent ?? "").replace("✓", "").replace(/\s+/g, " ").trim();
    for (const row of optionsPanel.children) {
      if (!(row instanceof HTMLElement) || row.hidden || row.matches("[data-q-keep]") || row.offsetParent === null) continue;
      if (row === wrongRow && !reviewing()) continue; // "Câu hỏi: Tất cả" là mặc định → không ghi vào tóm tắt
      if (row === answerRow && !typingMode()) continue; // "Trả lời: Chọn đáp án" cũng vậy
      const label = row.querySelector(".seg-label")?.textContent?.replace(/:\s*$/, "").trim();
      if (!label) continue;
      let value: string;
      const boxes = [...row.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].filter((b) => !b.closest("label")?.hidden);
      const radio = row.querySelector<HTMLInputElement>('input[type="radio"]:checked');
      const selects = [...row.querySelectorAll("select")];
      const combo = row.querySelector(".combo-text");
      if (boxes.length > 0) {
        const on = boxes.filter((b) => b.checked).map((b) => clean(b.closest("label")!));
        value = on.length === boxes.length && boxes.length > 1 ? "Tất cả" : on.length > 3 ? `${on.slice(0, 3).join(", ")}… (${on.length})` : on.join(", ") || "—";
      } else if (radio) {
        value = radio.id === "q-size-custom" ? sizeInput.value : clean(radio.closest("label")!);
      } else if (selects.length > 0) {
        value = selects.map((x) => x.selectedOptions[0]?.textContent?.trim() ?? "").join(" – ");
      } else if (combo) {
        value = clean(combo);
      } else continue;
      parts.push(`${label}: ${value}`);
    }
    return parts.join(" · ");
  }

  /** Số câu tự nhập: số nguyên 1–100 (lượt dài hơn không ai làm hết), sai → null. */
  const customSize = (): number | null => {
    const raw = sizeInput.value.trim();
    const n = Number(raw);
    return /^\d+$/.test(raw) && n >= 1 && n <= 100 ? n : null;
  };
  const sizeId = (): string => root.querySelector<HTMLInputElement>('input[name="q-size"]:checked')?.id ?? "q-size-10";
  const roundSize = (): number | null => {
    const id = sizeId();
    if (id === "q-size-custom") return customSize() ?? 10;
    return Number(id.replace("q-size-", "")) || 10;
  };
  const show = (el: HTMLElement | null): void => {
    for (const x of [card, summary, empty, loading]) x.classList.toggle("hidden", x !== el);
  };

  /** Câu của bộ lọc; chế độ "Câu hay sai" → chỉ câu đã lưu, sai nhiều / gần đây trước. */
  function basePool(): QuizItem[] {
    const pool = filterItems(all ?? [], filter ?? {});
    return reviewing() ? reviewItems(pool, loadStore(), rng) : pool;
  }

  function start(items?: QuizItem[], limit?: number | null): void {
    if (!all || !filter) return;
    let size = limit === undefined ? roundSize() : limit;
    let pool = items ?? basePool();
    // ôn câu sai: lượt lấy các câu đứng đầu (sai nhiều trước), không hỏi vòng lại khi ít câu hơn số câu/lượt
    if (!items && reviewing()) {
      pool = pool.slice(0, size ?? pool.length);
      size = pool.length;
    }
    roundSaved = 0;
    roundRemembered = 0;
    session = createSession(pool, rng, size, groupOf, subOf);
    render();
  }

  /** Khóa / mở bảng tùy chọn; dòng [data-q-keep] (Furigana) luôn dùng được. */
  function lock(on: boolean): void {
    running = on;
    if (on) {
      disabledByLock = [...optionsPanel.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>("input, select, button")].filter(
        (el) => !el.disabled && !el.closest("[data-q-keep]"),
      );
      for (const el of disabledByLock) el.disabled = true;
      lockedSummary.textContent = summarize();
      // thu gọn: chỉ còn 1 dòng tóm tắt (Furigana đổi bằng chip trong thẻ); nhớ dòng nào mình ẩn để mở lại đúng
      hiddenByLock = [...optionsPanel.children].filter((el): el is HTMLElement => el instanceof HTMLElement && !el.hidden && el !== lockedNote);
      syncFuri();
      for (const el of hiddenByLock) el.hidden = true;
      optionsPanel.dataset.locked = "";
    } else {
      for (const el of disabledByLock) el.disabled = false;
      disabledByLock = [];
      for (const el of hiddenByLock) el.hidden = false;
      hiddenByLock = [];
      delete optionsPanel.dataset.locked;
    }
    startBar.classList.toggle("hidden", on);
    lockedNote.classList.toggle("hidden", !on);
  }

  /** Nút "Bắt đầu": kiểm số câu tự nhập → khóa → tải (nếu cần) → lượt đầu. */
  function begin(): void {
    if (running || !filter) return;
    if (sizeId() === "q-size-custom" && !applyCustom()) {
      sizeInput.focus();
      return;
    }
    lock(true);
    const go = (): void => {
      if (basePool().length === 0) {
        lock(false);
        empty.textContent = reviewing() ? "Không có câu sai nào trong bộ lọc này. Chọn \"Tất cả\" hoặc nới bộ lọc." : emptyText;
        show(empty);
        return;
      }
      start();
      card.scrollIntoView({ block: "start", behavior: "smooth" });
    };
    if (pending) loadDecks(pending.decks, go, pending.toItems);
    else go();
  }

  /** "Đổi tùy chọn": bỏ lượt, mở khóa, về bước thiết lập. */
  function setup(): void {
    token++; // bỏ kết quả tải đang dở (nếu có)
    session = null;
    lock(false);
    refreshWrong(); // số câu sai đã đổi sau lượt; hết câu → về "Tất cả"
    syncReviewUrl();
    show(null);
    startBtn.focus();
  }

  function render(): void {
    if (!session) return;
    const cur = session.current;
    if (cur) renderQuestion(cur);
    else if (session.done) renderSummary();
    else show(empty);
  }

  // Chip "✓ Furigana" trong thẻ: bật/tắt chính radio Furigana của bảng tùy chọn (CSS ẩn furigana đọc radio này)
  const furiBtn = root.querySelector<HTMLButtonElement>('[data-q="furi-btn"]');
  const furiOn = root.querySelector<HTMLInputElement>("#q-furi-on"), furiOff = root.querySelector<HTMLInputElement>("#q-furi-off");
  function syncFuri(): void {
    furiBtn?.setAttribute("aria-pressed", String(!!furiOn?.checked));
  }
  furiBtn?.addEventListener("click", () => {
    if (!furiOn || !furiOff) return;
    (furiOn.checked ? furiOff : furiOn).checked = true;
    syncFuri();
  });
  for (const r of [furiOn, furiOff]) r?.addEventListener("change", syncFuri);

  /** Thanh tiến độ: số câu đã trả lời / số câu của lượt. */
  function updateProgress(): void {
    const s = session;
    const pct = s && s.limit ? Math.min(100, Math.round((s.total / s.limit) * 100)) : 0;
    progress.style.width = `${pct}%`;
    progressbar.setAttribute("aria-valuenow", String(pct));
  }

  /** Đề ngắn (nowrap) rộng hơn thẻ → thu cỡ chữ cho vừa, tối thiểu 20px. */
  function fitPrompt(): void {
    prompt.style.fontSize = "";
    if (!prompt.classList.contains("whitespace-nowrap")) return;
    const box = prompt.parentElement!.clientWidth;
    const w = prompt.getBoundingClientRect().width;
    if (box > 0 && w > box) {
      const size = parseFloat(getComputedStyle(prompt).fontSize);
      prompt.style.fontSize = `${Math.max(20, Math.floor((size * box) / w))}px`;
    }
  }
  window.addEventListener("resize", () => {
    if (!card.classList.contains("hidden")) fitPrompt();
  });

  function renderQuestion(cur: Question): void {
    const s = session!;
    show(card);
    q("index").textContent = String(s.total + 1);
    q("of").textContent = s.limit === null ? "" : ` / ${s.limit}`;
    const kindLabel = kindLabels[cur.item.kind];
    kindBadge.classList.toggle("hidden", !kindLabel);
    kindBadge.textContent = kindLabel ?? "";
    q("right").textContent = String(s.right);
    q("total").textContent = String(s.total);

    renderRuby(prompt, cur.item.prompt);
    const long = cur.item.prompt.length > 12;
    // đề: 46px (tiếng Nhật ngắn) / 22px — nhỏ hơn 48/24 cũ 2px để câu hỏi bên dưới nổi hơn (user 2026-11-13).
    // Đề ngắn không xuống dòng giữa từ (コピーしまし / ょう) → nowrap + thu nhỏ cho vừa bề ngang (fitPrompt).
    const big = cur.item.promptLang === "ja" && !long;
    for (const c of ["text-[2.875rem]", "leading-none", "whitespace-nowrap"]) prompt.classList.toggle(c, big);
    for (const c of ["text-[1.375rem]", "leading-snug"]) prompt.classList.toggle(c, !big);
    fitPrompt();
    finishConfirm.hidden = true;
    updateProgress();
    question.textContent = cur.item.question ?? defaultQuestion;
    hint.textContent = cur.item.hint ?? "";
    hint.classList.toggle("hidden", !cur.item.hint);
    // thông tin phụ trong ô ⓘ ("\n" = xuống dòng, ô có whitespace-pre-line)
    setInfo(false);
    infoPop.textContent = cur.item.info ?? "";
    infoWrap.hidden = !cur.item.info;

    optionsBox.replaceChildren(
      ...cur.options.map((opt, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = OPTION_CLASS;
        const num = document.createElement("span");
        num.className = "mr-2 text-xs text-ink-faint";
        num.textContent = String(i + 1);
        b.append(num, rubySpan(opt));
        b.addEventListener("click", () => choose(i));
        return b;
      }),
    );
    feedback.classList.add("hidden");
    next.disabled = true;

    typingNow = typingMode() && isTypable(cur.item);
    optionsBox.classList.toggle("hidden", typingNow);
    typeBox.classList.toggle("hidden", !typingNow);
    typeNote.classList.toggle("hidden", !typingMode() || typingNow);
    kbdHint.textContent = typingNow ? "Gõ romaji (gakusei) hoặc kana · Enter: trả lời / câu tiếp" : "Phím 1–4 để chọn · Enter: câu tiếp";
    typeInput.value = "";
    typeInput.disabled = typeSubmit.disabled = typeGiveup.disabled = false;
    delete typeInput.dataset.state;
    if (typingNow) typeInput.focus({ preventScroll: true });
  }

  function choose(index: number): void {
    const s = session;
    const cur = s?.current;
    if (!s || !cur || typingNow) return;
    const res = s.answer(index);
    if (!res) return;
    optionsBox.querySelectorAll<HTMLButtonElement>(".q-opt").forEach((b, i) => {
      b.disabled = true;
      if (i === cur.correct) b.dataset.state = "right";
      else if (i === index) b.dataset.state = "wrong";
    });
    showResult(res);
  }

  /** Gõ kana: Trả lời (ô trống → không chấm) / Không biết. */
  function submitTyped(giveUp: boolean): void {
    const s = session;
    if (!s?.current || !typingNow) return;
    const res = s.answerTyped(typeInput.value, giveUp);
    if (!res) return typeInput.focus();
    typeInput.value = res.choice;
    typeInput.dataset.state = res.ok ? "right" : "wrong";
    typeInput.disabled = typeSubmit.disabled = typeGiveup.disabled = true;
    showResult(res, giveUp ? null : res.choice);
  }

  /** Phần chung sau khi chấm: lưu câu sai (Q10), phản hồi, tiến độ. `typed`: chữ đã gõ (câu gõ kana, sai). */
  function showResult(res: AnswerResult, typed: string | null = null): void {
    const s = session!;
    if (canStore) {
      const r = recordAnswer(loadStore(), res.item.id, res.ok, Math.floor(Date.now() / 1000));
      writeString(KEYS.quizWrong, JSON.stringify(r.store));
      if (!res.ok) roundSaved++;
      if (r.remembered) roundRemembered++;
    }
    typedLine.replaceChildren();
    if (typed !== null && !res.ok) {
      const del = document.createElement("s");
      del.className = "jp text-danger";
      del.lang = "ja";
      del.textContent = typed;
      typedLine.append("Bạn gõ: ", del);
    }
    typedLine.classList.toggle("hidden", typedLine.childNodes.length === 0);
    q("right").textContent = String(s.right);
    q("total").textContent = String(s.total);

    feedback.classList.remove("hidden");
    feedback.classList.toggle("bg-primary-soft", res.ok);
    feedback.classList.toggle("bg-danger-soft", !res.ok);
    verdict.className = res.ok ? "font-semibold text-success" : "font-semibold text-danger";
    verdict.replaceChildren(res.ok ? "Đúng!" : "Chưa đúng — đáp án: ", ...(res.ok ? [] : [rubySpan(res.item.answer)]));
    accepted.classList.toggle("hidden", res.item.accepted.length === 0);
    accepted.replaceChildren("Cũng đúng: ", ...res.item.accepted.flatMap((a, i) => (i ? [", ", rubySpan(a)] : [rubySpan(a)])));
    explain.classList.toggle("hidden", !res.item.explain);
    explain.textContent = res.item.explain ?? "";
    link.href = base + res.item.href;
    updateProgress();
    next.textContent = s.limit !== null && s.total >= s.limit ? "Xem kết quả →" : "Câu tiếp →";
    next.disabled = false;
    next.focus();
  }

  function renderSummary(): void {
    const s = session!;
    show(summary);
    q("sum-right").textContent = String(s.right);
    q("sum-total").textContent = String(s.total);
    const wrong = s.wrong();
    renderSaved();
    q("sum-perfect").classList.toggle("hidden", wrong.length > 0 || s.total === 0);
    q("sum-wrong-box").classList.toggle("hidden", wrong.length === 0);
    q("sum-wrong").replaceChildren(
      ...wrong.map((it) => {
        const li = document.createElement("li");
        li.className = "flex flex-wrap items-baseline gap-x-3 py-2";
        const a = document.createElement("a");
        a.href = base + it.href;
        a.className = "text-primary hover:underline";
        a.append(rubySpan(it.prompt));
        const ans = rubySpan(it.answer);
        ans.classList.add("font-semibold");
        li.append(a, "→", ans);
        const note = [it.hint, it.info?.replace(/\n/g, " · ")].filter(Boolean).join(" · ");
        if (note) {
          const h = document.createElement("span");
          h.className = "text-ink-faint";
          h.textContent = note;
          li.append(h);
        }
        return li;
      }),
    );
    const retry = q<HTMLButtonElement>("retry");
    retry.classList.toggle("hidden", wrong.length === 0);
    retry.textContent = `Làm lại câu sai (${wrong.length})`;
    q("restart").focus();
  }

  next.addEventListener("click", () => {
    session?.next();
    render();
  });
  // Kết thúc sớm: chưa làm câu nào → kết thúc luôn; đã làm → hỏi lại (focus "Làm tiếp" — nút an toàn)
  const finishNow = (): void => {
    finishConfirm.hidden = true;
    session?.finish();
    render();
  };
  q("finish").addEventListener("click", () => {
    if (!session || session.total === 0) return finishNow();
    q("done-count").textContent = String(session.total);
    finishConfirm.hidden = false;
    finishCancel.focus();
  });
  finishOk.addEventListener("click", finishNow);
  finishCancel.addEventListener("click", () => {
    finishConfirm.hidden = true;
  });
  q("restart").addEventListener("click", () => start());
  q("setup").addEventListener("click", setup);
  startBtn.addEventListener("click", begin);
  q("retry").addEventListener("click", () => {
    const wrong = session?.wrong() ?? [];
    if (wrong.length > 0) start(wrong, wrong.length);
  });
  // Số câu (chỉ ở bước thiết lập): "Tự nhập" → hiện ô nhập, báo lỗi ngay khi số sai; Bắt đầu kiểm lại
  function applyCustom(): boolean {
    const ok = customSize() !== null;
    sizeInput.setAttribute("aria-invalid", ok ? "false" : "true");
    sizeError.classList.toggle("hidden", ok);
    return ok;
  }
  for (const r of root.querySelectorAll<HTMLInputElement>('input[name="q-size"]')) {
    r.addEventListener("change", () => {
      const custom = sizeId() === "q-size-custom";
      sizeBox.classList.toggle("hidden", !custom);
      sizeBox.classList.toggle("flex", custom);
      if (custom) {
        sizeInput.focus();
        sizeInput.select();
        applyCustom();
      } else {
        sizeError.classList.add("hidden");
      }
    });
  }
  sizeInput.addEventListener("change", applyCustom);
  sizeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyCustom();
    }
  });

  // ⓘ: chạm (mobile) / Enter bật tắt; click CHUỘT bỏ qua — máy có chuột chỉ hiện khi rê chuột (CSS), không ghim.
  // Bấm ra ngoài hoặc Esc → đóng.
  function setInfo(open: boolean): void {
    infoWrap.toggleAttribute("data-open", open);
    infoBtn.setAttribute("aria-expanded", String(open));
  }
  infoBtn.addEventListener("click", (e) => {
    if ((e as PointerEvent).pointerType === "mouse") return;
    setInfo(!infoWrap.hasAttribute("data-open"));
  });
  document.addEventListener("click", (e) => {
    if (infoWrap.hasAttribute("data-open") && !infoWrap.contains(e.target as Node)) setInfo(false);
  });

  document.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement | null;
    if (e.key === "Escape") {
      setInfo(false);
      finishConfirm.hidden = true;
    }
    // đang gõ (ô số câu, ô tìm, select bài) → phím số không phải chọn đáp án
    if (t?.closest("input:not([type=radio]):not([type=checkbox]), textarea, select, [data-combo][data-open]")) return;
    if (!session?.current || card.classList.contains("hidden")) return;
    if (/^[1-9]$/.test(e.key) && !session.answered) {
      choose(Number(e.key) - 1);
    } else if (e.key === "Enter" && session.answered && t !== next && t !== infoBtn && !finishConfirm.contains(t)) {
      e.preventDefault();
      next.click();
    }
  });

  // Nạp dữ liệu: nhúng sẵn, data-src, hoặc danh sách file Deck theo bộ lọc (setFilter)
  const cache = new Map<string, Promise<unknown>>();
  const fetchJson = (url: string): Promise<unknown> => {
    let p = cache.get(url);
    if (!p) {
      p = fetch(url).then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${url}`);
        return r.json() as Promise<unknown>;
      });
      // lỗi mạng: không giữ trong cache để lần đổi bộ lọc sau thử lại
      p.catch(() => cache.delete(url));
      cache.set(url, p);
    }
    return p;
  };
  let token = 0;
  const deckItems = (data: unknown[]): QuizItem[] => data.flatMap((d) => (d as Deck).items);
  const loadDecks = (urls: readonly string[], then: () => void, toItems: (data: unknown[]) => QuizItem[] = deckItems): void => {
    const my = ++token;
    all = null;
    loading.textContent = "Đang tải câu hỏi…";
    show(loading);
    Promise.all(urls.map(fetchJson))
      .then((data) => {
        if (my !== token) return; // đã về bước thiết lập trong lúc tải
        all = toItems(data);
        then();
      })
      .catch(() => {
        if (my !== token) return;
        // mở khóa để người học bấm Bắt đầu thử lại (file lỗi không nằm trong cache)
        lock(false);
        loading.textContent = "Không tải được câu hỏi. Kiểm tra kết nối rồi bấm Bắt đầu để thử lại.";
      });
  };

  // ---------------------------------------------------------------- Câu hay sai (Q10)

  /** Dòng "Câu hỏi": số câu đã lưu của trang; 0 câu → khóa "Câu hay sai" + ẩn Xóa. */
  function refreshWrong(): void {
    if (!canStore) return;
    const n = countWrong(loadStore(), wrongKinds);
    const label = reviewWrong.closest("label")!;
    const text = [...label.childNodes].find((x) => x.nodeType === Node.TEXT_NODE && x.textContent?.trim());
    if (text) text.textContent = `Câu hay sai (${n})`;
    if (n === 0 && reviewWrong.checked) reviewAll.checked = true;
    reviewWrong.disabled = n === 0;
    label.classList.toggle("opacity-40", n === 0);
    wrongClear.disabled = n === 0;
  }

  /** Tham số runner tự quản trên URL (sau tham số của trang): ?tra-loi=go (Q9), ?on=sai (Q10). */
  function syncReviewUrl(): void {
    // chỉ thêm/bỏ `on`, giữ nguyên chuỗi của trang (URLSearchParams sẽ mã hóa dấu phẩy: loai=ten%2Cchu)
    const parts = location.search.slice(1).split("&").filter((x) => x && !x.startsWith("on=") && !x.startsWith("tra-loi="));
    if (typingMode()) parts.push("tra-loi=go");
    if (reviewing()) parts.push("on=sai");
    const qs = parts.join("&");
    history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
  }

  /** Tổng kết: đã lưu N câu sai (+ link ôn) / đang ôn: đã nhớ K câu. */
  function renderSaved(): void {
    const box = q("sum-saved");
    box.replaceChildren();
    if (!canStore) return box.classList.add("hidden");
    const left = countWrong(loadStore(), wrongKinds);
    if (reviewing()) {
      box.append(`Đã nhớ ${roundRemembered} câu (đúng ${REMEMBER_STREAK} lần liên tiếp) · Còn ${left} câu hay sai`);
    } else if (roundSaved > 0) {
      const a = document.createElement("a");
      a.href = "#";
      a.dataset.q = "sum-review";
      a.className = "text-primary hover:underline";
      a.textContent = "Ôn câu hay sai →";
      a.addEventListener("click", (e) => {
        e.preventDefault();
        setup();
        reviewWrong.checked = true;
        syncReviewUrl();
        startBtn.focus();
      });
      box.append(`Đã lưu ${roundSaved} câu sai để ôn lại · `, a);
    }
    box.classList.toggle("hidden", box.childNodes.length === 0);
  }

  // Gõ kana: URL → dòng "Trả lời"; ô nhập: romaji → kana ngay khi gõ (trừ lúc IME đang soạn chữ)
  if (ansType && new URLSearchParams(location.search).get("tra-loi") === "go") ansType.checked = true;
  for (const r of root.querySelectorAll<HTMLInputElement>('input[name="q-answer"]')) r.addEventListener("change", syncReviewUrl);
  let composing = false;
  typeInput.addEventListener("compositionstart", () => (composing = true));
  typeInput.addEventListener("compositionend", () => {
    composing = false;
    typeInput.dispatchEvent(new Event("input"));
  });
  typeInput.addEventListener("input", () => {
    if (composing) return;
    const k = toKana(typeInput.value, false);
    if (k !== typeInput.value) typeInput.value = k; // con trỏ về cuối — gõ nối tiếp như bình thường
  });
  typeBox.addEventListener("submit", (e) => {
    e.preventDefault();
    submitTyped(false);
  });
  typeGiveup.addEventListener("click", () => submitTyped(true));

  wrongRow.hidden = !canStore;
  if (canStore && new URLSearchParams(location.search).get("on") === "sai") reviewWrong.checked = true;
  refreshWrong();
  for (const r of [reviewAll, reviewWrong]) r.addEventListener("change", () => {
    syncReviewUrl();
    show(null);
  });
  wrongClear.addEventListener("click", () => {
    const n = countWrong(loadStore(), wrongKinds);
    if (n === 0 || !confirm(`Xóa ${n} câu hay sai của trang này? Không hoàn tác được.`)) return;
    writeString(KEYS.quizWrong, JSON.stringify(clearWrong(loadStore(), wrongKinds)));
    refreshWrong();
    syncReviewUrl();
  });

  const inline = root.querySelector("script[data-quiz-items]");
  if (inline) all = JSON.parse(inline.textContent ?? "[]") as QuizItem[];
  else if (root.dataset.src) pending = { decks: [root.dataset.src] };
  show(null);
  startBtn.disabled = false; // sẵn sàng nhận "Bắt đầu" (nút disabled sẵn trong HTML)

  return {
    setFilter(f, decks, toItems) {
      if (running) return; // tùy chọn đã khóa — không đổi giữa lượt
      filter = f;
      if (decks) pending = { decks, toItems };
      show(null); // đổi tùy chọn → ẩn thông báo rỗng / lỗi cũ
      syncReviewUrl(); // trang vừa ghi URL theo bộ lọc của nó → gắn lại ?on=sai nếu đang ôn câu sai
    },
  };
}
