// Hiển thị kết quả chấm bài dịch — dùng chung trang câu đơn (/dich/<id>/) và đoạn văn (/dich/doan/<id>/).
// Chạy trên trình duyệt. Chữ do AI sinh chỉ đưa vào qua textContent (không innerHTML).
import { ERROR_LABELS, VERDICT_LABELS, type GradeResult } from "./translation";

export interface RenderOptions {
  summary: HTMLElement;
  list: HTMLElement;
  /** Bản dịch mẫu theo câu (index - 1). */
  references: string[][];
  /** Câu gốc theo câu (đoạn văn: đề của câu đó) — bỏ trống thì không hiện. */
  sources?: string[];
  /** Ngôn ngữ bài làm / bản mẫu ("ja" thêm class font Nhật). */
  answerLang: "ja" | "vi";
  /** Ngôn ngữ câu gốc. */
  sourceLang?: "ja" | "vi" | "en";
}

/** Tạo phần tử, nội dung qua textContent. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function langText(tag: "p" | "span", cls: string, text: string, lang: string): HTMLElement {
  const e = el(tag, lang === "ja" ? `jp ${cls}` : cls, text);
  e.lang = lang;
  return e;
}

export function renderGrade(r: GradeResult, o: RenderOptions): void {
  const tone = r.overall === "good" ? "bg-primary-soft" : r.overall === "minor" ? "bg-notice-soft" : "bg-danger-soft";
  o.summary.className = `rounded-lg px-4 py-3 ${tone}`;
  const right = r.sentences.filter((s) => s.verdict === "correct").length;
  o.summary.replaceChildren(
    el("p", "font-semibold text-ink", `Đúng ${right} / ${r.sentences.length} câu`),
    el("p", "mt-1 text-sm text-ink-muted", r.summary_vi),
  );

  o.list.replaceChildren(
    ...r.sentences.map((s) => {
      const li = el("li", "rounded-lg border border-line bg-surface p-4");
      li.dataset.verdict = s.verdict;
      const head = el("p", "flex items-baseline gap-2 text-sm");
      head.append(el("span", "text-ink-faint", `Câu ${s.index}`), el("span", "t-verdict font-semibold", VERDICT_LABELS[s.verdict]));
      li.append(head);

      const source = o.sources?.[s.index - 1];
      if (source) li.append(langText("p", "t-source mt-1 text-sm text-ink-faint", source, o.sourceLang ?? "ja"));
      if (s.learner) li.append(langText("p", "t-learner mt-1 text-lg text-ink", s.learner, o.answerLang));
      if (s.verdict !== "correct" && s.corrected && s.corrected !== s.learner) {
        const fix = el("p", "mt-1 text-sm text-ink-muted", "Sửa: ");
        fix.append(langText("span", "text-lg font-semibold text-primary", s.corrected, o.answerLang));
        li.append(fix);
      }
      if (s.errors.length > 0) {
        const ul = el("ul", "mt-2 space-y-1 text-sm");
        for (const err of s.errors) {
          const item = el("li", "text-ink-muted");
          item.append(el("span", "mr-1 text-xs font-medium text-ink-faint", `[${ERROR_LABELS[err.type] ?? err.type}]`));
          if (err.excerpt) item.append(langText("span", "mr-1 text-danger", `「${err.excerpt}」`, o.answerLang));
          item.append(document.createTextNode(err.explanation_vi));
          ul.append(item);
        }
        li.append(ul);
      }
      const refs = o.references[s.index - 1] ?? [];
      if (refs.length > 0) {
        const det = el("details", "mt-2 text-sm");
        det.append(el("summary", "cursor-pointer text-primary", "Bản dịch mẫu"));
        for (const ref of refs) det.append(langText("p", "mt-1 text-ink", ref, o.answerLang));
        li.append(det);
      }
      return li;
    }),
  );
}
