"""Danh sách Kanji theo bài từ ebook Kanji của từng cấp (N5: ảnh → OCR; N4: có lớp text).

Ebook trình bày mỗi bài "漢字N5 – 第3課" với dòng âm Hán-Việt IN HOA của các chữ trong bài
(BÁCH THIÊN VẠN VIÊN HÀ). Chữ Hán cỡ lớn trên thẻ OCR không đáng tin, nên ghép:

  âm Hán-Việt (bỏ dấu, vì OCR hay mất dấu)  ×  ứng viên đúng cấp JLPT (KANJIDIC2)
  ưu tiên chữ có mặt trong phần chữ đọc được của bài (từ ví dụ)

Chọn được DUY NHẤT → ghi nhận; nhập nhằng / không có ứng viên → cờ để duyệt (không đoán).
Hàm thuần: nhận list[Span] (đã OCR nếu cần) → list[EbookKanji] + danh sách cảnh báo.
"""

from __future__ import annotations

import re
import unicodedata

from pydantic import BaseModel

from jp_pipeline.extract.layout import Span

CJK = re.compile(r"[一-鿿]")
HV_TOKEN = re.compile(r"^[A-ZĐÀ-Ỹ][A-ZĐÀ-Ỹ]+$")
STOP = {"N5", "N4", "N3", "CM", "DM", "OK", "TV"}


class EbookKanji(BaseModel):
    level: str  # "N5" | "N4"
    lesson: int
    order: int  # thứ tự trong bài (theo vị trí dòng Hán-Việt)
    char: str
    han_viet_book: str  # âm như ebook in (có thể mất dấu do OCR)
    flags: list[str]


def no_diacritics(s: str) -> str:
    s = s.replace("Đ", "D").replace("đ", "d")
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").upper()


def lessons_by_page(spans: list[Span]) -> dict[int, int]:
    """Số bài cho từng trang theo tiêu đề '…第N課' ở đầu trang (trang không có tiêu đề → bài trước đó)."""
    found: dict[int, int] = {}
    for page in sorted({s.page for s in spans}):
        head = "".join(s.text for s in sorted((s for s in spans if s.page == page and s.y0 < 75), key=lambda s: s.x0))
        m = re.search(r"第\s*(\d+)\s*課", unicodedata.normalize("NFKC", head))
        if m:
            found[page] = int(m.group(1))
    out: dict[int, int] = {}
    cur: int | None = None
    for page in sorted({s.page for s in spans}):
        cur = found.get(page, cur)
        if cur is not None:
            out[page] = cur
    return out


def parse_ebook(
    spans: list[Span],
    level: str,
    candidates: dict[str, tuple[set[str], int | None]],
    level_jlpt: int,
    exact: dict[str, set[str]] | None = None,
) -> tuple[list[EbookKanji], list[str]]:
    """candidates: {字: (tập âm Hán-Việt BỎ DẤU, jlpt_old)} — thường lấy từ KANJIDIC2 + bảng âm Hán-Việt.
    exact: {字: tập âm CÓ DẤU} — khớp đúng cả dấu được cộng điểm (ebook có dấu chuẩn; OCR mất dấu thì vẫn khớp bỏ dấu)."""
    exact = exact or {}
    page_lesson = lessons_by_page(spans)
    by_lesson_tokens: dict[int, list[tuple[int, float, float, str]]] = {}
    by_lesson_chars: dict[int, set[str]] = {}
    for s in spans:
        lesson = page_lesson.get(s.page)
        if lesson is None:
            continue
        by_lesson_chars.setdefault(lesson, set()).update(CJK.findall(s.text))
        for tok in s.text.split():
            tok = tok.strip(".,:;()[]【】")
            # chỉ chữ IN HOA toàn bộ (dải À-Ỹ có cả chữ thường tiếng Việt → so với .upper())
            if HV_TOKEN.match(tok) and tok == tok.upper() and tok not in STOP and len(no_diacritics(tok)) >= 2:
                by_lesson_tokens.setdefault(lesson, []).append((s.page, s.y0, s.x0, tok))

    # Cách 1 (chắc chắn): trang mở bài in sẵn HÀNG CHỮ HÁN CỠ LỚN (N4: cỡ 48) — mỗi span 1 chữ, xếp theo dòng/x
    big: dict[int, list[tuple[int, float, float, str]]] = {}
    for s in spans:
        lesson = page_lesson.get(s.page)
        if lesson is not None and s.size >= 36 and len(s.text) == 1 and CJK.match(s.text):
            big.setdefault(lesson, []).append((s.page, round(s.y0 / 20), s.x0, s.text))
    out: list[EbookKanji] = []
    warnings: list[str] = []
    taken: set[str] = set()
    for lesson, items in sorted(big.items()):
        order = 0
        for _, _, _, ch in sorted(items):
            if ch in taken:
                continue
            order += 1
            taken.add(ch)
            out.append(EbookKanji(level=level, lesson=lesson, order=order, char=ch, han_viet_book="", flags=[]))

    # Cách 2 (dự phòng, vd ebook ảnh → OCR): ghép âm Hán-Việt in hoa với ứng viên đúng cấp
    for lesson in sorted(by_lesson_tokens):
        if lesson in big:
            continue
        seen_tok: set[str] = set()
        order = 0
        present = by_lesson_chars.get(lesson, set())
        for _, _, _, tok in sorted(by_lesson_tokens[lesson]):
            key = no_diacritics(tok)
            if key in seen_tok:
                continue
            seen_tok.add(key)
            scored = []
            for ch, (hvs, jlpt) in candidates.items():
                if key not in hvs or ch in taken:
                    continue
                score = (
                    (3 if tok in exact.get(ch, set()) else 0)
                    + (2 if ch in present else 0)
                    + (1 if jlpt == level_jlpt else 0)
                    + (0.5 if jlpt in (3, 4) else 0)
                )
                scored.append((score, ch))
            if not scored:
                continue  # chữ in hoa không phải âm Hán-Việt của chữ nào đúng cấp → bỏ (tên riêng, chú thích…)
            scored.sort(reverse=True)
            best = scored[0]
            ties = [c for sc, c in scored if sc == best[0]]
            flags: list[str] = []
            if len(ties) > 1:
                if best[0] < 2:
                    warnings.append(f"{level} bài {lesson}: '{tok}' nhập nhằng {''.join(ties[:6])} — bỏ")
                    continue
                flags.append("ambiguous:" + "".join(ties[:6]))
            if best[1] not in present:
                flags.append("not_seen_on_page")
            order += 1
            taken.add(best[1])
            out.append(EbookKanji(level=level, lesson=lesson, order=order, char=best[1], han_viet_book=tok, flags=flags))
    return out, warnings
