"""Từ ví dụ Kanji lấy từ giáo trình Kanji (sách Kanji N3, Ebook Kanji N4) → danh sách ghim.

Sách in từ/cụm/câu ví dụ trên thẻ chữ. Chỉ lấy **từ** (khớp một mục JMdict, ≤ MAX_WORD_LEN ký tự,
chứa chữ đang xét) — không chép cụm/câu của sách (bản quyền). Cách đọc lấy từ JMdict: cách đọc
thông dụng (re_pri) trước. Kết quả ghi `enrichment/kanji/pinned/NN-*.txt` (`字|từ|kana`, `# by: ai`).

Ebook N4: lớp chữ PDF có từ ví dụ cỡ ~14pt, mỗi chữ Hán một span (furigana cỡ 7 phía trên, câu ví dụ
cỡ 13) → ghép span cỡ 14 liền nhau trên cùng dòng thành đoạn, rồi tách từ bằng JMdict.
"""

from __future__ import annotations

import re

from jp_pipeline.dictionaries import JmEntry
from jp_pipeline.extract.layout import Span
from jp_pipeline.transform.kanji_examples import MAX_WORD_LEN

WORD_SIZE = (13.5, 14.5)  # cỡ chữ từ ví dụ trong Ebook N4
_LESSON = re.compile(r"第\s*([０-９0-9]+)\s*課")
_ZEN = str.maketrans("０１２３４５６７８９", "0123456789")

Cand = tuple[str, str, JmEntry]  # (từ, kana, entry) — như jm_candidates


def kun_bare(kun: list[str]) -> set[str]:
    """Âm Kun có thể đứng riêng thành từ một chữ: 'あに', 'かか.り' → 'かかり'; bỏ dạng tiền/hậu tố '-'."""
    return {k.replace(".", "") for k in kun if not k.startswith("-") and not k.endswith("-")}


def words_in(char: str, text: str, cands: list[Cand], bare: set[str]) -> list[tuple[str, str]]:
    """Các từ JMdict chứa `char` xuất hiện trong `text`. Đoạn chồng nhau → chọn tham lam từ dài trước,
    rồi cách đọc thông dụng (家家事 → 家事, không 家家). Mỗi từ một cách đọc: re_pri thông dụng → thông dụng
    → kana ngắn. Từ một chữ (兄, 場) chỉ nhận khi có đúng một cách đọc vừa là âm Kun đứng riêng của
    KANJIDIC (`bare`: あに, ば, かかり) vừa thông dụng — tránh 私 あたし, 愛 まな, 台 うてな, 部 ぶ."""
    by_word: dict[str, list[Cand]] = {}
    for c in cands:
        w, kana, e = c
        if len(w) > MAX_WORD_LEN or w not in text:
            continue
        if len(w) == 1 and not (kana in bare and e.common_reading and w in e.common_kanji):  # 案 つくえ: thông dụng là 机
            continue
        # từ không thông dụng mà đuôi hiragana (飛んで, 消する — mảnh chia thể) hoặc chỉ 2 ký tự (品部, 越南 —
        # khớp nhầm giữa cụm) → bỏ; từ ghép dài không thông dụng (交通手段, 技術力) vẫn giữ
        if not e.common and (len(w) == 2 or "ぁ" <= w[-1] <= "ゟ"):
            continue
        by_word.setdefault(w, []).append(c)
    if len(by_word.get(char, [])) > 1:  # 空 そら/から, 家 いえ/うち: không biết sách dùng cách đọc nào → bỏ
        del by_word[char]
    best = {w: min(cs, key=lambda c: (not c[2].common_reading, not c[2].common, len(c[1])))
            for w, cs in by_word.items()}
    spans: list[tuple[int, int, str]] = []
    for w in by_word:
        start = text.find(w)
        while start >= 0:
            end = start + len(w)
            if not (w.endswith("す") and text[end:end + 1] == "る"):  # 指示する ≠ 指示す (さししめす)
                spans.append((start, end, w))
            start = text.find(w, start + 1)
    spans.sort(key=lambda s: (-(s[1] - s[0]), not best[s[2]][2].common_reading, s[0]))
    taken: list[tuple[int, int, str]] = []
    for s in spans:
        if not any(s[0] < o[1] and o[0] < s[1] for o in taken):
            taken.append(s)
    out: list[tuple[str, str]] = []
    for _, _, w in sorted(taken):
        if all(w != x for x, _ in out):
            out.append((w, best[w][1]))
    return out


def ebook_segments(spans: list[Span]) -> dict[int, list[str]]:
    """{bài: [đoạn chữ cỡ ~14 liền nhau trên một dòng]} theo thứ tự trang (bài đọc từ '第N課' ở đầu trang)."""
    pages: dict[int, list[Span]] = {}
    for s in spans:
        pages.setdefault(s.page, []).append(s)
    out: dict[int, list[str]] = {}
    lesson: int | None = None
    for p in sorted(pages):
        ss = pages[p]
        m = next((m for s in ss if (m := _LESSON.search(s.text))), None)
        if m:
            lesson = int(m.group(1).translate(_ZEN))
        if lesson is None:
            continue
        big = sorted((s for s in ss if WORD_SIZE[0] <= s.size <= WORD_SIZE[1]), key=lambda s: (round(s.y0), s.x0))
        cur, last = "", None
        for s in big:
            if last is not None and abs(s.y0 - last.y0) < 2 and s.x0 - last.x1 < 3:
                cur += s.text
            else:
                if cur:
                    out.setdefault(lesson, []).append(cur)
                cur = s.text
            last = s
        if cur:
            out.setdefault(lesson, []).append(cur)
    return out


def format_pinned(rows: list[tuple[str, str, str]], header: str) -> str:
    """rows (字, từ, kana) → nội dung file ghim; bỏ dòng trùng, giữ thứ tự."""
    seen: set[tuple[str, str, str]] = set()
    lines = ["# by: ai", *(f"# {h}" for h in header.splitlines())]
    for r in rows:
        if r not in seen:
            seen.add(r)
            lines.append("|".join(r))
    return "\n".join(lines) + "\n"
