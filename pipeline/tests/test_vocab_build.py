import pytest
from pydantic import ValidationError

from jp_pipeline.dictionaries import KanjiInfo
from jp_pipeline.schemas import VocabExample
from jp_pipeline.transform.vocab_auto import AutoVocab, SourceVocab
from jp_pipeline.transform.vocab_build import build_vocab, find_han_viet_conflicts, merge_entry


def _row(idx: int, jp: str, kanji: str | None, kanji_vn: str | None = None) -> SourceVocab:
    return SourceVocab(id=f"lesson1_{idx}", jp=jp, kanji=kanji, kanji_vn=kanji_vn, vn="nghĩa", type="Danh từ", type_code="N")


def _auto(idx: int, kanji: str | None, hv: str | None, flags: list[str] | None = None) -> AutoVocab:
    return AutoVocab(
        id=f"mn-01-{idx:03d}", legacy_id=f"lesson1_{idx}", lesson=1, kanji=kanji,
        kanji_source="jmdict" if kanji else None, display="kana", han_viet=hv,
        han_viet_source="derived" if hv else None, kanji_refs=[], flags=flags or [],
    )


KD = {c: KanjiInfo(char=c, on=[], kun=[], meanings_en=[], strokes=1, grade=1, jlpt_old=4, radical=1) for c in "私腹会社"}


def test_reviewed_layer_overrides_auto_and_recomputes_refs() -> None:
    row = _row(1, "わたし", None)
    e = merge_entry(row, _auto(1, "渡し", "ĐỘ"), {"kanji": "私", "kanji_source": "ai-draft",
                                                  "han_viet": "TƯ", "han_viet_source": "ai-draft",
                                                  "review": {"by": "user", "status": "reviewed"}})
    assert (e.kanji, e.han_viet, e.kanji_refs, e.review) == ("私", "TƯ", ["k-私"], "user")
    assert e.display == "kana" and e.provenance.kanji == "ai-draft"


def test_reviewed_none_clears_kanji() -> None:
    e = merge_entry(_row(2, "これ", None), _auto(2, "此れ", None), {"kanji": None, "kanji_source": "none", "han_viet": None})
    assert e.kanji is None and e.kanji_refs == [] and e.provenance.kanji is None


def test_build_reports_errors_and_pending() -> None:
    rows = [_row(1, "わたし", None), _row(2, "かいしゃ", "会社", "HỘI XÃ"), _row(3, "x", None)]
    auto = {"mn-01-001": _auto(1, "私", "TƯ", ["kanji_verify"]), "mn-01-002": _auto(2, "会社", "HỘI XÃ")}
    entries, rep = build_vocab(rows, auto, {"mn-09-999": {}}, KD)
    assert len(entries) == 2
    assert any("mn-01-003" in e and "_auto" in e for e in rep.errors)
    assert any("mn-09-999" in e for e in rep.errors)
    assert rep.pending_review == ["mn-01-001"]


def test_han_viet_count_mismatch_is_warning() -> None:
    entries, rep = build_vocab([_row(1, "かいしゃ", "会社", "HỘI")], {"mn-01-001": _auto(1, "会社", "HỘI")}, {}, KD)
    assert entries and any("số âm" in w for w in rep.warnings)


def test_find_han_viet_conflicts() -> None:
    rows = [_row(1, "a", "腹", "PHỤC"), _row(2, "b", "腹", "PHÚC")]
    auto = {"mn-01-001": _auto(1, "腹", "PHỤC"), "mn-01-002": _auto(2, "腹", "PHÚC")}
    entries, _ = build_vocab(rows, auto, {}, KD)
    assert find_han_viet_conflicts(entries) == {"腹": {"PHỤC": ["mn-01-001"], "PHÚC": ["mn-01-002"]}}


def test_example_requires_single_target_marker() -> None:
    base = {"id": "mn-01-001-e1", "vi": "Tôi là sinh viên.", "max_lesson": 1, "source": "ai-draft", "review": "auto"}
    VocabExample(ruby="[[{私|わたし}]]は{学生|がくせい}です。", **base)
    with pytest.raises(ValidationError):
        VocabExample(ruby="{私|わたし}は{学生|がくせい}です。", **base)
