import pymupdf
import pytest

from jp_pipeline.extract.pdf_score import (
    PageScore,
    apply_overrides,
    estimate_ai_tokens,
    parse_page_spec,
    route_page,
    score_page,
)


@pytest.mark.parametrize(
    ("chars", "cover", "slots", "short", "lines", "expected"),
    [
        (0, 0.0, 0, 0.0, 0, "skip"),  # trang trắng
        (5, 0.9, 0, 0.0, 0, "ocr"),  # scan
        (800, 0.1, 0, 0.1, 30, "script"),  # text sạch
        (500, 0.1, 4, 0.1, 30, "hybrid"),  # bài tập nhiều ô trống
        (300, 0.1, 0, 0.7, 20, "hybrid"),  # chữ rải rác
        (100, 0.6, 0, 0.1, 5, "hybrid"),  # nội dung chủ yếu trong ảnh
        (380, 0.9, 0, 0.1, 30, "script"),  # bảng dày chữ trên nền nhiều lớp ảnh
        (900, 0.6, 0, 0.1, 40, "script"),  # ảnh lớn nhưng text đầy đủ
    ],
)
def test_route_page(
    chars: int, cover: float, slots: int, short: float, lines: int, expected: str
) -> None:
    route, reasons = route_page(chars, cover, slots, short, lines)
    assert route == expected
    assert (route == "script") == (reasons == [])


def test_scan_page_with_full_background_image_is_ocr_not_skip() -> None:
    # Trang scan: ảnh phủ kín trang → image_cover (đã bỏ ảnh nền) = 0 nhưng raw = 1.0
    route, _ = route_page(0, 0.0, 0, 0.0, 0, raw_image_cover=1.0)
    assert route == "ocr"


def test_parse_page_spec() -> None:
    assert parse_page_spec("1-3, 5,9-10", max_page=9) == [1, 2, 3, 5, 9]
    assert parse_page_spec("", max_page=5) == []


def _score(page: int, route: str, chars: int = 100) -> PageScore:
    return PageScore(
        page=page, chars=chars, jp_ratio=0, image_cover=0, short_line_ratio=0,
        lines=0, blank_slots=0, route=route, reasons=[],  # type: ignore[arg-type]
    )


def test_apply_overrides() -> None:
    scores = [_score(i, "script") for i in range(1, 6)]
    apply_overrides(scores, {"2-3": "ai", "5": "skip"})
    assert [s.route for s in scores] == ["script", "ai", "ai", "script", "skip"]
    with pytest.raises(ValueError):
        apply_overrides(scores, {"1": "bogus"})


def test_estimate_ai_tokens_counts_only_ai_routes() -> None:
    assert estimate_ai_tokens([_score(1, "script"), _score(2, "ocr")]) == 0
    assert estimate_ai_tokens([_score(1, "hybrid", chars=200)]) > 0


def test_score_page_on_real_pdf_page() -> None:
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_textbox(pymupdf.Rect(36, 36, 560, 800), "lorem ipsum dolor sit amet " * 30)
    s = score_page(page)
    assert s.route == "script"
    assert s.page == 1
    empty = score_page(doc.new_page())
    assert empty.route == "skip"
