from jp_pipeline.extract.layout import Span
from jp_pipeline.transform.kanji_ebook import lessons_by_page, no_diacritics, parse_ebook


def sp(page: int, x0: float, y0: float, size: float, text: str) -> Span:
    return Span(page=page, x0=x0, y0=y0, x1=x0 + size * len(text), y1=y0 + size, size=size, bold=False, text=text)


def test_no_diacritics() -> None:
    assert no_diacritics("ĐÔ") == "DO"
    assert no_diacritics("QUẢNG") == "QUANG"


def test_lessons_by_page_carry_forward() -> None:
    spans = [sp(1, 450, 39, 12, "漢字N４ – 第２課"), sp(2, 100, 300, 12, "x"), sp(3, 450, 39, 12, "第３課")]
    assert lessons_by_page(spans) == {1: 2, 2: 2, 3: 3}


def test_big_char_row_is_primary() -> None:
    spans = [
        sp(1, 450, 39, 12, "第２課"),
        sp(1, 136, 273, 12, "LỤC"),  # nhãn hình minh họa — không được dùng khi đã có hàng chữ lớn
        *[sp(1, 86 + 60 * i, 668, 48, c) for i, c in enumerate("部屋広")],
    ]
    out, warns = parse_ebook(spans, "N4", {}, 3)
    assert [(k.lesson, k.order, k.char) for k in out] == [(2, 1, "部"), (2, 2, "屋"), (2, 3, "広")] and warns == []


def test_hv_fallback_prefers_char_seen_and_exact() -> None:
    spans = [
        sp(1, 100, 40, 14, "漢字N5 - 第3課"),
        sp(1, 100, 224, 13, "BÁCH"),
        sp(1, 182, 224, 13, "VAN"),  # OCR mất dấu
        sp(1, 287, 363, 16, "百"),
    ]
    cands = {"百": ({"BACH"}, 4), "柏": ({"BACH"}, None), "万": ({"VAN"}, 4), "文": ({"VAN"}, 4)}
    out, _ = parse_ebook(spans, "N5", cands, 4, {"百": {"BÁCH"}, "万": {"VẠN"}, "文": {"VĂN"}})
    assert out[0].char == "百" and out[0].flags == []
    # VAN: 万 và 文 cùng điểm, không cái nào có trên trang → nhập nhằng, bỏ (không đoán)
    assert len(out) == 1


def test_parse_lesson_files() -> None:
    import pytest

    from jp_pipeline.transform.kanji_build import parse_lesson_files

    txt = "# by: ai\n1|一二|NHẤT NHỊ\n2|三|TAM\n"
    assert parse_lesson_files([("n5.txt", txt)]) == {"N5": {"一": (1, 1), "二": (1, 2), "三": (2, 1)}}
    with pytest.raises(ValueError):
        parse_lesson_files([("n5.txt", "1|一|-\n2|一|-\n")])
