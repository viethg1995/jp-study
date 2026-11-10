"""Parser Kanji N3 (file "N3CB mới Kanji Bài N.pdf") theo bố cục thẻ (đo bằng layout-dump):

  số thứ tự   đậm, cỡ ~13, x < 110, chữ số (có thể lặp 2 lần cùng chỗ → khử trùng)
  chữ Hán     đậm, cỡ ≥ 15, 1 ký tự CJK, 110 ≤ x < 200 (có thể nằm hơi TRÊN số thứ tự)
  Hán-Việt    đậm, chữ in hoa Latin, x < 200
  âm On       '音：…' ở x≈79;  âm Kun '訓：…' + dòng nối '・ばす' (x < 240)
  ví dụ       x ≥ 240, dòng đầu có '例：'; nhiều ví dụ cùng dòng cách nhau bằng khoảng trắng lớn
Hàm thuần: list[Span] của MỘT file bài → list[N3KanjiRaw].
"""

from __future__ import annotations

import re

from pydantic import BaseModel

from jp_pipeline.extract.layout import Span
from jp_pipeline.transform.n3_vocab import _cluster_lines

KANJI_CHAR = re.compile(r"^[㐀-䶿一-鿿豈-﫿]$")
HV = re.compile(r"^[A-ZÀ-ỸĐ][A-ZÀ-ỸĐ\s,/]*$")
HEADER_Y, FOOTER_Y = 60.0, 760.0


class N3KanjiRaw(BaseModel):
    lesson: int
    no: int
    char: str
    han_viet: str | None
    on: list[str]
    kun: list[str]  # dạng KANJIDIC: 'まか.せる'
    examples: list[str]
    dropped: list[str] = []  # ví dụ bị loại (không chứa chữ Hán của thẻ) — để soát
    flags: list[str]


def _kun_list(lines: list[str]) -> list[str]:
    """['まか・せる'] → ['まか.せる'];  ['の・びる', '・ばす'] → ['の.びる', 'の.ばす']."""
    out: list[str] = []
    stem = ""
    for raw in lines:
        for tok in re.split(r"[、,，\s]+", raw.strip()):
            if not tok:
                continue
            if tok.startswith("・") and stem:
                out.append(f"{stem}.{tok[1:]}")
            elif "・" in tok:
                stem, rest = tok.split("・", 1)
                out.append(f"{stem}.{rest}")
            else:
                stem = tok
                out.append(tok)
    return out


def _example_items(spans: list[Span]) -> list[str]:
    items: list[str] = []
    for ln in _cluster_lines(spans, tol=5):
        cur = ""
        prev: Span | None = None
        for s in ln:
            gap = s.x0 - prev.x1 if prev else 0
            for k, part in enumerate(re.split(r"\s{2,}", s.text)):
                if (k > 0 or gap > 10) and cur.strip():
                    items.append(cur.strip())
                    cur = ""
                cur += part
            prev = s
        if cur.strip():
            items.append(cur.strip())
    cleaned = [re.sub(r"^例\s*[：:]\s*", "", it).strip(" ：:") for it in items]
    return [c for c in cleaned if c and c != "例"]


def parse_lesson(spans: list[Span], lesson: int) -> list[N3KanjiRaw]:
    body = [s for s in spans if HEADER_Y < s.y0 < FOOTER_Y]
    raw_nums = [s for s in body if s.bold and s.x0 < 110 and s.text.isdigit()]
    nums: list[Span] = []
    for s in raw_nums:  # khử số lặp (cùng text, cách nhau < 20px)
        if nums and nums[-1].text == s.text and nums[-1].page == s.page and abs(nums[-1].y0 - s.y0) < 20:
            continue
        nums.append(s)
    out: list[N3KanjiRaw] = []
    for i, n in enumerate(nums):
        nxt = nums[i + 1] if i + 1 < len(nums) else None

        def inside(s: Span, n: Span = n, nxt: Span | None = nxt) -> bool:
            start = (s.page, s.y0) >= (n.page, n.y0 - 18)
            end = nxt is None or (s.page, s.y0) < (nxt.page, nxt.y0 - 18)
            return start and end

        card = [s for s in body if inside(s) and s not in raw_nums]
        flags: list[str] = []
        chars = [s for s in card if s.bold and s.size >= 15 and KANJI_CHAR.match(s.text) and s.x0 < 200]
        hv = [s for s in card if s.bold and s.x0 < 200 and HV.match(s.text) and not s.text.isdigit()]
        if not chars:
            flags.append("char_missing")
        on_sp = [s for s in card if s.text.startswith("音")]
        kun_sp = [s for s in card if s.text.startswith("訓")]
        kun_lines = [re.sub(r"^訓\s*[：:]\s*", "", s.text) for s in kun_sp]
        if kun_sp:
            ky = kun_sp[0].y0
            kun_lines += [
                s.text for s in sorted(card, key=lambda s: (s.page, s.y0))
                if s.x0 < 240 and s.text.startswith("・") and s.y0 > ky - 30 and not s.bold
            ]
        on = [t for sp in on_sp for t in re.split(r"[、,，・\s]+", re.sub(r"^音\s*[：:]\s*", "", sp.text)) if t]
        ex_spans = [s for s in card if s.x0 >= 240]
        examples = _example_items(ex_spans)
        char = chars[0].text if chars else ""
        if not char and examples:
            # suy chữ Hán từ ví dụ: chữ CJK có mặt trong NHIỀU ví dụ nhất
            from collections import Counter

            cnt = Counter(c for ex in examples for c in set(ex) if KANJI_CHAR.match(c))
            if cnt:
                best, n_ex = cnt.most_common(1)[0]
                if n_ex >= max(2, len(examples) // 2):
                    char = best
                    flags = [f for f in flags if f != "char_missing"] + ["char_inferred"]
        dropped: list[str] = []
        if char:
            dropped = [ex for ex in examples if char not in ex]
            examples = [ex for ex in examples if char in ex]  # bỏ ví dụ lọt từ thẻ bên cạnh
            if dropped:
                flags.append(f"examples_dropped_{len(dropped)}")
        # âm On viết hiragana trong sách (代: だい) → katakana
        on = ["".join(chr(ord(c) + 0x60) if "ぁ" <= c <= "ゖ" else c for c in t) for t in on]
        out.append(
            N3KanjiRaw(
                lesson=lesson,
                no=int(n.text),
                char=char,
                han_viet=" ".join(s.text for s in hv) or None,
                on=on,
                kun=_kun_list(kun_lines),
                examples=examples,
                dropped=dropped if char else [],
                flags=flags if hv else [*flags, "han_viet_missing"],
            )
        )
    return out
