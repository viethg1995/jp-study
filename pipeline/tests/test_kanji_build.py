import pytest

from jp_pipeline.dictionaries import KanjiInfo
from jp_pipeline.schemas import KanjiEntry, PartOfSpeech, VocabEntry, VocabProvenance
from jp_pipeline.transform.kanji_build import (
    build_kanji,
    char_readings_from_vocab,
    parse_radicals,
    radical_strokes,
)


def _md(rows: dict[int, str]) -> str:
    lines = ["|Số nét|STT|Bộ|Tên bộ|Nghĩa|", "|---|---|---|---|---|"]
    for n in range(1, 215):
        lines.append(rows.get(n, f"||{n}|字{n}|Tên{n}|Nghĩa{n}|"))
    return "\n".join(lines)


def test_radical_strokes_ranges() -> None:
    assert radical_strokes(1) == 1
    assert radical_strokes(9) == 2
    assert radical_strokes(85) == 4
    assert radical_strokes(214) == 17
    with pytest.raises(ValueError):
        radical_strokes(215)


def test_parse_radicals_variants_and_empty_meaning() -> None:
    md = _md({
        9: "|**2 nét**|9|人|Nhân|Người|",
        212: "||212|龍,龙|Long|Con rồng|",
        214: "||214|龠|Dược||",
    })
    rads = parse_radicals(md)
    assert len(rads) == 214
    assert rads[8].char == "人" and rads[8].strokes == 2
    assert rads[211].char == "龍" and rads[211].variants == ["龙"]
    assert rads[213].meaning_vi is None


def test_parse_radicals_missing_fails() -> None:
    md = "\n".join(f"||{n}|字|Tên|Nghĩa|" for n in range(1, 214))
    with pytest.raises(ValueError, match="thiếu"):
        parse_radicals(md)


def _v(vid: str, lesson: int, kanji: str | None, hv: str | None, refs: list[str]) -> VocabEntry:
    return VocabEntry(
        id=vid, legacy_id="x", lesson=lesson, kana="か", kanji=kanji, display="kanji",
        han_viet=hv, meaning_vi="nghĩa", senses=[], pos=PartOfSpeech.of("N"),
        kanji_refs=[f"k-{c}" for c in refs], same_word=[],
        provenance=VocabProvenance(kanji="source", han_viet="source", pos="source", meaning="source"), review="user",
    )


def test_char_readings_aligned_only() -> None:
    entries = [
        _v("mn-01-001", 1, "会社員", "HỘI XÃ VIÊN", ["会", "社", "員"]),
        _v("mn-01-002", 1, "会議", "HỘI", ["会", "議"]),  # lệch số âm → bỏ
    ]
    r = char_readings_from_vocab(entries)
    assert r["会"]["HỘI"] == 1 and "議" not in r


def test_build_kanji_sources_and_refs() -> None:
    entries = [
        _v("mn-03-001", 3, "会社", "HỘI XÃ", ["会", "社"]),
        _v("mn-01-001", 1, "会", "HỘI", ["会"]),
        _v("mn-05-001", 5, "込む", None, ["込"]),
        _v("mn-04-001", 4, "鞄", None, ["鞄"]),
    ]
    kd = {"会": KanjiInfo(char="会", on=["カイ"], kun=["あ.う"], meanings_en=["meet"],
                          strokes=6, grade=2, jlpt_old=4, radical=9)}
    unihan = {"鞄": ["bào"]}
    out, rep = build_kanji(entries, kd, unihan)
    by = {k.char: k for k in out}
    assert out[0].char == "会"  # sắp theo bài đầu tiên
    assert by["会"].first_lesson == 1 and by["会"].vocab_refs == ["mn-01-001", "mn-03-001"]
    assert by["会"].han_viet_source == "vocab" and by["会"].strokes == 6
    assert by["鞄"].han_viet == ["BÀO"] and by["鞄"].han_viet_source == "unihan"
    assert by["込"].han_viet == [] and by["込"].meaning_vi is None
    assert rep.no_han_viet == ["込"] and set(rep.not_in_kanjidic) == {"社", "込", "鞄"}


def test_kanji_id_validated() -> None:
    with pytest.raises(ValueError):
        KanjiEntry(id="k-会社", char="会", han_viet=[], han_viet_source=None, meaning_vi=None, meaning_vi_source=None,
                   meanings_en=[], on=[], kun=[], strokes=None, grade=None, jlpt_old=None,
                   radical=None, first_lesson=1, vocab_refs=[])


def test_parse_meanings_order_and_source() -> None:
    from jp_pipeline.transform.kanji_build import parse_meanings

    m = parse_meanings([
        ("01-ai.txt", "# by: ai\n# chú thích\n人|người\n日|ngày\n"),
        ("02-user.txt", "# by: user\n日|ngày, mặt trời\n"),
    ])
    assert m["人"] == ("người", "ai-draft")
    assert m["日"] == ("ngày, mặt trời", "user")


@pytest.mark.parametrize("text", ["人|người\n", "# by: ai\n人|người\n人|người\n", "# by: ai\n人người\n"])
def test_parse_meanings_errors(text: str) -> None:
    from jp_pipeline.transform.kanji_build import parse_meanings

    with pytest.raises(ValueError):
        parse_meanings([("x.txt", text)])


def test_normalize_han_viet_iy() -> None:
    from jp_pipeline.transform.vocab_auto import normalize_han_viet

    assert normalize_han_viet("ĐỊA LÍ") == "ĐỊA LÝ"
    assert normalize_han_viet("MĨ THUẬT") == "MỸ THUẬT"
    assert normalize_han_viet("KÌ") == "KỲ"
    assert normalize_han_viet("BÁC SĨ") == "BÁC SĨ"
    assert normalize_han_viet("TỊ") == "TỊ"
    assert normalize_han_viet(None) is None


def test_char_readings_slash_alternatives_single_char() -> None:
    entries = [
        _v("mn-09-003", 9, "好き", "HIẾU/HẢO", ["好"]),
        _v("mn-09-004", 9, "会社", "HỘI/XÃ", ["会", "社"]),  # nhiều chữ + '/' → không tin
    ]
    r = char_readings_from_vocab(entries)
    assert set(r["好"]) == {"HIẾU", "HẢO"} and "会" not in r
