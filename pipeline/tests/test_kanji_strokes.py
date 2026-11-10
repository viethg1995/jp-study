import pytest

from jp_pipeline.schemas import KanjiEntry
from jp_pipeline.transform.kanji_strokes import build_strokes, kanjivg_filename, parse_kanjivg_svg

SVG = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.0//EN" "x" [
<!ATTLIST g kvg:element CDATA #IMPLIED >
]>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 109 109" xmlns:kvg="https://kanjivg.tagaini.net/">
<g id="kvg:StrokePaths_04e8c"><g id="kvg:04e8c" kvg:element="二">
  <path id="kvg:04e8c-s2" kvg:type="㇐" d="M10,80 L90,80"/>
  <path id="kvg:04e8c-s1" kvg:type="㇐" d="M25,30 L80,30"/>
</g></g>
<g id="kvg:StrokeNumbers_04e8c">
  <text transform="matrix(1 0 0 1 18.5 33)">1</text>
  <text transform="matrix(1 0 0 1 4 83.25)">2</text>
</g>
</svg>"""


def kanji(ch: str, strokes: int | None) -> KanjiEntry:
    return KanjiEntry(
        id=f"k-{ch}", char=ch, han_viet=[], han_viet_source=None, meaning_vi=None, meaning_vi_source=None,
        meanings_en=[], on=[], kun=[], strokes=strokes, grade=None, jlpt_old=None, radical=None,
        first_lesson=None, vocab_refs=[],
    )


def test_filename() -> None:
    assert kanjivg_filename("体") == "kanji/04f53.svg"


def test_parse_orders_strokes_by_id() -> None:
    s = parse_kanjivg_svg(SVG)
    assert [x.d for x in s] == ["M25,30 L80,30", "M10,80 L90,80"]
    assert s[0].type == "㇐" and s[0].num == [18.5, 33.0]


def test_parse_rejects_number_mismatch() -> None:
    with pytest.raises(ValueError):
        parse_kanjivg_svg(SVG.replace('<text transform="matrix(1 0 0 1 4 83.25)">2</text>', ""))


def test_build_reports_missing_and_mismatch() -> None:
    out, rep = build_strokes([kanji("二", 3), kanji("匂", 4)], {"二": SVG})
    assert [k.char for k in out] == ["二"]
    assert rep.missing == ["匂"] and rep.count_mismatch == {"二": (2, 3)}


SVG2 = """<svg xmlns="http://www.w3.org/2000/svg" xmlns:kvg="https://kanjivg.tagaini.net/">
<g id="kvg:StrokePaths_04f11"><g id="kvg:04f11" kvg:element="休">
  <g id="kvg:04f11-g1" kvg:element="亻" kvg:original="人"><path id="kvg:04f11-s1" d="M1,1"/><path id="kvg:04f11-s2" d="M2,2"/></g>
  <g id="kvg:04f11-g2" kvg:element="木"><path id="kvg:04f11-s3" d="M3,3"/></g>
  <g id="kvg:04f11-g3" kvg:element="CDP-8BC4"><path id="kvg:04f11-s4" d="M4,4"/></g>
</g></g></svg>"""


def test_components_top_level_and_skip_cdp() -> None:
    from jp_pipeline.transform.kanji_strokes import parse_components

    assert parse_components(SVG2) == [("亻", "人", [1, 2]), ("木", None, [3])]


def test_parse_stories() -> None:
    from jp_pipeline.transform.kanji_build import parse_stories

    out = parse_stories([("01.txt", "# by: ai\n休|Người dựa gốc cây.\n"), ("02.txt", "# by: user\n休|Người nghỉ.\n")])
    assert out == {"休": ("Người nghỉ.", "user")}
    with pytest.raises(ValueError):
        parse_stories([("x.txt", "休 thiếu dấu gạch\n")])
