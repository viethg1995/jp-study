// Phần chạy trên trình duyệt của components/quiz/QuizRunner.astro — chỉ vẽ DOM theo Session (session.ts).
// Trang gọi: const quiz = mountQuiz(root); quiz.setFilter(filter) — lần đầu và mỗi khi bộ lọc đổi.
import { parseRuby } from "../ruby";
import { filterItems } from "./core";
import { mulberry32, randomSeed } from "./random";
import { type Question, type Session, createSession } from "./session";
import type { Deck, Filter, QuizItem } from "./types";

export interface QuizController {
  /** Đặt bộ lọc và bắt đầu lượt mới (gọi trước khi tải xong cũng được — áp dụng khi có dữ liệu). */
  setFilter(filter: Filter): void;
}

const JA = /[぀-ヿ㐀-鿿豈-﫿々]/u;
const OPTION_CLASS =
  "q-opt rounded-md border border-line bg-surface px-3 py-3 text-left text-lg text-ink hover:border-primary-line hover:bg-primary-soft disabled:cursor-default " +
  "data-[state=right]:border-success data-[state=right]:font-semibold data-[state=right]:text-success " +
  "data-[state=wrong]:border-danger data-[state=wrong]:bg-danger-soft data-[state=wrong]:text-danger";

/** Vẽ chuỗi ruby {漢字|かな} thành <ruby> bằng DOM (không innerHTML). */
export function renderRuby(el: HTMLElement, s: string): void {
  el.replaceChildren(
    ...parseRuby(s).map((seg) => {
      if (!seg.reading) return document.createTextNode(seg.text);
      const ruby = document.createElement("ruby");
      const rt = document.createElement("rt");
      rt.textContent = seg.reading;
      ruby.append(seg.text, rt);
      return ruby;
    }),
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
  const link = q<HTMLAnchorElement>("link"), next = q<HTMLButtonElement>("next");
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/?$/, "/");
  const rng = mulberry32(randomSeed());

  let all: QuizItem[] | null = null;
  let filter: Filter | null = null;
  let session: Session | null = null;

  const roundSize = (): number | null => {
    const id = root.querySelector<HTMLInputElement>('input[name="q-size"]:checked')?.id ?? "q-size-10";
    return id === "q-size-all" ? null : Number(id.replace("q-size-", "")) || 10;
  };
  const show = (el: HTMLElement | null): void => {
    for (const x of [card, summary, empty, loading]) x.classList.toggle("hidden", x !== el);
  };

  function start(items?: QuizItem[], limit?: number | null): void {
    if (!all || !filter) return;
    const pool = items ?? filterItems(all, filter);
    session = createSession(pool, rng, limit === undefined ? roundSize() : limit);
    render();
  }

  function render(): void {
    if (!session) return;
    const cur = session.current;
    if (cur) renderQuestion(cur);
    else if (session.done) renderSummary();
    else show(empty);
  }

  function renderQuestion(cur: Question): void {
    const s = session!;
    show(card);
    q("index").textContent = String(s.total + 1);
    q("of").textContent = s.limit === null ? "" : ` / ${s.limit}`;
    q("right").textContent = String(s.right);
    q("total").textContent = String(s.total);

    renderRuby(prompt, cur.item.prompt);
    const long = cur.item.prompt.length > 12;
    prompt.classList.toggle("text-5xl", cur.item.promptLang === "ja" && !long);
    prompt.classList.toggle("text-2xl", cur.item.promptLang !== "ja" || long);
    hint.textContent = cur.item.hint ?? "";
    hint.classList.toggle("hidden", !cur.item.hint);

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
  }

  function choose(index: number): void {
    const s = session;
    const cur = s?.current;
    if (!s || !cur) return;
    const res = s.answer(index);
    if (!res) return;
    optionsBox.querySelectorAll<HTMLButtonElement>(".q-opt").forEach((b, i) => {
      b.disabled = true;
      if (i === cur.correct) b.dataset.state = "right";
      else if (i === index) b.dataset.state = "wrong";
    });
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
        if (it.hint) {
          const h = document.createElement("span");
          h.className = "text-ink-faint";
          h.textContent = it.hint;
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
  q("finish").addEventListener("click", () => {
    session?.finish();
    render();
  });
  q("restart").addEventListener("click", () => start());
  q("retry").addEventListener("click", () => {
    const wrong = session?.wrong() ?? [];
    if (wrong.length > 0) start(wrong, wrong.length);
  });
  for (const r of root.querySelectorAll<HTMLInputElement>('input[name="q-size"]')) r.addEventListener("change", () => start());

  document.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement | null;
    if (t?.closest("input[type=text], input[type=search], textarea, [data-combo][data-open]")) return;
    if (!session?.current || card.classList.contains("hidden")) return;
    if (/^[1-9]$/.test(e.key) && !session.answered) {
      choose(Number(e.key) - 1);
    } else if (e.key === "Enter" && session.answered && t !== next) {
      e.preventDefault();
      next.click();
    }
  });

  // Nạp dữ liệu: nhúng sẵn hoặc tải file Deck
  const inline = root.querySelector("script[data-quiz-items]");
  const ready = (items: QuizItem[]): void => {
    all = items;
    start();
  };
  if (inline) ready(JSON.parse(inline.textContent ?? "[]") as QuizItem[]);
  else if (root.dataset.src) {
    fetch(root.dataset.src)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<Deck>;
      })
      .then((deck) => ready(deck.items))
      .catch(() => {
        loading.textContent = "Không tải được câu hỏi. Kiểm tra kết nối rồi tải lại trang.";
      });
  }

  return {
    setFilter(f) {
      filter = f;
      start();
    },
  };
}
