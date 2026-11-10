"""Chuẩn hóa chuỗi kana / nghĩa từ vựng (hàm thuần, dùng trong build).

- Ký hiệu chỗ trống: nguồn viết lẫn ~ ～ ― － và '-' → thống nhất '～'.
- Nghĩa → senses: tách theo ';', mỗi nghĩa tách cụm [ngữ cảnh] ở CUỐI ('gọi [điện thoại]').
  Ngoặc ở giữa câu ('món [cơm] ca-ri', '[tiền thừa] ra') là chữ có thể lược → giữ nguyên trong text.
"""

from __future__ import annotations

import re

from jp_pipeline.schemas import Sense

SLOT = "～"
_SLOT_CHARS = re.compile(r"[~―－〜]")  # 〜 (U+301C) sách N3 hay dùng
# '-' là chỗ trống khi đứng đầu chuỗi / sau khoảng trắng hoặc '(' và trước chữ: '-giờ', '- phút', '(- lần)'
_SLOT_HYPHEN = re.compile(r"(?:(?<=^)|(?<=[\s(]))-(?=\s?[^\W\d_])")
# '-' đứng một mình cuối cụm: 'năm -', 'thứ - , số -'
_SLOT_HYPHEN_END = re.compile(r"(?<=\s)-(?=\s*(?:$|[,;()]))")
# 'ー' (trường âm) ở ĐẦU kana/kanji là chỗ trống: 'ーねん', 'ー年' (không đụng 'ー' giữa từ: コーヒー)
_SLOT_LEADING_CHOON = re.compile(r"^ー")
_TRAILING_CONTEXT = re.compile(r"^(?P<text>.*?\S)\s*(?P<ctx>(?:\[[^\[\]]*\]\s*,?\s*)+)$")


def normalize_slots(s: str) -> str:
    """'~ này' / '― tuổi' / '-giờ' → '～ này' / '～ tuổi' / '～giờ'."""
    s = _SLOT_CHARS.sub(SLOT, s)
    s = _SLOT_HYPHEN_END.sub(SLOT, _SLOT_HYPHEN.sub(SLOT, s))
    return _SLOT_LEADING_CHOON.sub(SLOT, s)


def _split_top(s: str, sep: str = ";") -> list[str]:
    """Tách theo sep, bỏ qua sep nằm trong () hoặc []."""
    parts, depth, cur = [], 0, []
    for ch in s:
        if ch in "([":
            depth += 1
        elif ch in ")]":
            depth = max(0, depth - 1)
        if ch == sep and depth == 0:
            parts.append("".join(cur))
            cur = []
        else:
            cur.append(ch)
    parts.append("".join(cur))
    return [p.strip() for p in parts if p.strip()]


def split_senses(meaning: str) -> list[Sense]:
    out: list[Sense] = []
    for part in _split_top(meaning):
        m = _TRAILING_CONTEXT.match(part)
        if m:
            ctx = ", ".join(c.strip() for c in re.findall(r"\[([^\[\]]*)\]", m.group("ctx")) if c.strip())
            out.append(Sense(text=m.group("text").strip(), context=ctx or None))
        else:
            out.append(Sense(text=part, context=None))
    return out
