import pytest

from jp_pipeline.extract.layout import Span
from jp_pipeline.transform.n3_build import derive_han_viet, guess_pos, parse_fixes
from jp_pipeline.transform.n3_kanji import _kun_list
from jp_pipeline.transform.n3_vocab import _reading, parse_lesson
from jp_pipeline.transform.vocab_auto import normalize_han_viet


def sp(x0: float, y0: float, size: float, text: str, bold: bool = False, x1: float | None = None) -> Span:
    return Span(page=1, x0=x0, y0=y0, x1=x1 if x1 is not None else x0 + 22 * len(text) * size / 22,
                y1=y0 + size, size=size, bold=bold, text=text)


def test_reading_inner_kana_alignment() -> None:
    head = [sp(100, 300, 22, "思い出", x1=166)]  # 3 ký tự, mỗi ký tự ~22px
    ruby = [sp(100, 288, 11, "おも", x1=122), sp(144, 288, 11, "で", x1=166)]
    assert _reading(head, ruby) == ("おもいで", [])


def test_reading_okurigana_separate_span() -> None:
    head = [sp(124, 300, 22, "足", x1=146), sp(146, 300, 22, "りる", x1=187)]
    ruby = [sp(130, 288, 11, "た", x1=140)]
    assert _reading(head, ruby)[0] == "たりる"


def _card(no: str, y: float) -> list[Span]:
    return [sp(80, y, 11, no, bold=True, x1=100)]


def test_parse_single_and_pair_card() -> None:
    spans = [
        *_card("01", 100), sp(121, 117, 11, "こうれい", x1=165), sp(121, 128, 22, "高齢", x1=165),
        sp(275, 110, 14, "Già, cao tuổi", bold=True, x1=360),
        sp(275, 132, 11, "・", x1=286), sp(293, 132, 11, "祖母は高齢だがまだとても元気だ。", x1=455),
        sp(275, 150, 11, "・", x1=286), sp(293, 150, 11, "対：若い", x1=330),
        *_card("36 – 37", 300), sp(94, 358, 11, "せいこう", x1=137), sp(149, 358, 11, "しっぱい", x1=192),
        sp(93, 370, 22, "成功", x1=137), sp(137, 370, 22, "・失敗", x1=192),
        sp(275, 359, 14, "Thành công/ Thất bại", bold=True, x1=413),
    ]
    out = parse_lesson(spans, lesson=1)
    assert [(e.no, e.word, e.reading) for e in out] == [(1, "高齢", "こうれい"), (36, "成功", "せいこう"), (37, "失敗", "しっぱい")]
    assert out[0].items[0].kind == "example" and out[0].items[1].kind == "antonym" and out[0].items[1].text == "若い"
    assert out[1].meaning_vi == ["Thành công"] and out[2].meaning_vi == ["Thất bại"]


def test_parse_variants_and_particle_alternatives() -> None:
    spans = [
        *_card("126", 100), sp(121, 117, 11, "お", x1=133), sp(121, 128, 22, "降りる/", x1=200),
        sp(121, 160, 11, "お", x1=133), sp(121, 171, 22, "下りる", x1=187),
        sp(275, 110, 14, "Xuống xe", bold=True, x1=340),
        *_card("335", 300), sp(144, 330, 11, "か", x1=155), sp(85, 341, 22, "が/を変", x1=160), sp(161, 341, 22, "わる", x1=207),
        sp(275, 310, 14, "Thay đổi", bold=True, x1=340),
    ]
    out = parse_lesson(spans, lesson=3)
    assert out[0].word == "降りる" and out[0].variants == ["下りる"] and out[0].reading == "おりる"
    assert out[1].word == "変わる" and out[1].particle == "が/を" and out[1].reading == "かわる"


def test_kun_list() -> None:
    assert _kun_list(["まか・せる"]) == ["まか.せる"]
    assert _kun_list(["の・びる", "・ばす"]) == ["の.びる", "の.ばす"]
    assert _kun_list(["なか"]) == ["なか"]


def test_parse_fixes() -> None:
    by, fx = parse_fixes("# by: ai\n049|reading|おもいで|note\n")
    assert by == "ai" and fx[0].no == 49 and fx[0].field == "reading"
    with pytest.raises(ValueError):
        parse_fixes("049|reading|x")
    with pytest.raises(ValueError):
        parse_fixes("# by: ai\n049|bogus|x")


def test_guess_pos_and_han_viet() -> None:
    assert guess_pos("変更する") == "V3"
    assert guess_pos("データを集める") == "Phr"
    assert derive_han_viet("高齢", {"高": ("CAO", "minna"), "齢": ("LINH", "n3book")}) == ("CAO LINH", "derived")
    assert derive_han_viet("高齢", {"高": ("CAO", "minna"), "齢": ("LINH", "unihan")}) == ("CAO LINH", "mixed")
    assert derive_han_viet("高齢", {"高": ("CAO", "minna")}) == (None, None)


def test_clean_meaning() -> None:
    from jp_pipeline.transform.n3_build import clean_meaning

    assert clean_meaning("～ Biết ơn", "感謝") == "Biết ơn"
    assert clean_meaning("A B ( ～ Biên dịch", "翻訳") == "Biên dịch"
    assert clean_meaning("Trao đổi; vs; Đổi", "交換") == "Trao đổi; Đổi"
    assert clean_meaning("Đồng phục; しふく", "制服") == "Đồng phục"
    assert clean_meaning("1. Nhét; 2 Rút ngắn", "つめる") == "Nhét; Rút ngắn"
    assert clean_meaning("～ tuổi", "～歳") == "～ tuổi"  # từ là mẫu có ～ → giữ


def test_parse_examples() -> None:
    from jp_pipeline.transform.n3_build import parse_examples

    text = "# by: user\n001|{祖母|そぼ}は[[{高齢|こうれい}]]です。|Bà tôi cao tuổi.\n"
    ex = parse_examples([("lesson-01.txt", text)])
    assert ex[1] == [("{祖母|そぼ}は[[{高齢|こうれい}]]です。", "Bà tôi cao tuổi.", "user")]
    with pytest.raises(ValueError):
        parse_examples([("x.txt", "001|a|b")])


def test_old_style_tone_normalization() -> None:
    assert normalize_han_viet("HOÀ") == "HÒA"
    assert normalize_han_viet("TOẠ") == "TỌA"
    assert normalize_han_viet("THUỶ") == "THỦY"
    assert normalize_han_viet("QUÁ") == "QUÁ"
    assert normalize_han_viet("HOÀNG") == "HOÀNG"


def test_cross_link_books() -> None:
    from jp_pipeline.schemas import PartOfSpeech, VocabEntry, VocabProvenance
    from jp_pipeline.transform.vocab_build import cross_link_books

    def v(vid: str, kana: str, kanji: str | None, book: str) -> VocabEntry:
        return VocabEntry(
            id=vid, legacy_id="x", book=book, lesson=1, kana=kana, kanji=kanji, display="kanji", han_viet=None,  # type: ignore[arg-type]
            meaning_vi="x", senses=[], pos=PartOfSpeech.of("N"), kanji_refs=[], same_word=[],
            provenance=VocabProvenance(kanji=None, han_viet=None, pos="source", meaning="source"), review="auto",
        )

    a, b = cross_link_books([v("mn-01-001", "しゅみ", "趣味", "minna")], [v("n3-047", "しゅみ", "趣味", "n3"), v("n3-048", "きょうみ", "興味", "n3")])
    assert a[0].same_word == ["n3-047"] and b[0].same_word == ["mn-01-001"] and b[1].same_word == []
