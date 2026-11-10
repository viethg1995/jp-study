import pytest

from jp_pipeline.transform.examples import (
    RubyError,
    check_example,
    parse_ruby,
    reading_of,
    surface,
    vocab_readings,
    word_forms,
)


def test_parse_ruby_basic() -> None:
    segs = parse_ruby("[[{私|わたし}]]は{学生|がくせい}です。")
    assert surface(segs) == "私は学生です。"
    assert reading_of(segs) == "わたしはがくせいです。"
    assert [s.target for s in segs] == [True, False, False, False]


@pytest.mark.parametrize(
    "bad",
    [
        "{私|わたし}は学生です。",  # kanji ngoài ruby + thiếu [[ ]]
        "[[{私|わたし}]]は[[{学生|がくせい}]]です。",  # 2 target
        "[[{私|わたし}は{学生|がくせい}です。",  # thiếu ]]
        "[[{私|わたし}]]は学生です。",  # 学生 không có furigana
        "[[{私|私}]]です。",  # furigana chứa kanji
    ],
)
def test_parse_ruby_errors(bad: str) -> None:
    with pytest.raises(RubyError):
        parse_ruby(bad)


def test_word_forms_verbs() -> None:
    assert {"起きます", "起きる", "おきる"} <= word_forms("おきます", "起きます", "V2")
    assert {"行く", "いく"} <= word_forms("いきます", "行きます", "V1")
    assert {"勉強", "勉強する", "べんきょう"} <= word_forms("べんきょうします", "勉強します", "V3")
    assert {"来る", "くる"} <= word_forms("きます", "来ます", "V3")
    assert "さん" in word_forms("～さん", None, "Suf")


def test_check_example_ok_and_target_conjugated() -> None:
    known = word_forms("わたし", "私", "Pro") | word_forms("がくせい", "学生", "N")
    rd = vocab_readings([("わたし", "私"), ("がくせい", "学生")])
    assert check_example("[[{私|わたし}]]は{学生|がくせい}です。", word_forms("わたし", "私", "Pro"), known, rd) == []
    known |= word_forms("あさ", "朝", "N")
    issues = check_example("{朝|あさ}[[{起|お}きて]]ください。", word_forms("おきます", "起きます", "V2"), known)
    assert not [i for i in issues if i.level == "E"]


def test_check_example_flags_wrong_target_reading_and_unknown() -> None:
    known = word_forms("わたし", "私", "Pro")
    issues = check_example("[[{私|わたし}]]は{医者|いしや}です。", word_forms("わたし", "私", "Pro"), known)
    msgs = " ".join(i.msg for i in issues)
    assert "furigana" in msgs  # いしや ≠ いしゃ
    assert "医者" in msgs  # ngoài phạm vi
    issues = check_example("[[{学生|がくせい}]]です。", word_forms("わたし", "私", "Pro"), known)
    assert any(i.level == "E" for i in issues)


def test_check_example_ignores_names_split_words_and_compounds() -> None:
    known = (
        word_forms("あのひと", "あの人", "Pro") | word_forms("がくせい", "学生", "N")
        | word_forms("～じん", "～人", "Suf") | word_forms("～さん", None, "Suf")
    )
    tf = word_forms("がくせい", "学生", "N")
    assert check_example("あの{人|ひと}は[[{学生|がくせい}]]です。", tf, known) == []
    assert check_example("ワットさんはイギリス{人|じん}の[[{学生|がくせい}]]です。", tf, known) == []
    assert check_example("ＩＭＣの[[{学生|がくせい}]]です。", tf, known) == []


def test_target_must_use_kanji_when_available() -> None:
    tf = word_forms("わたし", "私", "Pro")
    issues = check_example("[[わたし]]です。", tf, tf, target_kanji="私")
    assert any(i.level == "E" and "kanji" in i.msg for i in issues)
    assert not [i for i in check_example("[[{私|わたし}]]です。", tf, tf, target_kanji="私") if i.level == "E"]
    assert not [i for i in check_example("[[さん]]です。", {"さん"}, {"さん"}, target_kanji=None) if i.level == "E"]


def test_non_target_words_must_use_kanji() -> None:
    from jp_pipeline.transform.examples import kana_to_kanji_map

    k2k = kana_to_kanji_map([("わたし", "私", "Pro"), ("がくせい", "学生", "N"), ("おきます", "起きます", "V2")])
    known = word_forms("わたし", "私", "Pro") | word_forms("がくせい", "学生", "N")
    tf = word_forms("がくせい", "学生", "N")
    issues = check_example("わたしは[[{学生|がくせい}]]です。", tf, known, kana_to_kanji=k2k, target_kanji="学生")
    assert any(i.level == "E" and "わたし→私" in i.msg for i in issues)
    ok = check_example("{私|わたし}は[[{学生|がくせい}]]です。", tf, known, kana_to_kanji=k2k, target_kanji="学生")
    assert not [i for i in ok if i.level == "E"]


def test_grammar_exceptions_do_not_require_kanji() -> None:
    from jp_pipeline.transform.examples import kana_to_kanji_map

    k2k = kana_to_kanji_map([
        ("いいます", "言います", "V1"), ("ところ", "所", "N"), ("はい", "杯", "Cnt"), ("もうします", "申します", "V3"),
    ])
    known = word_forms("ほん", "本", "N") | word_forms("たべます", "食べます", "V2")
    tf = word_forms("ほん", "本", "N")
    for ruby in (
        "「{本|ほん}」という[[{本|ほん}]]です。",  # という
        "[[{本|ほん}]]を{食|た}べたところです。",  # V たところです
        "はい、[[{本|ほん}]]です。",  # はい (thán từ) ≠ 杯
        "もう[[{本|ほん}]]です。",  # もう (phó từ) ≠ 申
    ):
        errs = [i for i in check_example(ruby, tf, known, kana_to_kanji=k2k) if i.level == "E"]
        assert errs == [], (ruby, errs)


def test_slot_pattern_match() -> None:
    from jp_pipeline.transform.examples import slot_pattern_match

    assert slot_pattern_match("こちらは～さんです", "こちらはミラーさんです", "こちらはみらーさんです")
    assert slot_pattern_match("～からきました", "から来ました", "からきました")
    assert not slot_pattern_match("こちらは～さんです", "あちらです", "あちらです")
    assert not slot_pattern_match("わたし", "わたし", "わたし")
