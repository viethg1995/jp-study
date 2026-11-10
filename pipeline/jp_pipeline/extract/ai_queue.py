"""Xuất hàng đợi trang cho AI xử lý: render ảnh trang + kèm text script đã trích (nếu có).

AI CHỈ được đọc ảnh trong `<_extracted>/<book>/ai_queue/`, không đọc PDF gốc.
Ảnh được giới hạn cạnh dài ≤ MAX_EDGE_PX để không tốn token vô ích.
"""

from __future__ import annotations

import re
import shutil
from pathlib import Path

import pymupdf
from pydantic import BaseModel

from jp_pipeline.extract.pdf_score import DocScore, Route

MAX_EDGE_PX = 1568  # Claude tự thu nhỏ ảnh lớn hơn mức này → render to hơn chỉ phí token

_PAGE_MARK = re.compile(r"^<!-- page (\d+) route=\w+ -->$", re.MULTILINE)


class QueueItem(BaseModel):
    page: int
    route: Route
    reasons: list[str]
    image: str  # tên file trong ai_queue/
    script_text: str  # text script đã trích (rỗng nếu trang scan)


class AiQueue(BaseModel):
    source: str
    sha256: str
    est_tokens: int
    items: list[QueueItem]


def split_pages(content_md: str) -> dict[int, str]:
    """Tách content.md theo marker trang → {page: text}."""
    out: dict[int, str] = {}
    marks = list(_PAGE_MARK.finditer(content_md))
    for i, m in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(content_md)
        out[int(m.group(1))] = content_md[m.end() : end].strip()
    return out


def build_queue(
    pdf: Path,
    score: DocScore,
    *,
    queue_dir: Path,
    routes: set[Route],
    pages: list[int] | None,
    content_md: str,
    est_tokens_per_page: int,
    max_edge_px: int = MAX_EDGE_PX,
) -> AiQueue:
    """Render các trang cần AI vào queue_dir (xóa queue cũ). Trả về mô tả hàng đợi."""
    targets = [
        s
        for s in score.page_scores
        if s.route in routes and (pages is None or s.page in pages)
    ]
    if queue_dir.exists():
        shutil.rmtree(queue_dir)
    queue_dir.mkdir(parents=True)

    texts = split_pages(content_md) if content_md else {}
    items: list[QueueItem] = []
    with pymupdf.open(pdf) as doc:
        for s in targets:
            page = doc[s.page - 1]
            zoom = min(2.0, max_edge_px / max(page.rect.width, page.rect.height))
            pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom))
            name = f"p{s.page:04d}.png"
            pix.save(str(queue_dir / name))
            items.append(
                QueueItem(
                    page=s.page,
                    route=s.route,
                    reasons=s.reasons,
                    image=name,
                    script_text=texts.get(s.page, "") if s.route == "hybrid" else "",
                )
            )
    return AiQueue(
        source=score.source,
        sha256=score.sha256,
        est_tokens=est_tokens_per_page * len(items) if max_edge_px >= MAX_EDGE_PX
        else int(est_tokens_per_page * len(items) * (max_edge_px / MAX_EDGE_PX) ** 2),
        items=items,
    )
