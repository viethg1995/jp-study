// Bộ lọc quiz ↔ query string (D6): ?cap=n5&tu=1&den=10&loai=doc,nghia — bookmark/chia sẻ được, không cần localStorage.
// Giá trị sai bị bỏ qua (dùng mặc định của trang), không làm hỏng trang.
import type { Filter, TagValue } from "./types";

export type ParamDef =
  /** Chọn trong danh sách; `options` = chữ trên URL → giá trị tag. multi: nhiều giá trị, ngăn bằng dấu phẩy. */
  | { param: string; tag: string; type: "enum"; options: Readonly<Record<string, TagValue>>; multi?: boolean }
  /** Một đầu của khoảng số nguyên trên tag (tu → min, den → max), giới hạn trong [lo, hi]. */
  | { param: string; tag: string; type: "min" | "max"; lo: number; hi: number };

/** Đọc filter từ query; tham số thiếu/sai bị bỏ qua. tu > den → đổi chỗ. */
export function readFilter(search: URLSearchParams | string, defs: readonly ParamDef[]): Filter {
  const q = typeof search === "string" ? new URLSearchParams(search) : search;
  const out: Filter = {};
  const ranges: Record<string, { min?: number; max?: number }> = {};
  for (const d of defs) {
    const raw = q.get(d.param);
    if (raw === null || raw === "") continue;
    if (d.type === "enum") {
      const parts = d.multi ? raw.split(",") : [raw];
      const values = [...new Set(parts.map((p) => d.options[p.trim()]).filter((v): v is TagValue => v !== undefined))];
      if (values.length > 0) out[d.tag] = values;
    } else {
      if (!/^\d+$/.test(raw)) continue;
      const n = Number(raw);
      if (n < d.lo || n > d.hi) continue;
      (ranges[d.tag] ??= {})[d.type] = n;
    }
  }
  for (const [tag, r] of Object.entries(ranges)) {
    out[tag] = r.min !== undefined && r.max !== undefined && r.min > r.max ? { min: r.max, max: r.min } : r;
  }
  return out;
}

/** Ghi filter thành query (không có "?"), theo thứ tự defs; giá trị không có trong options bị bỏ. */
export function writeFilter(filter: Filter, defs: readonly ParamDef[]): string {
  const q = new URLSearchParams();
  for (const d of defs) {
    const rule = filter[d.tag];
    if (rule === undefined) continue;
    if (d.type === "enum") {
      if (!Array.isArray(rule)) continue;
      const keys = Object.keys(d.options).filter((k) => rule.includes(d.options[k]!));
      if (keys.length > 0) q.set(d.param, (d.multi ? keys : keys.slice(0, 1)).join(","));
    } else {
      if (Array.isArray(rule)) continue;
      const n = (rule as { min?: number; max?: number })[d.type];
      if (n !== undefined) q.set(d.param, String(n));
    }
  }
  return q.toString().replace(/%2C/g, ",");
}
