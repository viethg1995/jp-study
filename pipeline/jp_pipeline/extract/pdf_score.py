"""Chấm điểm từng trang PDF để quyết định công cụ trích xuất (không dùng AI, không tốn token).

Route cho mỗi trang:
  script  — lớp text sạch, bố cục đơn giản → pymupdf4llm là đủ.
  hybrid  — có lớp text nhưng bố cục phức tạp (bài tập, ô trống, chữ rải rác, nhiều ảnh)
            → script trích text trước, AI chỉ sắp xếp lại cấu trúc (gửi ảnh trang + text).
  ocr     — không có lớp text nhưng có ảnh (trang scan) → Tesseract.
  ai      — chỉ gán qua override thủ công hoặc khi OCR cho kết quả kém.
  skip    — trang trống (không text, không ảnh).

Mọi ngưỡng nằm ở hằng số dưới đây; chỉnh ngưỡng → chạy lại `score-pdf --force`.
"""

from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path
from typing import Literal

import pymupdf
from pydantic import BaseModel

Route = Literal["script", "hybrid", "ocr", "ai", "skip"]
ROUTES: tuple[Route, ...] = ("script", "hybrid", "ocr", "ai", "skip")

SCORER_VERSION = "4"  # tăng khi đổi logic/ngưỡng → cache score.json tự vô hiệu

# ---- Ngưỡng phân luồng ----
MIN_TEXT_CHARS = 30  # dưới mức này coi như trang không có lớp text
BLANK_IMAGE_COVER = 0.05  # không text + ảnh phủ dưới 5% → trang trống
BACKGROUND_IMAGE_COVER = 0.9  # ảnh phủ ≥ 90% trang có text = ảnh nền, không tính vào image_cover
HYBRID_BLANK_SLOTS = 3  # ≥ 3 ô trống kiểu （   ） / ____ → trang bài tập
HYBRID_SHORT_LINE_RATIO = 0.5  # ≥ 50% dòng chỉ 1–3 ký tự → chữ rải rác, dễ lộn thứ tự
HYBRID_MIN_LINES = 10
HYBRID_IMAGE_COVER = 0.4  # ảnh phủ ≥ 40% trang ...
HYBRID_IMAGE_MAX_CHARS = 150  # ... mà text rất ít → nội dung chính nằm trong ảnh
FURIGANA_SIZE_RATIO = 0.7  # dòng có cỡ chữ < 70% trung vị = furigana, không tính là "dòng ngắn"

# ---- Ước lượng token cho route cần AI (chỉ để báo cáo, không chính xác tuyệt đối) ----
TOKENS_PER_PAGE_IMAGE = 2_300  # ảnh trang ~1100x1568 px ≈ w*h/750
TOKENS_PER_PAGE_OUTPUT = 1_000
CHARS_PER_TOKEN = 2  # text tiếng Nhật/Việt ≈ 2 ký tự/token

_BLANK_SLOT = re.compile(r"[（(][\s　]{2,}[）)]|_{3,}|＿{2,}")
_JP_CHAR = re.compile(r"[぀-ヿ一-鿿]")


class PageScore(BaseModel):
    page: int  # 1-based
    chars: int
    jp_ratio: float
    image_cover: float
    short_line_ratio: float
    lines: int
    blank_slots: int
    route: Route
    reasons: list[str]


class DocScore(BaseModel):
    source: str
    sha256: str
    scorer_version: str
    scored_on: str
    overrides: dict[str, str] = {}
    pages: int
    counts: dict[str, int]
    est_ai_tokens: int
    page_scores: list[PageScore]

    def pages_by_route(self, route: Route) -> list[int]:
        return [p.page for p in self.page_scores if p.route == route]


def _image_rects(page: pymupdf.Page) -> list[pymupdf.Rect]:
    rects = []
    for info in page.get_image_info():
        r = pymupdf.Rect(info["bbox"]) & page.rect
        if not r.is_empty:
            rects.append(r)
    return rects


def _image_cover(page: pymupdf.Page, rects: list[pymupdf.Rect]) -> float:
    """Tỷ lệ trang bị ảnh phủ, BỎ QUA ảnh nền (phủ ≥ BACKGROUND_IMAGE_COVER trang)."""
    area = abs(page.rect)
    if area == 0:
        return 0.0
    covered = sum(abs(r) for r in rects if abs(r) / area < BACKGROUND_IMAGE_COVER)
    return min(1.0, covered / area)


def _table_rects(page: pymupdf.Page) -> list[pymupdf.Rect]:
    try:
        return [pymupdf.Rect(t.bbox) for t in page.find_tables().tables]
    except Exception:  # noqa: BLE001 — find_tables thỉnh thoảng lỗi với trang lạ; coi như không có bảng
        return []


