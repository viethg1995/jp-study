import pytest

from jp_pipeline.dictionaries import JmEntry
from jp_pipeline.schemas import PartOfSpeech, pos_label
from jp_pipeline.transform.vocab_auto import AutoVocab, SourceVocab, suggest_pos
from jp_pipeline.transform.vocab_review import apply_pos_decision, parse_pos_decisions


def jm(kanji: list[str], pos: str, common: bool = True) -> JmEntry:
    return JmEntry(seq=1, kanji=kanji, common=common, uk=False, pos=[pos], gloss=["x"])


def row(jp: str, kanji: str | None, code: str) -> SourceVocab:
    return SourceVocab(id="lesson1_1", jp=jp, kanji=kanji, kanji_vn=None, vn="", type="", type_code=code)


def test_pos_label_canonical_and_rejects_unknown() -> None:
    assert pos_label("Pro/Phr") == "Đại từ / Cụm từ"
    assert PartOfSpeech.of("Det").label.startswith("Từ chỉ định")
    with pytest.raises(ValueError):
        pos_label("XYZ")


def test_suggest_pn_common_noun_to_n() -> None:
    idx = {"コーヒー": [jm([], "noun (common) (futsuumeishi)")]}
    assert suggest_pos(row("コーヒー", None, "PN"), idx)[0] == "N"
    assert suggest_pos(row("ＩＭＣ", None, "PN"), idx) == (None, None)


def test_suggest_verb_group_fixes() -> None:
    idx = {
        "はなす": [jm(["話す"], "Godan verb with 'su' ending")],
        "かりる": [jm(["借りる"], "Ichidan verb")],
        "かりる_": [],
    }
    assert suggest_pos(row("はなします", "話します", "V3"), idx)[0] == "V1"
    assert suggest_pos(row("かります", "借ります", "V1"), idx)[0] == "V2"
    assert suggest_pos(row("かります", "借ります", "V2"), idx) == (None, None)  # đã đúng


def _auto(sug: str | None) -> AutoVocab:
    return AutoVocab(id="mn-01-001", legacy_id="lesson1_1", lesson=1, kanji=None, kanji_source=None,
                     display="kana", han_viet=None, han_viet_source=None, kanji_refs=[], flags=[],
                     pos_suggested=sug)


def test_apply_pos_decision_keeps_existing_reviewer() -> None:
    (d,) = parse_pos_decisions("01-001|=|ok")
    rec = apply_pos_decision({"review": {"by": "user", "status": "reviewed"}}, _auto("N"), "PN", d, "ai")
    assert rec["pos_code"] == "N" and rec["pos_source"] == "jmdict"
    assert rec["review"]["by"] == "user" and rec["review"]["pos_by"] == "ai"
    (keep,) = parse_pos_decisions("01-001|-")
    assert apply_pos_decision({}, _auto("N"), "PN", keep, "ai")["pos_code"] == "PN"
    (bad,) = parse_pos_decisions("01-001|Foo")
    with pytest.raises(ValueError):
        apply_pos_decision({}, _auto("N"), "PN", bad, "ai")
