from jp_pipeline.dictionaries import JmEntry
from jp_pipeline.extract.layout import Span
from jp_pipeline.transform.kanji_book_words import ebook_segments, format_pinned, kun_bare, words_in


def e(kanji: str, common_reading: bool = True) -> JmEntry:
    return JmEntry(seq=1, kanji=[kanji], common_kanji=[kanji] if common_reading else [], common=common_reading,
                   common_reading=common_reading, uk=False, pos=["noun"], gloss=["x"])


def test_words_in_longest_and_readings() -> None:
    cands = [("家事", "かじ", e("家事")), ("家家", "いえいえ", e("家家", False)), ("家", "いえ", e("家")),
             ("家", "うち", e("家")), ("指示", "しじ", e("指示")), ("指示す", "さししめす", e("指示す", False))]
    assert words_in("家", "家家事", cands, {"いえ", "うち"}) == [("家事", "かじ")]  # chồng lấn → từ thông dụng
    # từ một chữ có 2 cách đọc Kun thông dụng → không biết sách dùng cách nào → bỏ
    assert words_in("家", "家", cands, {"いえ", "うち"}) == []
    assert words_in("指", "部下に指示する", cands, set()) == [("指示", "しじ")]  # không phải 指示す


def test_single_char_needs_bare_common_kun() -> None:
    cands = [("兄", "あに", e("兄")), ("兄", "けい", e("兄")), ("案", "つくえ", e("机"))]
    assert words_in("兄", "兄", cands, {"あに"}) == [("兄", "あに")]
    assert words_in("案", "案", [("案", "つくえ", JmEntry(seq=2, kanji=["机", "案"], common_kanji=["机"], common=True,
                                                          common_reading=True, uk=False, pos=[], gloss=[]))],
                    {"つくえ"}) == []
    assert kun_bare(["あに", "かか.り", "-がかり", "うわ-"]) == {"あに", "かかり"}


def test_ebook_segments_and_format() -> None:
    def s(page: int, x0: float, y0: float, text: str, size: float = 14) -> Span:
        return Span(page=page, x0=x0, y0=y0, x1=x0 + 14 * len(text), y1=y0 + 14, size=size, bold=False, text=text)

    spans = [s(1, 0, 0, "第１課", 12), s(1, 10, 50, "家"), s(1, 24, 50, "事"), s(1, 100, 50, "大"), s(1, 114, 50, "家"),
             s(1, 10, 80, "うちの 夫は", 13), s(2, 10, 50, "兄")]
    assert ebook_segments(spans) == {1: ["家事", "大家", "兄"]}
    assert format_pinned([("家", "家事", "かじ"), ("家", "家事", "かじ")], "h") == "# by: ai\n# h\n家|家事|かじ\n"
