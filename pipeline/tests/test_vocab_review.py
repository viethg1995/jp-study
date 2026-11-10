import pytest

from jp_pipeline.transform.vocab_auto import AutoVocab
from jp_pipeline.transform.vocab_review import apply_decision, parse_decisions


def _auto(kanji: str | None = "降ります", hv: str | None = "GIÁNG") -> AutoVocab:
    return AutoVocab(
        id="mn-50-002", legacy_id="lesson50_2", lesson=50, kanji=kanji, kanji_source="jmdict",
        display="kana", han_viet=hv, han_viet_source="derived", kanji_refs=[], flags=[],
    )


def test_parse_decisions() -> None:
    ds = parse_decisions("# comment\n\n50-002|居ります|CƯ|khiêm nhường\nmn-01-001|=|=\n")
    assert [d.id for d in ds] == ["mn-50-002", "mn-01-001"]
    assert ds[0].note == "khiêm nhường" and ds[1].note == ""
    with pytest.raises(ValueError):
        parse_decisions("01-001|only-two")


def test_apply_replace_marks_ai_draft_and_keeps_other_fields() -> None:
    (d,) = parse_decisions("50-002|居ります|cư|sửa nghĩa")
    rec = apply_decision({"examples": [1]}, _auto(), d, "ai")
    assert rec["kanji"] == "居ります" and rec["kanji_source"] == "ai-draft"
    assert rec["han_viet"] == "CƯ" and rec["han_viet_source"] == "ai-draft"
    assert rec["examples"] == [1]
    assert rec["review"] == {"status": "reviewed", "by": "ai", "note": "sửa nghĩa"}


def test_apply_keep_and_none() -> None:
    (keep,) = parse_decisions("50-002|=|=")
    # "=" giữ nguyên quyết định của file trước (không xóa)
    rec = apply_decision({"kanji": "cũ", "han_viet": "CŨ"}, _auto(), keep, "user")
    assert rec["kanji"] == "cũ" and rec["han_viet"] == "CŨ"
    assert rec["review"]["by"] == "user"
    # chưa có quyết định → không ghi gì, _auto chảy qua
    rec = apply_decision({}, _auto(), keep, "user")
    assert "kanji" not in rec and "han_viet" not in rec
    (none,) = parse_decisions("50-002|-|X")
    rec = apply_decision({}, _auto(), none, "ai")
    assert rec["kanji"] is None and rec["kanji_source"] == "none" and rec["han_viet"] is None
