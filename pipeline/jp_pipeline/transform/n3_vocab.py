"""Parser từ vựng N3 (sách "Ｎ３準備ー文字語彙", file "N3CB mới TV Bài N.pdf") theo bố cục thẻ.

Mỗi thẻ (đo từ layout-dump):
  số thứ tự   x < 110, đậm, chữ số             → mốc bắt đầu thẻ
  từ chính    cỡ ≥ 20, x < 210 (có thể nhiều span: 足 + りる)
  furigana    cỡ ≤ 11.5, ngay TRÊN từng span kanji của từ chính
  trợ từ      cỡ ~18 bên trái từ chính (が/を/に);  nhãn cỡ ~18 dưới: (自) (他)
  nghĩa       đậm, x ≥ 270 (có thể nhiều dòng)
  ví dụ/ghi chú  x ≥ 270: '・' ở x≈275 mở mục mới; dòng x≈293 không có '・' = nối tiếp; '・' x≈293 = mục con
Hàm thuần: nhận list[Span] của MỘT file bài, trả list[N3VocabRaw].
"""

from __future__ import annotations

import re
from collections.abc import Callable
from typing import Literal

from pydantic import BaseModel

from jp_pipeline.extract.layout import Span

KANJI = re.compile(r"[㐀-䶿一-鿿豈-﫿々]")
KANA = re.compile(r"^[぀-ヿー]+$")
HEADER_Y, FOOTER_Y = 50.0, 740.0  # tiêu đề trang ở y≈40; thẻ có thể bắt đầu từ y≈59


class N3Item(BaseModel):
    kind: Literal["example", "antonym", "note"]
    text: str


class N3VocabRaw(BaseModel):
    lesson: int
    no: int  # số thứ tự trong sách (đánh liên tục giữa các bài)
    word: str  # từ chính như sách in (kanji + okurigana, hoặc kana)
    variants: list[str] = []  # cách viết khác cùng số thứ tự: 降りる/下りる, アイデア/アイディア
    reading: str | None  # cách đọc hiragana/katakana (None = không ghép được → cần duyệt)
    particle: str | None  # trợ từ đi kèm (が/を/に)
    tags: list[str]  # (自) (他)…
    meaning_vi: list[str]
    items: list[N3Item]
    flags: list[str]


def _cluster_lines(spans: list[Span], tol: float = 4.0) -> list[list[Span]]:
    """Gom span thành dòng theo y (sai số tol), mỗi dòng sắp theo x."""
    lines: list[list[Span]] = []
    for s in sorted(spans, key=lambda s: (s.y0, s.x0)):
        if lines and abs(lines[-1][0].y0 - s.y0) <= tol:
            lines[-1].append(s)
        else:
            lines.append([s])
    return [sorted(ln, key=lambda s: s.x0) for ln in lines]


def _reading(head: list[Span], ruby: list[Span]) -> tuple[str | None, list[str]]:
    """Ghép cách đọc: span có kanji → furigana phía trên nó; span kana → giữ nguyên."""
    parts: list[str] = []
    flags: list[str] = []
    for h in head:
        if not KANJI.search(h.text):
            parts.append(h.text)
            continue
        over = sorted((r for r in ruby if h.x0 - 6 <= (r.x0 + r.x1) / 2 <= h.x1 + 6), key=lambda r: r.x0)
        if not over:
            return None, ["reading_missing"]
        # Gán từng furigana vào chữ Hán GẦN NHẤT (ước vị trí ký tự theo bề rộng span), rồi xen kana:
        # 思い出 + [おも, で] → おもいで ; 申し込む + [もう, こ] → もうしこむ
        w = (h.x1 - h.x0) / max(len(h.text), 1)
        centers = {i: h.x0 + w * (i + 0.5) for i, c in enumerate(h.text) if KANJI.match(c)}
        assigned: dict[int, list[str]] = {i: [] for i in centers}
        for r in over:
            rc = (r.x0 + r.x1) / 2
            nearest = min(centers, key=lambda i: abs(centers[i] - rc))
            assigned[nearest].append(r.text)
        for i, c in enumerate(h.text):
            if i in assigned:
                parts.append("".join(assigned[i]))
            elif not KANJI.match(c):
                parts.append(c)
        if any(not v for v in assigned.values()) and len(over) > 1:
            flags.append("reading_align")  # có chữ Hán không nhận furigana nào → cần soát
    return "".join(parts), flags


