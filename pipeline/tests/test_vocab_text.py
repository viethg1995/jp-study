import pytest

from jp_pipeline.dictionaries import JmEntry
from jp_pipeline.schemas import PartOfSpeech, VocabEntry, VocabProvenance
from jp_pipeline.transform.meaning_check import check_meanings, dict_form
from jp_pipeline.transform.vocab_review import (
    Decision,
    MeaningDecision,
    PosDecision,
    apply_decision,
    apply_meaning_decision,
    apply_pos_decision,
    parse_meaning_decisions,
)
from jp_pipeline.transform.vocab_text import normalize_slots, split_senses


@pytest.mark.parametrize(
    ("raw", "want"),
    [
        ("~ này", "～ này"),
        ("― tuổi", "～ tuổi"),
        ("-giờ", "～giờ"),
        ("- phút", "～ phút"),
        ("－歳", "～歳"),
        ("món [cơm] ca-ri", "món [cơm] ca-ri"),  # gạch nối trong từ giữ nguyên
        ("e-mail", "e-mail"),
    ],
)
def test_normalize_slots(raw: str, want: str) -> None:
    assert normalize_slots(raw) == want


def test_split_senses_trailing_context() -> None:
    s = split_senses("gọi [điện thoại]")
    assert [(x.text, x.context) for x in s] == [("gọi", "điện thoại")]
    s = split_senses("tham gia [trận đấu]; dự [tiệc]")
    assert [(x.text, x.context) for x in s] == [("tham gia", "trận đấu"), ("dự", "tiệc")]
    s = split_senses("được nướng [bánh mì ～],[thịt ～]")
    assert s[0].context == "bánh mì ～, thịt ～"


def test_split_senses_inner_bracket_kept() -> None:
    assert split_senses("món [cơm] ca-ri")[0].text == "món [cơm] ca-ri"
    assert split_senses("[tiền thừa] ra, chạy ra")[0].context is None
    # ';' trong ngoặc không tách
    assert len(split_senses("có (a; b)")) == 1


class _A:
    kanji = "会"
    kanji_source = "source"
    han_viet = "HỘI"
    han_viet_source = "source"
    pos_suggested = None


def test_user_provenance() -> None:
    d = Decision(id="mn-01-001", kanji="=", han_viet="HỘI KIẾN", note="")
    assert apply_decision({}, _A(), d, "user")["han_viet_source"] == "user"  # type: ignore[arg-type]
    assert apply_decision({}, _A(), d, "ai")["han_viet_source"] == "ai-draft"  # type: ignore[arg-type]
    p = PosDecision(id="mn-01-001", code="Adv", note="")
    assert apply_pos_decision({}, _A(), "N", p, "user")["pos_source"] == "user"  # type: ignore[arg-type]


def test_ai_does_not_downgrade_user_review() -> None:
    d = Decision(id="mn-01-001", kanji="=", han_viet="X", note="")
    rec = apply_decision({"review": {"by": "user"}}, _A(), d, "ai")  # type: ignore[arg-type]
    assert rec["review"]["by"] == "user" and rec["han_viet_source"] == "ai-draft"  # type: ignore[index]


def test_meaning_decision() -> None:
    (d,) = parse_meaning_decisions("# by: ai\n47-005|chia tay [người ～]|đồng âm")
    rec = apply_meaning_decision({"review": {"by": "user"}}, d, "ai")
    assert rec["meaning_vi"] == "chia tay [người ～]" and rec["meaning_source"] == "ai-draft"
    assert rec["review"]["by"] == "user" and rec["review"]["meaning_by"] == "ai"  # type: ignore[index]
    with pytest.raises(ValueError):
        parse_meaning_decisions("47-005|")
    assert isinstance(d, MeaningDecision)


def _v(vid: str, kana: str, kanji: str | None, code: str, meaning: str = "x") -> VocabEntry:
    return VocabEntry(
        id=vid, legacy_id="x", lesson=1, kana=kana, kanji=kanji, display="kanji", han_viet=None,
        meaning_vi=meaning, senses=split_senses(meaning), pos=PartOfSpeech.of(code), kanji_refs=[],
        same_word=[], provenance=VocabProvenance(kanji="source", han_viet=None, pos="source", meaning="source"),
        review="auto",
    )


def test_kanji_must_contain_cjk() -> None:
    with pytest.raises(ValueError):
        _v("mn-07-009", "かけます", "かけます", "V2")


def test_dict_form() -> None:
    assert dict_form(_v("mn-47-005", "わかれます", "別れます", "V2")) == ("わかれる", ["別れる"])
    assert dict_form(_v("mn-05-002", "きます", "来ます", "V3")) == ("くる", ["来る"])
    assert dict_form(_v("mn-01-020", "～さい", "～歳", "Suf")) == ("さい", ["歳"])


def test_check_meanings_homophone() -> None:
    jm = {
        "わかれる": [
            JmEntry(seq=1, kanji=["別れる"], common=True, uk=False, pos=["Ichidan verb"], gloss=["to part"]),
            JmEntry(seq=2, kanji=["分かれる"], common=True, uk=False, pos=["Ichidan verb"], gloss=["to branch"]),
        ]
    }
    (s,) = check_meanings([_v("mn-47-005", "わかれます", "別れます", "V2", "chia ra")], jm)
    assert s.kind == "homophone" and s.gloss == ["to part"] and s.others[0].kanji == ["分かれる"]


@pytest.mark.parametrize(
    ("raw", "want"),
    [("năm -", "năm ～"), ("thứ - , số -", "thứ ～ , số ～"), ("số - (thứ tự)", "số ～ (thứ tự)"), ("ーねん", "～ねん"), ("コーヒー", "コーヒー")],
)
def test_normalize_slots_trailing_and_choon(raw: str, want: str) -> None:
    assert normalize_slots(raw) == want


def test_kana_decision() -> None:
    from jp_pipeline.transform.vocab_review import apply_kana_decision

    (d,) = parse_meaning_decisions("32-042|ヨーロッパ|thiếu trường âm")
    rec = apply_kana_decision({}, d, "ai")
    assert rec["kana"] == "ヨーロッパ" and rec["review"]["kana_by"] == "ai"  # type: ignore[index]


def test_merge_by_upgrades_ai_to_user() -> None:
    from jp_pipeline.transform.vocab_review import merge_by

    assert merge_by("ai", "user") == "user"
    assert merge_by("user", "ai") == "user"
    assert merge_by(None, "ai") == "ai"
    p = PosDecision(id="mn-01-001", code="Adv", note="")
    rec = apply_pos_decision({"review": {"by": "ai"}}, _A(), "N", p, "user")  # type: ignore[arg-type]
    assert rec["review"]["by"] == "user"  # type: ignore[index]
