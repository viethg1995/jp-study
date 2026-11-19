import pytest

from jp_pipeline.transform.conjugation import conjugate, first_kanji, identity_kanji, to_ruby


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


def test_identity_kanji_for_merging() -> None:
    # cùng từ (Minna thể ます ↔ N3 thể từ điển, tính từ な có/không な) → cùng chữ → được gộp
    assert identity_kanji("起きます") == identity_kanji("起きる") == "起"
    assert identity_kanji("大変") == identity_kanji("大変な") == "大変"
    assert identity_kanji("間に合います") == identity_kanji("間に合う") == "間合"
    assert identity_kanji("治ります、直ります") == identity_kanji("治る")
    # từ khác chữ / một bên chỉ có kana → khác khóa, không gộp
    assert identity_kanji("点けます") != identity_kanji("付けます")
    assert identity_kanji(None) is None and identity_kanji("掛けます") == "掛"

# ── build_conjugation trên dữ liệu thật (Q13, plan/quiz/q13-conj-n3-rows.md) ─────────────────────────
def _real_build():  # type: ignore[no-untyped-def]
    import json

    from jp_pipeline import paths
    from jp_pipeline.schemas import VocabLesson
    from jp_pipeline.transform.conjugation import build_conjugation

    def lessons(d):  # type: ignore[no-untyped-def]
        return [e for f in sorted(d.glob("lesson-*.json"))
                for e in VocabLesson.model_validate(json.loads(f.read_text(encoding="utf-8"))).entries]

    vocab = lessons(paths.OUT_VOCABULARY) + lessons(paths.OUT_VOCAB_N3)  # Minna trước N3 như cli
    spec = json.loads((paths.ENRICH_CONJ / "forms.json").read_text(encoding="utf-8"))
    doc, _ = build_conjugation(vocab, spec)
    return doc


def test_n3_duplicate_of_minna_gets_own_row() -> None:
    doc = _real_build()
    by_id = {e.vocab_id: e for e in doc.entries}
    n3 = by_id["n3-101"]  # 倒れる — trùng mn-39-002 倒れます
    mn = by_id["mn-39-002"]
    assert (n3.book, n3.same_as) == ("n3", "mn-39-002")
    assert 1 <= n3.lesson <= 14
    assert [(f.form, f.kana) for f in n3.forms] == [(f.form, f.kana) for f in mn.forms]  # cùng gốc → cùng bảng chia
    assert "n3-101" not in mn.aliases
    assert mn.same_as is None


def test_alias_only_within_same_book_and_examples_resolve_to_minna() -> None:
    doc = _real_build()
    by_id = {e.vocab_id: e for e in doc.entries}
    for e in doc.entries:
        assert all(a[:2] == e.vocab_id[:2] for a in e.aliases), (e.vocab_id, e.aliases)  # mn ↔ mn, n3 ↔ n3
        if e.same_as:
            assert e.book == "n3" and by_id[e.same_as].book == "minna"
    assert any("mn-11-004" in e.aliases for e in doc.entries)  # 休みます bài 11 vẫn là alias của bài 4 (cùng sách)
    examples = {x for f in doc.forms for r in f.rules for x in r.examples}
    assert all(by_id[x].same_as is None for x in examples)  # ví dụ quy tắc giải về hàng Minna
    assert sum(1 for e in doc.entries if e.same_as) == 63  # 68 trước khi khóa gộp có identity_kanji