def _items(right: list[Span]) -> list[N3Item]:
    bullets = [s for s in right if s.text == "・"]
    content = [s for s in right if s.text != "・" and s.x0 >= 288]
    items: list[list[str]] = []
    for ln in _cluster_lines(content):
        text = "".join(s.text for s in ln).strip()
        y, x = ln[0].y0, ln[0].x0
        top = any(abs(b.y0 - y) <= 5 and b.x0 < 290 for b in bullets)
        sub = any(abs(b.y0 - y) <= 5 and 290 <= b.x0 < 310 for b in bullets)
        new = top or not items or text.startswith("対") or " vs " in text or (x < 300 and sub is False and items and items[-1][0].endswith("。"))
        if sub and items:
            items[-1].append(" / " + text)
        elif new:
            items.append([text])
        else:
            items[-1].append(text)
    out: list[N3Item] = []
    for parts in items:
        t = re.sub(r"\s+", " ", "".join(parts)).strip()
        if not t:
            continue
        kind: Literal["example", "antonym", "note"]
        if t.startswith("対"):
            kind = "antonym"
            t = re.sub(r"^対\s*[：:]\s*", "", t)
        elif "。" in t or t.endswith("」"):
            kind = "example"
        else:
            kind = "note"
        out.append(N3Item(kind=kind, text=t))
    return out


NUM = re.compile(r"^(\d+)(?:\s*[–\-~～]\s*(\d+))?$")
PARTICLES = "がをにでとへ"
TAG = re.compile(r"^[（(][自他/／\s]+[）)]$")  # nhãn tự/tha động từ: (自) （他） （自/他）


def _word_groups(big: list[Span]) -> list[tuple[list[Span], bool]]:
    """Tách từ chính thành nhóm: [(spans, có_dấu_ngăn_trước)]. Dấu ngăn = '・' (成功・失敗) hoặc '/'
    (が延びる/ を延ばす). Nhóm KHÔNG có dấu ngăn trước = phần xuống dòng của nhóm trước (間に / 合わせる)."""
    groups: list[tuple[list[Span], bool]] = []
    sep_pending = False
    for line in _cluster_lines(big, tol=6):
        cur: list[Span] = []
        cur_sep = sep_pending
        sep_pending = False
        for sp in line:
            raw = sp.text.strip()
            if raw.startswith(("・", "/", "／")):
                if cur:
                    groups.append((cur, cur_sep))
                    cur = []
                cur_sep = bool(groups) or cur_sep
            text = raw.lstrip("・/／").rstrip("/／・")
            # 'が/を変わる': '/' giữa 2 trợ từ là trợ từ thay thế, không phải dấu ngăn 2 từ
            text = re.sub(r"^([がをにでとへ])[/／]([がをにでとへ])", r"\1‖\2", text)
            for k, part in enumerate(re.split(r"[/／]", text)):
                part = part.replace("‖", "/")
                if k > 0 and cur:
                    groups.append((cur, cur_sep))
                    cur, cur_sep = [], True
                if part:
                    cur.append(sp.model_copy(update={"text": part}))
            if raw.endswith(("/", "／", "・")):
                if cur:
                    groups.append((cur, cur_sep))
                cur, cur_sep = [], True
                sep_pending = True
        if cur:
            groups.append((cur, cur_sep))
            sep_pending = False
    return groups


def _meaning_lines(spans: list[Span]) -> list[str]:
    return [re.sub(r"\s+", " ", " ".join(s.text for s in ln)).strip() for ln in _cluster_lines(spans)]


