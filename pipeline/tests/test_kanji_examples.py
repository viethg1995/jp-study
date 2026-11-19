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


def test_kun_helpers() -> None:
    from jp_pipeline.transform.kanji_examples import _kun_okurigana, _okurigana, _unvoice

    assert _unvoice("づよ") == "つよ" and _unvoice("ばたら") == "はたら" and _unvoice("ぱ") == "は"
    assert _okurigana("代わる", "代") == "わる"
    assert _okurigana("身代わり", "代") is None and _okurigana("代", "代") is None and _okurigana("代表", "代") is None
    info = ki("代", ["ダイ"], ["か.わる", "かわ.る", "か.わり", "-が.わり", "か.える", "よ"])
    assert _kun_okurigana(info) == {"か": ["わる", "わり", "える"], "かわ": ["る"]}


def test_reading_groups() -> None:
    from jp_pipeline.transform.kanji_examples import ReadingGroups

    g = ReadingGroups(ki("生", ["セイ", "ショウ"], ["い.きる", "う.まれる", "うま.れる", "うまれ", "-う", "なま", "な.る"]))
    assert list(g.kun) == ["い", "う", "なま", "な"]
    assert g.kun["う"] == ["う.まれる", "うま.れる", "うまれ", "-う"]
    assert g.of("じょう", "on") == "しょう" and g.of("うま", "kun") == "う" and g.of("なま", "kun") == "なま"
    g2 = ReadingGroups(ki("行", ["コウ"], ["おこな.う", "おこ.なう", "-ゆ.き"]))
    assert list(g2.kun) == ["おこ", "ゆ"] and g2.of("おこな", "kun") == "おこ"
    g3 = ReadingGroups(ki("引", ["イン"], ["ひ.く"]))
    assert g3.of("ひっ", "kun") == "ひ"  # 促音: 引っ越す


def test_fill_missing_and_drop_unused_readings() -> None:
    from jp_pipeline.dictionaries import JmEntry
    from jp_pipeline.schemas import KanjiEntry
    from jp_pipeline.transform.kanji_examples import build_examples

    def jm(kanji: str, common: bool, reading_common: bool, pos: str = "noun") -> JmEntry:
        return JmEntry(seq=1, kanji=[kanji], common=common, common_reading=reading_common, uk=False,
                       pos=[pos], gloss=["x"])

    kd = {"行": ki("行", ["コウ", "ギョウ", "アン", "シャン"], ["い.く", "おこな.う", "たてまつ.る"]),
          "為": ki("為", ["イ"], []), "事": ki("事", ["ジ"], []), "列": ki("列", ["レツ"], []),
          "脚": ki("脚", ["キャク", "キャ"], []), "旅": ki("旅", ["リョ"], []), "銀": ki("銀", ["ギン"], [])}
    entry = KanjiEntry(id="k-行", char="行", han_viet=[], han_viet_source=None, meaning_vi=None, meaning_vi_source=None,
                       meanings_en=[], on=kd["行"].on, kun=kd["行"].kun, strokes=None, grade=None, jlpt_old=None,
                       radical=None, first_lesson=None, vocab_refs=[])
    dic = {
        "こうい": [jm("行為", True, True)], "ぎょうじ": [jm("行事", True, True)],
        "いく": [jm("行く", True, True, "Godan verb")], "おこなう": [jm("行う", True, True, "Godan verb")],
        "あんぎゃ": [jm("行脚", True, False)],  # cách đọc hiếm của từ thông dụng → không lấy làm ví dụ
        "ぎょうれつ": [jm("行列", True, True)],
        "りょこう": [jm("旅行", True, True)], "ぎんこう": [jm("銀行", True, True)],  # đủ 5 ví dụ trước bước (c)
    }
    (out,), rep = build_examples([entry], [], dic, kd, {})
    words = [x.word for x in out.examples]
    assert "行事" in words or "行列" in words  # ギョウ được phủ
    assert "行脚" not in words and "アン" in out.on  # âm hiếm: giữ âm, không có ví dụ
    assert rep.readings_without_example == {"行": ["あん"]}
    assert "シャン" not in out.on and "たてまつ.る" not in out.kun  # không có từ nào → bỏ
    assert rep.readings_removed == {"行": ["シャン", "たてまつ.る"]}

    # ví dụ ghim: luôn nối thêm (kể cả cách đọc không thông dụng); không có trong JMdict → lỗi
    (out2,), _ = build_examples([entry], [], dic, kd, {}, {"行": [("行脚", "あんぎゃ")]})
    assert out2.examples[-1].word == "行脚" or "行脚" in [x.word for x in out2.examples]
    import pytest
    with pytest.raises(ValueError, match="không có trong JMdict"):
        build_examples([entry], [], dic, kd, {}, {"行": [("行灯", "あんどん")]})


def test_parse_pinned_examples() -> None:
    import pytest
    from jp_pipeline.transform.kanji_examples import parse_pinned_examples

    assert parse_pinned_examples("# by: user\n待|待合|まちあい\n") == {"待": [("待合", "まちあい")]}
    with pytest.raises(ValueError):
        parse_pinned_examples("待|物置|ものおき\n")  # từ không chứa chữ
