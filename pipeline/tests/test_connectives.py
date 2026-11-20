"""Từ nối: mục ngữ pháp từ md, câu ví dụ (nguồn vocab / grammar / ai), substitutes đối xứng, [[…]] đúng từ nối."""

from typing import Any

import pytest

from jp_pipeline.extract.grammar_md import grammar_sections, parse_grammar_md
from jp_pipeline.schemas import VocabEntry
from jp_pipeline.transform.connectives import build_connectives, matches_source, parse_examples

MD = """# Ngữ pháp bài 45

## Nội dung

1. のに、～

## 2. のに、～

❖ Ý nghĩa: thế mà, vậy mà

### Ví dụ

やくそく かのじょ き
約束を したのに、 彼女は 来ませんでした。
Đã có hẹn rồi thế mà cô ấy không đến.
まっすぐいって、みぎへまがると、ひだり
に びょういんが あります。
"""


def test_parse_grammar_md_skips_furigana_and_vietnamese() -> None:
    [sec] = parse_grammar_md("bai45.md", MD)
    assert sec.id == "g-45-2" and sec.title == "のに、～"
    assert "約束をしたのに、彼女は来ませんでした。" in sec.ja_text
    assert "やくそくかのじょき" not in sec.ja_text  # dòng furigana cách quãng
    assert "Đã" not in sec.ja_text
    # câu xuống dòng giữa chừng vẫn nối liền
    assert "ひだりにびょういんがあります" in sec.ja_text
    with pytest.raises(ValueError):
        parse_grammar_md("lesson45.md", MD)


def test_matches_source_text_or_reading() -> None:
    src = grammar_sections([("bai45.md", MD)])["g-45-2"].ja_text
    assert matches_source("{約束|やくそく}をした[[のに]]、{彼女|かのじょ}は{来|き}ませんでした。", src)
    # nguồn viết kana: ruby khớp theo cách đọc
    assert matches_source("まっすぐ{行|い}って、{右|みぎ}へ{曲|ま}がる[[と]]、{左|ひだり}に{病院|びょういん}があります。", src)
    # đổi chữ → không khớp
    assert not matches_source("{約束|やくそく}をした[[のに]]、{彼|かれ}は{来|き}ませんでした。", src)


def test_parse_examples_formats() -> None:
    xs = parse_examples(
        "# chú thích\n"
        "cn-a-e01|vocab:mn-01-001-e1||\n"
        "cn-a-e02|grammar:g-45-2|{約束|やくそく}をした[[のに]]。|Đã hẹn thế mà.\n"
        "cn-a-e03|ai|[[でも]]、{行|い}きます。|Nhưng vẫn đi.\n"
    )
    assert [(x.source, x.ref) for x in xs] == [("vocab", "mn-01-001-e1"), ("grammar", "g-45-2"), ("ai", None)]
    assert xs[1].ruby == "{約束|やくそく}をした[[のに]]。" and xs[1].vi == "Đã hẹn thế mà."
    for bad in ("cn-a-e01|vocab||", "cn-a-e01|vocab:x|{a|b}[[c]]|vi", "cn-a-e01|web|[[c]]|vi", "cn-a-e01|ai|[[c]]|"):
        with pytest.raises(ValueError):
            parse_examples(bad)


def _spec(cid: str, forms: list[str], subs: list[str] | None = None, gram: list[str] | None = None) -> dict[str, Any]:
    return {
        "id": cid, "text": forms[0], "ruby": forms[0], "kana": forms[0], "type": "clause", "function": "contrast",
        "meaning_vi": "nghĩa", "connects_vi": "V + x", "level": "n4", "book": "minna", "lesson": 45, "forms": forms,
        "vocab_refs": [], "grammar_refs": gram or [], "note_vi": None, "substitutes": subs or [],
        "meaning_source": "ai-draft", "review": "auto",
    }


def _ex(cid: str, n: int, ruby: str, src: str = "ai") -> str:
    return f"{cid}-e{n:02d}|{src}|{ruby}|dịch"


