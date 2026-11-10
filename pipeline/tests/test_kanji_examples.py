from jp_pipeline.dictionaries import KanjiInfo
from jp_pipeline.transform.kanji_examples import classify, parse_example_translations


def ki(c: str, on: list[str], kun: list[str]) -> KanjiInfo:
    return KanjiInfo(char=c, on=on, kun=kun, meanings_en=[], strokes=None, grade=None, jlpt_old=None, radical=None)


KD = {
    "学": ki("学", ["ガク"], ["まな.ぶ"]),
    "生": ki("生", ["セイ", "ショウ"], ["い.きる", "う.まれる"]),
    "日": ki("日", ["ニチ", "ジツ"], ["ひ", "-び"]),
    "記": ki("記", ["キ"], ["しる.す"]),
    "曜": ki("曜", ["ヨウ"], []),
    "今": ki("今", ["コン", "キン"], ["いま"]),
}


def test_on_kun_and_sound_changes() -> None:
    assert classify("学生", "がくせい", "生", KD) == ("on", "せい")
    assert classify("生まれる", "うまれる", "生", KD) == ("kun", "う")
    assert classify("日記", "にっき", "日", KD) == ("on", "にっ")  # 促音
    assert classify("曜日", "ようび", "日", KD) == ("kun", "び")


def test_jukujikun_is_unclassified() -> None:
    assert classify("今日", "きょう", "日", KD) == (None, None)


def test_parse_translations_by_header() -> None:
    tr = parse_example_translations([("01.txt", "# by: ai\n学生|がくせい|học sinh\n"), ("02.txt", "# by: user\n学生|がくせい|sinh viên\n")])
    assert tr[("学生", "がくせい")] == ("sinh viên", "user")