def parse_lesson(
    spans: list[Span], lesson: int, is_word: Callable[[str], bool] | None = None
) -> list[N3VocabRaw]:
    """is_word (tùy chọn, vd tra JMdict): phân biệt 'xuống dòng' (間に/合わせる → 1 từ) với
    '2 từ riêng cùng 1 số' (起きる/起こる → từ chính + cách viết/từ đi kèm)."""
    body = [s for s in spans if HEADER_Y < s.y0 < FOOTER_Y]
    nums = [s for s in body if s.bold and s.x0 < 110 and NUM.match(s.text)]
    out: list[N3VocabRaw] = []
    for i, n in enumerate(nums):
        nxt = nums[i + 1] if i + 1 < len(nums) else None

        def inside(s: Span, n: Span = n, nxt: Span | None = nxt) -> bool:
            start = (s.page, s.y0) >= (n.page, n.y0 - 20)
            end = nxt is None or (s.page, s.y0) < (nxt.page, nxt.y0 - 20)
            return start and end

        m = NUM.match(n.text)
        assert m
        a, b = int(m.group(1)), int(m.group(2) or m.group(1))
        nos = list(range(a, b + 1))
        card = [s for s in body if inside(s) and s is not n]
        # Từ chính = nhóm chữ TO NHẤT ở cột trái (thường 22; có thẻ 19.7 / 18 / 16), trừ nhãn (自)(他)
        left = [s for s in card if s.x0 < 215 and s.size >= 13 and not TAG.match(s.text)]
        if not left:
            continue
        top = max(s.size for s in left)
        cut = 19.5 if top >= 19.5 else top - 0.5
        big = [s for s in left if s.size >= cut]
        raw_groups = _word_groups(big)
        if len(nos) == 1:
            # 1 số thứ tự: nhóm không có dấu ngăn = xuống dòng → nối vào nhóm trước; có dấu ngăn = cách viết khác
            merged: list[list[Span]] = []
            texts = ["".join(x.text for x in g_spans) for g_spans, _ in raw_groups]
            separate = (
                is_word is not None
                and len(raw_groups) > 1
                and not is_word("".join(texts))
                and all(is_word(t) for t in texts)
            )
            for g_spans, sep in raw_groups:
                if merged and not sep and not separate:
                    merged[-1].extend(g_spans)
                else:
                    merged.append(list(g_spans))
            alts = merged
            groups = alts[:1]
        else:
            alts = []
            groups = [g for g, _ in raw_groups]
        ruby_pool = [s for s in card if s.size <= 11.5 and not s.bold and s.x0 < 215 and not NUM.match(s.text)]
        side = [s for s in card if 15 <= s.size < cut and s.x0 < 215]
        tags = [s.text for s in card if s.x0 < 215 and TAG.match(s.text)]
        side_particle = next(
            (s.text for s in side if KANA.match(s.text) and s.x1 <= min(g[0].x0 for g in groups) + 2), None
        )
        variants = ["".join(s.text for s in a) for a in alts[1:]]
        meaning_spans = [s for s in card if s.bold and s.x0 >= 270]
        mlines = _meaning_lines(meaning_spans)
        right = [s for s in card if s.x0 >= 270 and not s.bold and s.text not in ("意味", "例文")]
        items = _items(right)

        # Nghĩa cho từng từ khi thẻ ghép nhiều từ
        per_word: list[list[str]]
        card_flags: list[str] = []
        k = len(groups)
        if k == 1:
            per_word = [mlines]
        elif len(mlines) == 1 and len(re.split(r"\s*/\s*", mlines[0])) == k:
            per_word = [[x] for x in re.split(r"\s*/\s*", mlines[0])]
        elif len(mlines) == k:
            per_word = [[x] for x in mlines]
            card_flags.append("pair_meaning_order")  # gán nghĩa theo thứ tự dòng — cần soát
        else:
            per_word = [mlines] * k
            card_flags.append("pair_meaning_shared")
        if len(nos) != k:
            card_flags.append(f"pair_count_{len(nos)}_vs_{k}")

        for j, g in enumerate(groups):
            gy = min(s.y0 for s in g)
            gx0, gx1 = g[0].x0, g[-1].x1
            particle = side_particle
            first = g[0]
            pm = re.match(r"^≒?([がをにでとへ](?:/[がをにでとへ])*)(?=[㐀-鿿])", first.text)
            if pm:
                particle = pm.group(1)
                g = [first.model_copy(update={"text": first.text[pm.end():]}), *g[1:]]
            ruby = [r for r in ruby_pool if gy - 24 <= r.y0 < gy and gx0 - 15 <= r.x0 <= gx1 + 5]
            reading, flags = _reading(g, ruby)
            meaning = per_word[j] if j < len(per_word) else mlines
            if not meaning:
                flags.append("meaning_missing")
            out.append(
                N3VocabRaw(
                    lesson=lesson,
                    no=nos[j] if j < len(nos) else nos[-1] * 1000 + j,
                    word="".join(s.text for s in g),
                    variants=variants if k == 1 else [],
                    reading=reading,
                    particle=particle,
                    tags=tags,
                    meaning_vi=meaning,
                    items=items,
                    flags=[*flags, *card_flags],
                )
            )
    return out


