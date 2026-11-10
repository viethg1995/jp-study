import unicodedata
from pathlib import Path

from jp_pipeline.extract.ai_queue import split_pages
from jp_pipeline.extract.pdf_to_md import _relink_images, nfc, output_dir_for


def test_nfc_normalizes_decomposed_vietnamese() -> None:
    decomposed = unicodedata.normalize("NFD", "bộ thủ")
    assert decomposed != "bộ thủ"
    assert nfc(decomposed) == "bộ thủ"


def test_output_dir_mirrors_source_tree(tmp_path: Path) -> None:
    src = tmp_path / "sources"
    pdf = src / "books" / "N5" / unicodedata.normalize("NFD", "Nhập môn.pdf")
    out = output_dir_for(pdf, src, src / "_extracted")
    assert out == src / "_extracted" / "books" / "N5" / "Nhập môn"


def test_relink_images_rewrites_absolute_paths(tmp_path: Path) -> None:
    images = tmp_path / "images"
    images.mkdir()
    (images / "a.pdf-0001-01.png").write_bytes(b"")
    md = "x ![](C:\\abs\\path\\a.pdf-0001-01.png) y ![](missing.png)"
    out = _relink_images(md, images)
    assert "![](images/a.pdf-0001-01.png)" in out
    assert "![](missing.png)" in out  # ảnh không tồn tại thì giữ nguyên


def test_split_pages_by_marker() -> None:
    md = "---\nfm\n---\n<!-- page 1 route=script -->\nA\n\n<!-- page 2 route=ocr -->\nB\n"
    assert split_pages(md) == {1: "A", 2: "B"}
