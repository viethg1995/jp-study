"""Trích cụm chữ (span) kèm tọa độ / cỡ chữ / độ đậm từ trang PDF — nền cho parser theo bố cục
(sách dạng "thẻ" mà thứ tự đọc của pymupdf4llm bị xáo trộn: N3 từ vựng, N3 Kanji).
Chạy qua CLI với `python -I -X utf8` (PDF là file không tin cậy).
"""

from __future__ import annotations

import unicodedata
from pathlib import Path

import pymupdf
from pydantic import BaseModel


class Span(BaseModel):
    page: int  # 1-based
    x0: float
    y0: float
    x1: float
    y1: float
    size: float
    bold: bool
    text: str


def _ocr_env(tessdata: Path, tesseract_dir: Path) -> None:
    import os

    os.environ["TESSDATA_PREFIX"] = str(tessdata)
    if str(tesseract_dir) not in os.environ.get("PATH", ""):
        os.environ["PATH"] = str(tesseract_dir) + os.pathsep + os.environ.get("PATH", "")


def page_spans(
    pdf: Path,
    pages: list[int] | None = None,
    ocr: bool = False,
    tessdata: Path | None = None,
    tesseract_dir: Path | None = None,
    dpi: int = 300,
) -> list[Span]:
    """Mọi span có chữ, theo thứ tự trang → y → x. pages: số trang 1-based (None = tất cả).
    ocr=True: chạy Tesseract (jpn) trên ảnh trang qua PyMuPDF (trang scan / ảnh) — cần tessdata."""
    out: list[Span] = []
    if ocr:
        if tessdata is None or tesseract_dir is None:
            raise ValueError("ocr=True cần tessdata và tesseract_dir")
        _ocr_env(tessdata, tesseract_dir)
    with pymupdf.open(pdf) as doc:
        for pno in pages or range(1, doc.page_count + 1):
            page = doc[pno - 1]
            tp = page.get_textpage_ocr(language="jpn+vie", dpi=dpi, full=True, tessdata=str(tessdata)) if ocr else None
            for block in page.get_text("dict", textpage=tp)["blocks"]:
                for line in block.get("lines", []):
                    for s in line["spans"]:
                        text = unicodedata.normalize("NFC", s["text"]).strip()
                        if not text:
                            continue
                        x0, y0, x1, y1 = s["bbox"]
                        out.append(
                            Span(
                                page=pno,
                                x0=round(x0, 1),
                                y0=round(y0, 1),
                                x1=round(x1, 1),
                                y1=round(y1, 1),
                                size=round(s["size"], 1),
                                bold=bool(s["flags"] & 16) or "bold" in s["font"].lower(),
                                text=text,
                            )
                        )
    return sorted(out, key=lambda s: (s.page, round(s.y0), s.x0))