def test_build_ok_and_errors() -> None:
    sections = grammar_sections([("bai45.md", MD)])
    noni = [_ex("cn-noni", 1, "{約束|やくそく}をした[[のに]]、{彼女|かのじょ}は{来|き}ませんでした。", "grammar:g-45-2"),
            _ex("cn-noni", 2, "{高|たか}い[[のに]]、{買|か}った。"), _ex("cn-noni", 3, "{雨|あめ}な[[のに]]{行|い}く。")]
    kedo = [_ex("cn-kedo", i, f"{n}[[けど]]、いい。") for i, n in enumerate(["{高|たか}い", "{遠|とお}い", "{古|ふる}い"], 1)]
    spec = [_spec("cn-noni", ["のに"], ["cn-kedo"], ["g-45-2"]), _spec("cn-kedo", ["けど"], ["cn-noni"])]
    doc, rep = build_connectives(spec, parse_examples("\n".join(noni + kedo)), [], sections)
    assert rep.errors == []
    assert [c.id for c in doc.connectives] == ["cn-noni", "cn-kedo"]
    assert doc.connectives[0].examples[0].source == "grammar" and doc.connectives[0].examples[1].source == "ai-draft"
    assert {f.id for f in doc.functions} >= {"contrast", "cause", "condition"}

    # substitutes một chiều, [[…]] sai từ, câu grammar không khớp nguồn, câu của từ nối không tồn tại
    bad_spec = [_spec("cn-noni", ["のに"], ["cn-kedo"], ["g-45-2"]), _spec("cn-kedo", ["けど"])]
    bad = noni[1:] + [_ex("cn-noni", 4, "{彼|かれ}をした[[のに]]。", "grammar:g-45-2"), _ex("cn-noni", 5, "{高|たか}い[[けど]]。"),
                      _ex("cn-zzz", 1, "[[けど]]。")] + kedo
    _, rep = build_connectives(bad_spec, parse_examples("\n".join(bad)), [], sections)
    msgs = "\n".join(rep.errors)
    assert "không đối xứng" in msgs
    assert "cn-noni-e04: câu không khớp nguồn g-45-2" in msgs
    assert "cn-noni-e05: [[けど]] không thuộc forms" in msgs
    assert "cn-zzz-e01: không có từ nối cn-zzz" in msgs


def test_vocab_example_pulled() -> None:
    entry = VocabEntry.model_validate({
        "id": "mn-08-046", "legacy_id": "lesson8_46", "book": "minna", "lesson": 8, "kana": "そして", "kanji": None,
        "display": "kana", "han_viet": None, "meaning_vi": "và", "senses": [{"text": "và", "context": None}],
        "pos": {"code": "Conj", "label": "Từ nối"}, "kanji_refs": [], "same_word": [], "particle": None, "transitivity": None,
        "variants": [], "antonyms": [], "related": [],
        "examples": [{"id": "mn-08-046-e1", "ruby": "{京都|きょうと}は{静|しず}かです。[[そして]]、{綺麗|きれい}です。",
                      "vi": "Kyoto yên tĩnh. Và đẹp.", "max_lesson": 8, "source": "ai-draft", "review": "user"}],
        "provenance": {"kanji": None, "han_viet": None, "pos": "source", "meaning": "source"}, "review": "user",
    })
    spec = [{**_spec("cn-soshite", ["そして"]), "type": "sentence", "connects_vi": None, "vocab_refs": ["mn-08-046"]}]
    exs = ["cn-soshite-e01|vocab:mn-08-046-e1||", _ex("cn-soshite", 2, "[[そして]]、{行|い}く。"), _ex("cn-soshite", 3, "[[そして]]、{帰|かえ}る。")]
    doc, rep = build_connectives(spec, parse_examples("\n".join(exs)), [entry], {})
    assert rep.errors == []
    e1 = doc.connectives[0].examples[0]
    assert (e1.source, e1.ref, e1.review) == ("vocab", "mn-08-046-e1", "user") and "[[そして]]" in e1.ruby
