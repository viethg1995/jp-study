// Parse cú pháp ruby của câu ví dụ — phải khớp với pipeline/jp_pipeline/transform/examples.py
//   {漢字|かな}  chữ có furigana
//   [[…]]        từ đang học (đúng 1 lần)
export interface RubySegment {
  text: string;
  reading: string | null;
  target: boolean;
}

const TOKEN = /\[\[|\]\]|\{([^{}|]+)\|([^{}|]+)\}|([^[\]{}]+)/g;

export function parseRuby(ruby: string): RubySegment[] {
  const out: RubySegment[] = [];
  let inTarget = false;
  for (const m of ruby.matchAll(TOKEN)) {
    const tok = m[0];
    if (tok === "[[") inTarget = true;
    else if (tok === "]]") inTarget = false;
    else if (m[1] !== undefined && m[2] !== undefined) out.push({ text: m[1], reading: m[2], target: inTarget });
    else out.push({ text: tok, reading: null, target: inTarget });
  }
  return out;
}

/** Gộp các segment liên tiếp cùng trạng thái target để bọc [[…]] trong một thẻ. */
export function groupByTarget(segs: RubySegment[]): { target: boolean; segs: RubySegment[] }[] {
  const groups: { target: boolean; segs: RubySegment[] }[] = [];
  for (const s of segs) {
    const last = groups.at(-1);
    if (last && last.target === s.target) last.segs.push(s);
    else groups.push({ target: s.target, segs: [s] });
  }
  return groups;
}
