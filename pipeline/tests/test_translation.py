"""Đề luyện dịch: validate schema, id khớp bài, không trùng id."""

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