def _hira(s: str) -> str:
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s)


def _core(word: str) -> str:
    """Bỏ phần phụ để tra từ điển: （お）, ～, 〜, ＋, ≒ và trợ từ đầu."""
    w = re.sub(r"[（(][^）)]*[）)]", "", word)
    return re.sub(r"[～〜＋+≒]", "", w).strip()


def check_with_jmdict(entries: list[N3VocabRaw], jm: dict[str, list[object]]) -> list[N3VocabRaw]:
    """Đối chiếu (từ, cách đọc) với JMdict.
    - cách đọc không khớp mục nào có dạng kanji = từ → cờ jmdict_mismatch + gợi ý (nếu duy nhất)
    - thiếu cách đọc mà JMdict có DUY NHẤT một cách đọc cho từ → điền, cờ reading_from_jmdict
    """
    by_kanji: dict[str, set[str]] = {}
    for reading, items in jm.items():
        for it in items:
            for k in getattr(it, "kanji", []):
                by_kanji.setdefault(k, set()).add(reading)
    out: list[N3VocabRaw] = []
    for e in entries:
        core = _core(e.word)
        flags = list(e.flags)
        reading = e.reading
        cands = by_kanji.get(core, set())
        # 2 từ dính trên cùng dòng (降りる下りる / おりるおりる): tách khi cả 2 nửa là từ có cách đọc khớp
        if not cands and reading and KANJI.search(core):
            rd_all = _hira(_core(reading))
            for i in range(1, len(core)):
                w1, w2 = core[:i], core[i:]
                okuri = re.compile(r"^[㐀-鿿].*[぀-ゟ]$")  # chữ Hán + đuôi kana (降りる)
                if not (okuri.match(w1) and okuri.match(w2)):
                    continue
                r1s, r2s = by_kanji.get(w1, set()), by_kanji.get(w2, set())
                hit = next(
                    ((r1, r2) for r1 in r1s for r2 in r2s if _hira(r1) + _hira(r2) == rd_all), None
                )
                if hit:
                    e = e.model_copy(update={"word": w1, "variants": [w2, *e.variants]})
                    core, reading, cands = w1, hit[0], r1s
                    flags.append("split_glued")
                    break
        if not KANJI.search(core):
            out.append(e)
            continue  # từ viết kana: cách đọc chính là từ
        rd = _core(reading) if reading else None
        if rd and cands and _hira(rd) not in {_hira(c) for c in cands}:
            flags.append("jmdict_mismatch:" + "/".join(sorted(cands))[:40])
            if len(cands) == 1:
                reading = next(iter(cands))
                flags.append("reading_from_jmdict")
        elif not rd and len(cands) == 1:
            reading = next(iter(cands))
            flags = [f for f in flags if f != "reading_missing"] + ["reading_from_jmdict"]
        elif rd and not cands:
            flags.append("jmdict_unknown")
        out.append(e.model_copy(update={"reading": reading, "flags": flags}))
    return out
