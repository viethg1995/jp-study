"""PDF → Markdown trung gian, theo kết quả chấm điểm (pdf_score).

- Trang route `script` / `hybrid`: trích bằng pymupdf4llm (giữ tiêu đề, bảng, danh sách).
  `hybrid` được đánh dấu để bước AI xử lý tiếp (xem export-queue).
- Trang route `ocr` / `ai` / `skip`: chỉ ghi marker, chưa có nội dung.

Mỗi trang có marker `<!-- page N route=X -->` để tra ngược về bản gốc; ảnh tách ra `images/`.
Đầu ra là bản TRUNG GIAN để đọc/soát và làm input cho bước transform, không phải data cuối.
"""

from __future__ import annotations

import hashlib
import re
import shutil
import tempfile
import unicodedata
from collections.abc import Callable
from datetime import date
from pathlib import Path

import pymupdf
import pymupdf4llm
from pydantic import BaseModel

from jp_pipeline.extract.pdf_score import DocScore, Route

PAGES_PER_BATCH = 20
EXTRACTOR_VERSION = f"pymupdf4llm-{pymupdf4llm.__version__}"
SCRIPT_ROUTES: frozenset[Route] = frozenset({"script", "hybrid"})

pymupdf.TOOLS.mupdf_display_errors(False)

_PLACEHOLDER: dict[Route, str] = {
    "ocr": "_(trang scan — chờ OCR)_",
    "ai": "_(chờ AI đọc ảnh — xem export-queue)_",
    "skip": "_(trang trống)_",
}


class ExtractRecord(BaseModel):
    """Một dòng trong manifest.json — dùng để chạy tăng dần (bỏ qua file không đổi)."""

    source: str  # đường dẫn tương đối từ thư mục sources/
    output: str  # đường dẫn content.md tương đối từ thư mục _extracted/
    sha256: str
    pages: int
    counts: dict[str, int]  # số trang theo route
    empty_pages: list[int]  # trang script/hybrid nhưng không trích được text
    images: int
    extractor: str
    extracted_on: str


class ExtractResult(BaseModel):
    record: ExtractRecord
    markdown: str


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def nfc(text: str) -> str:
    """Chuẩn hóa Unicode NFC — tên file tiếng Việt trên Windows có thể ở dạng NFD."""
    return unicodedata.normalize("NFC", text)


def output_dir_for(pdf: Path, sources_root: Path, extracted_root: Path) -> Path:
    rel = pdf.relative_to(sources_root).with_suffix("")
    return extracted_root / Path(*(nfc(part) for part in rel.parts))


_IMG_LINK = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")


def _relink_images(md: str, image_dir: Path) -> str:
    """pymupdf4llm ghi link ảnh theo đường dẫn tuyệt đối → đổi thành `images/<tên>`."""

    def repl(m: re.Match[str]) -> str:
        name = Path(m.group(2).replace("\\", "/")).name
        if (image_dir / name).exists():
            return f"![{m.group(1)}](images/{name})"
        return m.group(0)

    return _IMG_LINK.sub(repl, md)


def _frontmatter(record: ExtractRecord) -> str:
    counts = ", ".join(f"{k}: {v}" for k, v in record.counts.items() if v)
    return "\n".join(
        [
            "---",
            f'source: "{record.source}"',
            f"pages: {record.pages}",
            f"routes: {{{counts}}}",
            f"extractor: {record.extractor}",
            f"extracted_on: {record.extracted_on}",
            f"sha256: {record.sha256}",
            "---",
            "",
        ]
    )


def _run_pymupdf4llm(
    doc: pymupdf.Document,
    pages0: list[int],
    image_dir: Path,
    write_images: bool,
    on_progress: Callable[[int, int], None] | None,
) -> dict[int, str]:
    """Trích các trang (0-based) → {page_1based: markdown}."""
    out: dict[int, str] = {}
    if image_dir.exists():
        shutil.rmtree(image_dir)  # xóa ảnh cũ của lần trích trước

    # pymupdf4llm thay dấu cách trong image_path bằng "_" → ghi vào thư mục tạm
    # không có dấu cách, xong mới chuyển sang image_dir.
    with tempfile.TemporaryDirectory(prefix="jp_img_") as tmp:
        for start in range(0, len(pages0), PAGES_PER_BATCH):
            batch = pages0[start : start + PAGES_PER_BATCH]
            chunks = pymupdf4llm.to_markdown(
                doc,
                pages=batch,
                page_chunks=True,
                write_images=write_images,
                image_path=tmp if write_images else "",
                image_format="png",
                image_dpi=150,
                use_ocr=False,
            )
            for p0, chunk in zip(batch, chunks, strict=True):
                out[p0 + 1] = str(chunk.get("text", "")).strip()
            if on_progress:
                on_progress(min(start + PAGES_PER_BATCH, len(pages0)), len(pages0))

        pngs = sorted(Path(tmp).glob("*.png"))
        if pngs:
            image_dir.mkdir(parents=True, exist_ok=True)
            for png in pngs:
                shutil.move(png, image_dir / png.name)
    return out


def extract_pdf(
    pdf: Path,
    score: DocScore,
    *,
    sources_root: Path,
    extracted_root: Path,
    write_images: bool = True,
    on_progress: Callable[[int, int], None] | None = None,
) -> ExtractResult:
    """Chuyển PDF thành Markdown theo route của từng trang trong `score`.

    Ghi ảnh (nếu bật) vào `<out>/images/`; việc ghi content.md và manifest do cli.py đảm nhận.
    """
    out_dir = output_dir_for(pdf, sources_root, extracted_root)
    image_dir = out_dir / "images"
    to_extract = [s.page - 1 for s in score.page_scores if s.route in SCRIPT_ROUTES]

    with pymupdf.open(pdf) as doc:
        texts = (
            _run_pymupdf4llm(doc, to_extract, image_dir, write_images, on_progress)
            if to_extract
            else {}
        )

    parts: list[str] = []
    empty: list[int] = []
    for s in score.page_scores:
        parts.append(f"<!-- page {s.page} route={s.route} -->\n")
        if s.route in SCRIPT_ROUTES:
            text = texts.get(s.page, "")
            if text:
                parts.append(text + "\n")
            else:
                empty.append(s.page)
                parts.append("_(không trích được text)_\n")
        else:
            parts.append(_PLACEHOLDER[s.route] + "\n")

    md = "\n".join(parts)
    images = 0
    if write_images and image_dir.exists():
        md = _relink_images(md, image_dir)
        images = sum(1 for _ in image_dir.glob("*.png"))

    record = ExtractRecord(
        source=score.source,
        output=(out_dir / "content.md").relative_to(extracted_root).as_posix(),
        sha256=score.sha256,
        pages=score.pages,
        counts=score.counts,
        empty_pages=empty,
        images=images,
        extractor=EXTRACTOR_VERSION,
        extracted_on=date.today().isoformat(),
    )
    return ExtractResult(record=record, markdown=_frontmatter(record) + md)
