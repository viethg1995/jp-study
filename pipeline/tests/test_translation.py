"""Luyện dịch: câu đơn + đoạn văn — validate schema, ruby, id khớp bài/cấp, không trùng id."""

from typing import Any

import pytest

from jp_pipeline.transform.translation import build_translation


def _ex(id_: str = "t-01-01", lesson: int = 1, refs: list[str] | None = None) -> dict[str, object]:
    return {
        "id": id_,
        "lesson": lesson,
        "title_vi": "Đề",
        "prompt_lang": "vi",
        "focus_vi": [],
        "grammar_refs": [],
        "sentences": [{"prompt": "Tôi là Lan.", "references": refs or ["わたしはランです。"], "note_vi": None}],
        "source": "ai-draft",
        "review": "auto",
    }


def test_build_sorted() -> None:
    doc = build_translation({"b.json": [_ex("t-02-01", 2)], "a.json": [_ex()]})
    assert [e.id for e in doc.exercises] == ["t-01-01", "t-02-01"]


@pytest.mark.parametrize(
    ("docs", "msg"),
    [
        ({"a.json": [_ex(), _ex()]}, "trùng id"),
        ({"a.json": [_ex("t-02-01", 1)]}, "lệch bài"),
        ({"a.json": [_ex("t-1-1")]}, "id"),
        ({"a.json": [_ex(refs=["{私|わたし}です"])]}, "references"),
        ({"a.json": {"x": 1}}, "mảng"),
    ],
)
def test_build_errors(docs: dict[str, object], msg: str) -> None:
    with pytest.raises(ValueError, match=msg):
        build_translation(docs)


# ---------------------------------------------------------------- Đoạn văn


def _sent(ja: str = "{私|わたし}は{学生|がくせい}です。", para: int = 1, **kw: Any) -> dict[str, Any]:
    return {"ja": ja, "ja_alt": [], "vi": "Tôi là sinh viên.", "vi_alt": [], "note_vi": None, "para": para, **kw}


def _pa(id_: str = "p-n5-001", level: str = "n5", sents: list[dict[str, Any]] | None = None, **kw: Any) -> dict[str, Any]:
    return {
        "id": id_,
        "level": level,
        "title_ja": "{自己紹介|じこしょうかい}",
        "title_vi": "Giới thiệu bản thân",
        "genre": "essay",
        "focus_vi": [],
        "sentences": sents or [_sent(), _sent(para=1), _sent(para=2)],
        "source": "ai-draft",
        "review": "auto",
        **kw,
    }


def test_passages_built() -> None:
    doc = build_translation({}, {"n5.json": [_pa("p-n5-002"), _pa()], "n4.json": [_pa("p-n4-001", "n4")]})
    assert doc.schema_version == 2
    assert [p.id for p in doc.passages] == ["p-n4-001", "p-n5-001", "p-n5-002"]
    assert doc.passages[1].sentences[0].ja_text == "私は学生です。"


@pytest.mark.parametrize(
    ("docs", "msg"),
    [
        ({"n5.json": [_pa(), _pa()]}, "trùng id"),
        ({"n5.json": [_pa("p-n4-001")]}, "lệch cấp"),
        ({"n5.json": [_pa("p-5-001")]}, "p-nX-NNN"),
        ({"n4.json": [_pa()]}, "n5.json"),
        ({"n5.json": [_pa(sents=[_sent("私は学生です。"), _sent(), _sent()])]}, "furigana"),
        ({"n5.json": [_pa(sents=[_sent("[[{私|わたし}]]です。"), _sent(), _sent()])]}, r"\[\["),
        ({"n5.json": [_pa(title_ja="自己紹介")]}, "title_ja"),
        ({"n5.json": [_pa(sents=[_sent(para=2), _sent(), _sent()])]}, "para"),
        ({"n5.json": [_pa(sents=[_sent(), _sent(para=3), _sent(para=3)])]}, "para"),
        ({"n5.json": [_pa(sents=[_sent(), _sent()])]}, "sentences"),
        ({"n5.json": [_pa(sents=[_sent(ja_text="x"), _sent(), _sent()])]}, "ja_text"),
        ({"n5.json": [_pa(sents=[_sent(vi_alt=["{a|b}"]), _sent(), _sent()])]}, "vi_alt"),
        ({"n5.json": [_pa(sents=[_sent(vi="x" * 400)] * 3)]}, "quá dài"),
        ({"n5.json": [_pa(sents=[_sent("あ" * 150)] * 3)]}, "quá dài"),
        ({"n5.json": {"x": 1}}, "mảng"),
    ],
)
def test_passage_errors(docs: dict[str, object], msg: str) -> None:
    with pytest.raises(ValueError, match=msg):
        build_translation({}, docs)


def test_id_unique_across_kinds() -> None:
    doc = build_translation({"a.json": [_ex()]}, {"n5.json": [_pa()]})
    assert len(doc.exercises) == 1 and len(doc.passages) == 1
