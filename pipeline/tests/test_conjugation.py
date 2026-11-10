import pytest

from jp_pipeline.transform.conjugation import conjugate, first_kanji, to_ruby


def forms(kind: str, kana: str, kanji: str | None = None, dictionary_form: bool = False) -> dict[str, str]:
    _, _, fs = conjugate(kind, kana, kanji, dictionary_form)
    return {f.form: to_ruby(f.kanji, f.kana) or f.kana for f in fs}


def test_v1_te_ta_by_ending() -> None:
    cases = {"かいます": "かって", "まちます": "まって", "かえります": "かえって", "のみます": "のんで",
             "あそびます": "あそんで", "しにます": "しんで", "かきます": "かいて", "いそぎます": "いそいで",
             "はなします": "はなして", "いきます": "いって"}
    for masu, te in cases.items():
        f = forms("V1", masu)
        assert f["te"] == te
        assert f["ta"] == te[:-1] + ("だ" if te.endswith("で") else "た")


def test_v1_rows_and_wa() -> None:
    f = forms("V1", "かいます", "買います")
    assert f["nai"] == "{買|か}わない" and f["dict"] == "{買|か}う" and f["potential"] == "{買|か}える"
    assert f["volitional"] == "{買|か}おう" and f["passive"] == "{買|か}われる" and f["ba"] == "{買|か}えば"


def test_causative_passive_su_verbs() -> None:
    assert forms("V1", "はなします")["causative_passive"] == "はなさせられる"
    assert forms("V1", "かきます")["causative_passive"] == "かかされる"


def test_aru_and_honorific() -> None:
    f = forms("V1", "あります")
    assert f["nai"] == "ない" and f["nakatta"] == "なかった" and "potential" not in f
    g = forms("V1", "いらっしゃいます")
    assert g["dict"] == "いらっしゃる" and g["te"] == "いらっしゃって" and g["imperative"] == "いらっしゃい"
    assert g["nai"] == "いらっしゃらない" and "passive" not in g


def test_v2_v3() -> None:
    assert forms("V2", "みます", "見ます")["potential"] == "{見|み}られる"
    assert forms("V2", "くれます")["imperative"] == "くれ"
    s = forms("V3", "べんきょうします", "勉強します")
    assert s["potential"] == "{勉強|べんきょう}できる" and s["dict"] == "{勉強|べんきょう}する"
    k = forms("V3", "もってきます", "持って来ます")
    assert k["nai"] == "{持|も}って{来|こ}ない" and k["dict"] == "{持|も}って{来|く}る"
    assert "potential" not in forms("V2", "できます")


def test_dictionary_form_input_n3() -> None:
    # さます (冷ます) là thể từ điển, không phải thể ます
    f = forms("V1", "さます", "冷ます", dictionary_form=True)
    assert f["masu"] == "{冷|さ}まします" and f["nai"] == "{冷|さ}まさない"
    assert forms("V3", "しょうりゃくする", "省略する", dictionary_form=True)["masu"] == "{省略|しょうりゃく}します"
    assert forms("V2", "たおれる", "倒れる", dictionary_form=True)["te"] == "{倒|たお}れて"
    with pytest.raises(ValueError):
        forms("V1", "かく")  # Minna phải ở thể ます


def test_adjectives_and_noun() -> None:
    a = forms("Ai", "おおきい", "大きい")
    assert a["neg"] == "{大|おお}きくない" and a["ba"] == "{大|おお}きければ"
    ii = forms("Ai", "きぶんがいい", "気分がいい")
    assert ii["past"] == "{気分|きぶん}がよかった" and ii["plain"] == "{気分|きぶん}がいい"
    assert forms("Ai", "かわいい")["neg"] == "かわいくない"  # không phải いい
    na = forms("An", "せっきょくてきな", "積極的な")
    assert na["attributive"] == "{積極的|せっきょくてき}な" and na["da"] == "{積極的|せっきょくてき}だ"
    assert forms("N", "がくせい", "学生")["attributive"] == "{学生|がくせい}の"
    with pytest.raises(ValueError):
        forms("Ai", "おおぜい", "大勢")


def test_first_kanji_and_ruby() -> None:
    assert first_kanji("速い, 早い") == "速い" and first_kanji("治ります、直ります") == "治ります"
    assert to_ruby("書きます", "よみます") is None