def _line_texts(page: pymupdf.Page, exclude: list[pymupdf.Rect]) -> list[str]:
    """Các dòng text chính của trang.

    Bỏ: dòng nằm trong bảng (ô bảng tiếng Nhật thường 1–3 ký tự nhưng vẫn trích tốt) và
    furigana (cỡ chữ < FURIGANA_SIZE_RATIO × cỡ chữ trung vị của trang).
    """
    rows: list[tuple[str, float, pymupdf.Point]] = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            text = "".join(span["text"] for span in line["spans"]).strip()
            if not text:
                continue
            size = max(span["size"] for span in line["spans"])
            x0, y0, x1, y1 = line["bbox"]
            rows.append((text, size, pymupdf.Point((x0 + x1) / 2, (y0 + y1) / 2)))
    if not rows:
        return []
    sizes = sorted(r[1] for r in rows)
    median = sizes[len(sizes) // 2]
    return [
        text
        for text, size, center in rows
        if size >= median * FURIGANA_SIZE_RATIO and not any(center in r for r in exclude)
    ]


def route_page(
    chars: int,
    image_cover: float,
    blank_slots: int,
    short_line_ratio: float,
    lines: int,
    raw_image_cover: float | None = None,
) -> tuple[Route, list[str]]:
    """Hàm thuần: chỉ số → (route, lý do). Tách riêng để test.

    image_cover: đã bỏ ảnh nền; raw_image_cover: tính cả ảnh nền (trang scan = 1 ảnh phủ kín).
    """
    if chars < MIN_TEXT_CHARS:
        raw = image_cover if raw_image_cover is None else raw_image_cover
        if raw < BLANK_IMAGE_COVER:
            return "skip", ["không text, không ảnh"]
        return "ocr", [f"không lớp text ({chars} ký tự), ảnh phủ {raw:.0%}"]

    reasons: list[str] = []
    if blank_slots >= HYBRID_BLANK_SLOTS:
        reasons.append(f"{blank_slots} ô trống (trang bài tập)")
    if lines >= HYBRID_MIN_LINES and short_line_ratio >= HYBRID_SHORT_LINE_RATIO:
        reasons.append(f"{short_line_ratio:.0%} dòng ngắn (chữ rải rác)")
    if image_cover >= HYBRID_IMAGE_COVER and chars < HYBRID_IMAGE_MAX_CHARS:
        reasons.append(f"ảnh phủ {image_cover:.0%}, chỉ {chars} ký tự text")
    if reasons:
        return "hybrid", reasons
    return "script", []


def score_page(page: pymupdf.Page) -> PageScore:
    text = page.get_text()
    compact = re.sub(r"\s+", "", text)
    chars = len(compact)
    def short_stats(lines: list[str]) -> float:
        short = sum(1 for t in lines if len(t.replace(" ", "")) <= 3)
        return short / len(lines) if lines else 0.0

    lines = _line_texts(page, exclude=[])
    short_ratio = short_stats(lines)
    # find_tables chậm (~0.4s/trang) → chỉ gọi khi trang bị nghi "chữ rải rác".
    if len(lines) >= HYBRID_MIN_LINES and short_ratio >= HYBRID_SHORT_LINE_RATIO:
        tables = _table_rects(page)
        if tables:
            lines = _line_texts(page, exclude=tables)
            short_ratio = short_stats(lines)
    rects = _image_rects(page)
    image_cover = _image_cover(page, rects)
    raw_cover = min(1.0, sum(abs(r) for r in rects) / abs(page.rect)) if abs(page.rect) else 0.0
    blank_slots = len(_BLANK_SLOT.findall(text))

    route, reasons = route_page(
        chars, image_cover, blank_slots, short_ratio, len(lines), raw_image_cover=raw_cover
    )
    return PageScore(
        page=page.number + 1,
        chars=chars,
        jp_ratio=round(len(_JP_CHAR.findall(compact)) / chars, 3) if chars else 0.0,
        image_cover=round(image_cover, 3),
        short_line_ratio=round(short_ratio, 3),
        lines=len(lines),
        blank_slots=blank_slots,
        route=route,
        reasons=reasons,
    )


def estimate_ai_tokens(scores: list[PageScore]) -> int:
    total = 0
    for s in scores:
        if s.route == "hybrid":
            total += TOKENS_PER_PAGE_IMAGE + s.chars // CHARS_PER_TOKEN + TOKENS_PER_PAGE_OUTPUT
        elif s.route == "ai":
            total += TOKENS_PER_PAGE_IMAGE + TOKENS_PER_PAGE_OUTPUT
    return total


def parse_page_spec(spec: str, max_page: int) -> list[int]:
    """'1-5,8,10-12' → [1,2,3,4,5,8,10,11,12] (1-based, cắt theo max_page)."""
    pages: set[int] = set()
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            pages.update(range(int(a), int(b) + 1))
        else:
            pages.add(int(part))
    return sorted(p for p in pages if 1 <= p <= max_page)


def apply_overrides(scores: list[PageScore], overrides: dict[str, str]) -> None:
    """overrides: {"1-10": "script", "21": "ai"} — ghi đè route thủ công."""
    by_page = {s.page: s for s in scores}
    for spec, route in overrides.items():
        if route not in ROUTES:
            raise ValueError(f"Route không hợp lệ trong override: {route!r}")
        for p in parse_page_spec(spec, len(scores)):
            by_page[p].route = route  # type: ignore[assignment]
            by_page[p].reasons = [f"override thủ công → {route}"]


def load_overrides(path: Path, source: str) -> dict[str, str]:
    if not path.exists():
        return {}
    data: dict[str, dict[str, str]] = json.loads(path.read_text(encoding="utf-8"))
    return data.get(source, {})


def score_pdf(pdf: Path, *, source: str, sha256: str, overrides: dict[str, str]) -> DocScore:
    with pymupdf.open(pdf) as doc:
        scores = [score_page(page) for page in doc]
    apply_overrides(scores, overrides)
    counts = {r: sum(1 for s in scores if s.route == r) for r in ROUTES}
    return DocScore(
        source=source,
        sha256=sha256,
        scorer_version=SCORER_VERSION,
        scored_on=date.today().isoformat(),
        overrides=overrides,
        pages=len(scores),
        counts=counts,
        est_ai_tokens=estimate_ai_tokens(scores),
        page_scores=scores,
    )
