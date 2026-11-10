from collections import Counter

import pytest

from jp_pipeline.dictionaries import JmEntry
from jp_pipeline.transform.vocab_auto import (
    SourceVocab,
    cjk_chars,
    learn_han_viet,
    masu_to_dict,
    new_id,
    resolve_han_viet,
    suggest_kanji,
)


def jm(kanji: list[str], pos: str, common: bool = True, uk: bool = False, gloss: str = "x") -> JmEntry:
    return JmEntry(seq=1, kanji=kanji, common=common, uk=uk, pos=[pos], gloss=[gloss])


def test_new_id() -> None:
    assert new_id("lesson1_3") == ("mn-01-003", 1)
    assert new_id("lesson50_120") == ("mn-50-120", 50)
    with pytest.raises(ValueError):
        new_id("bai1-3")


def test_cjk_chars_repeat_mark() -> None:
    assert cjk_chars("人々") == ["人", "人"]
    assert cjk_chars("行きます") == ["行"]


@pytest.mark.parametrize(
    ("kana", "code", "expected"),
    [
        ("おきます", "V2", ("おきる", "ます")),
        ("かかります", "V1", ("かかります"[:-3] + "る", "ります")),
        ("いきます", "V1", ("いく", "きます")),
        ("します", "V3", ("する", "します")),
        ("きます", "V3", ("くる", "きます")),
        ("べんきょうします", "V3", ("べんきょう", "します")),
        ("りんご", "N", None),
    ],
)
def test_masu_to_dict(kana: str, code: str, expected: tuple[str, str] | None) -> None:
    assert masu_to_dict(kana, code) == expected


def test_suggest_kanji_filters_by_pos() -> None:
    idx = {"わたし": [jm(["私"], "pronoun"), jm(["渡し"], "noun (common)")]}
    kanji, cands, _ = suggest_kanji("わたし", "Pro", idx)
    assert kanji is not None and kanji.kanji == "私" and cands == []


def test_suggest_kanji_ambiguous_returns_candidates() -> None:
    idx = {"かかる": [jm(["掛かる"], "Godan verb"), jm(["罹る"], "Godan verb")]}
    kanji, cands, _ = suggest_kanji("かかります", "V1", idx)
    assert kanji is None
    assert [c.kanji for c in cands] == ["掛かります", "罹ります"]


def test_suggest_kanji_masu_forms() -> None:
    idx = {
        "おきる": [jm(["起きる"], "Ichidan verb")],
        "くる": [jm(["来る"], "Kuru verb - special class")],
        "べんきょう": [jm(["勉強"], "noun or participle which takes the aux. verb suru")],
    }
    assert (k := suggest_kanji("おきます", "V2", idx)[0]) is not None and k.kanji == "起きます"
    assert (k := suggest_kanji("きます", "V3", idx)[0]) is not None and k.kanji == "来ます"
    assert (k := suggest_kanji("べんきょうします", "V3", idx)[0]) is not None and k.kanji == "勉強します"


def test_suggest_kanji_skips_non_hiragana() -> None:
    assert suggest_kanji("コピーします", "V3", {}) == (None, [], False)


def _row(kanji: str, kanji_vn: str) -> SourceVocab:
    return SourceVocab(id="lesson1_1", jp="", kanji=kanji, kanji_vn=kanji_vn, vn="", type="", type_code="N")


def test_learn_and_resolve_han_viet() -> None:
    learned = learn_han_viet([_row("会社員", "HỘI XÃ VIÊN"), _row("社員", "XÃ VIÊN"), _row("速", "TỐC/TẢO")])
    assert learned["社"] == Counter({"XÃ": 2})
    assert "速" not in learned  # có dấu "/" → không học
    hv, src, amb = resolve_han_viet(["会", "社"], learned, {})
    assert (hv, src, amb) == ("HỘI XÃ", "derived", {})
    hv, src, amb = resolve_han_viet(["私"], learned, {"私": ["tư"]})
    assert (hv, src) == ("TƯ", "unihan")
    hv, _, amb = resolve_han_viet(["行"], learned, {"行": ["hàng", "hành"]})
    assert hv is None and amb == {"行": ["HÀNG", "HÀNH"]}


def test_suggest_kanji_unknown_type_code_does_not_guess() -> None:
    idx = {"うん": [jm(["運"], "noun (common)")]}
    assert suggest_kanji("うん", "XYZ", idx) == (None, [], False)


@pytest.mark.parametrize(
    ("kanji", "hv", "ok"),
    [
        ("会社員", "HỘI XÃ VIÊN", True),
        ("住みます", "TRÚ, TRỤ", True),
        ("本", "BẢN/BỔN", True),
        ("晩", "VÃN(DẠ)", True),
        ("時間", "THÌ/THỜI GIAN", True),
        ("暑い, 熱い", "THỬ, NHIỆT", True),
        ("夫 /主人", "PHU / CHỦ NHÂN", True),
        ("休みます", "HƯUHỘI XÃ", False),
        ("散歩します", "TÁN BỘCÔNG VIÊN", False),
        ("自動販売機", "TỰ ĐỘNGPHIẾN MẠI CƠ", False),
        ("あります", "TẾ", False),
    ],
)
def test_source_han_viet_valid(kanji: str, hv: str, ok: bool) -> None:
    from jp_pipeline.transform.vocab_auto import source_han_viet_valid

    assert source_han_viet_valid(kanji, hv) is ok


@pytest.mark.parametrize(
    ("tok", "glued"),
    [("GIÁNGVŨ", True), ("THÔNGĐẠO", True), ("HƯUHỘI", True), ("GIÁNG", False), ("QUỐC", False),
     ("NGUYỆT", False), ("TRƯỜNG", False), ("KHUYẾT", False), ("THUYẾT", False), ("Ỷ", False)],
)
def test_is_glued(tok: str, glued: bool) -> None:
    from jp_pipeline.transform.vocab_auto import is_glued

    assert is_glued(tok) is glued
