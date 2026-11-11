"""Số đếm & trợ số từ: đọc số, quy tắc biến âm, kiểm câu ví dụ."""

import pytest

from jp_pipeline.schemas import Counter, CounterExample
from jp_pipeline.transform.counters import (
    CounterReport,
    candidates,
    check_counter,
    check_counter_example,
    check_number_example,
    number_kana,
    parse_examples,
    parse_ruby,
    question_candidates,
    reading_matches,
)


@pytest.mark.parametrize(("n", "kana"), [
    (4, "よん"), (40, "よんじゅう"), (105, "ひゃくご"), (300, "さんびゃく"), (600, "ろっぴゃく"),
    (800, "はっぴゃく"), (1000, "せん"), (3000, "さんぜん"), (8000, "はっせん"), (10000, "いちまん"),
    (12345, "いちまんにせんさんびゃくよんじゅうご"), (100000000, "いちおく"),
])
def test_number_kana(n: int, kana: str) -> None:
    assert number_kana(n) == kana


@pytest.mark.parametrize(("n", "kana", "group", "ok"), [
    (1, "ほん", "h", "いっぽん"), (3, "ほん", "h", "さんぼん"), (3, "ふん", "h", "さんぷん"),
    (4, "ふん", "h", "よんぷん"), (4, "ほん", "h", "よんほん"), (6, "ほん", "h", "ろっぽん"),
    (10, "ほん", "h", "じっぽん"), (20, "ほん", "h", "にじゅっぽん"), (100, "ほん", "h", "ひゃっぽん"),
    (1000, "ほん", "h", "せんぼん"), (3, "かい", "k", "さんがい"), (3, "かい", "k", "さんかい"),
    (6, "こ", "k", "ろっこ"), (6, "さつ", "s", "ろくさつ"), (8, "さい", "s", "はっさい"),
    (3, "そく", "s", "さんぞく"), (1, "ちゃく", "t", "いっちゃく"), (4, "まい", "none", "よんまい"),
])
def test_candidates_accept(n: int, kana: str, group: str, ok: str) -> None:
    assert ok in candidates(n, kana, group)


@pytest.mark.parametrize(("n", "kana", "group", "bad"), [
    (3, "ほん", "h", "さんほん"), (4, "ほん", "h", "よんぼん"), (100, "ほん", "h", "ひゃくほん"),
    (6, "さつ", "s", "ろっさつ"), (1, "まい", "none", "いっまい"), (4, "かい", "k", "よんがい"),
])
def test_candidates_reject(n: int, kana: str, group: str, bad: str) -> None:
    assert bad not in candidates(n, kana, group)


def test_question_candidates() -> None:
    assert "なんぼん" in question_candidates("ほん", "h")
    assert "なんがい" in question_candidates("かい", "k")
    assert question_candidates("つ", "native") == set()


def test_parse_ruby_errors() -> None:
    assert [s.text for s in parse_ruby("ペンを[[{3本|さんぼん}]]{買|か}いました。") if s.target] == ["3本"]
    with pytest.raises(ValueError):
        parse_ruby("ペンを[[{3本|さんぼん}]")


def _counter(readings: list[dict[str, object]], examples: list[CounterExample]) -> Counter:
    return Counter.model_validate({
        "id": "c-hon", "char": "本", "kana": "ほん", "name_vi": "x", "use_vi": "x", "items_vi": [],
        "category": "objects", "lesson": 40, "vocab_refs": [], "kanji_refs": ["k-本"], "sound_group": "h",
        "sound_note_vi": "x", "readings": readings, "question": {"kana": "なんぼん", "alt": [], "note": None},
        "large_vi": ["x"], "notes_vi": [], "examples": examples,
    })


def _ex(i: int, ruby: str) -> CounterExample:
    return CounterExample(id=f"c-hon-e{i:02d}", ruby=ruby, vi="x", source="ai-draft", review="auto")


READINGS = [{"n": n, "kana": k, "alt": [], "irregular": False, "note": None} for n, k in [
    (1, "いっぽん"), (2, "にほん"), (3, "さんぼん"), (4, "よんほん"), (5, "ごほん"), (6, "ろっぽん"),
    (7, "ななほん"), (8, "はっぽん"), (9, "きゅうほん"), (10, "じゅっぽん")]]
GOOD = [_ex(i, f"ペンを[[{{{i}本|{READINGS[i - 1]['kana']}}}]]{{買|か}}いました。") for i in range(1, 11)]


def test_check_counter_ok() -> None:
    rep = CounterReport()
    check_counter(_counter(READINGS, GOOD), rep)
    assert rep.errors == []


def test_check_counter_bad_reading_and_irregular_flag() -> None:
    bad = [dict(r) for r in READINGS]
    bad[2] = {**bad[2], "kana": "さんほん"}  # sai quy tắc, không đánh dấu irregular
    bad[0] = {**bad[0], "irregular": True}  # hợp quy tắc mà đánh dấu irregular
    rep = CounterReport()
    check_counter(_counter(bad, GOOD), rep)
    assert any("c-hon 3:" in e for e in rep.errors)
    assert any("c-hon 1:" in e and "irregular" in e for e in rep.errors)


def test_check_example_errors() -> None:
    c = _counter(READINGS, GOOD)
    for ruby, msg in [
        ("ペンを[[{3本|さんほん}]]買いました。", "chữ Hán thiếu furigana"),
        ("ペンを[[{3本|さんほん}]]{買|か}いました。", "không khớp"),
        ("[[ペン]]を{3本|さんぼん}{買|か}いました。", "phải chứa"),
        ("[[{何本|なんほん}]]ですか。", "bảng ghi"),
    ]:
        rep = CounterReport()
        check_counter_example(c, _ex(1, ruby), rep)
        assert any(msg in e for e in rep.errors), (ruby, rep.errors)
    rep = CounterReport()
    check_counter_example(c, _ex(1, "[[{20本|にじゅっぽん}]]あります。"), rep)  # ngoài bảng → theo quy tắc
    assert rep.errors == []


def test_parse_examples() -> None:
    out = parse_examples("# chú thích\nc-hon-e01|[[{1本|いっぽん}]]|một cây\nc-hon-e02|[[{2本|にほん}]]|hai cây|user\n")
    assert [e.id for e in out["c-hon"]] == ["c-hon-e01", "c-hon-e02"]
    assert out["c-hon"][1].review == "user"
    with pytest.raises(ValueError):
        parse_examples("c-hon-e01|thiếu cột")


@pytest.mark.parametrize(("text", "kana", "ok"), [
    ("2.5", "にてんご", True), ("1.5", "いってんご", True), ("3.14", "さんてんいちよん", True),
    ("3.14", "さんてんじゅうよん", False), ("0.5", "れいてんご", True), ("1/2", "にぶんのいち", True),
    ("3分の1", "さんぶんのいち", True), ("3/4", "さんぶんのよん", False), ("50%", "ごじゅっパーセント", True),
    ("10%", "じゅうパーセント", True), ("-3", "マイナスさん", True), ("-2.5", "マイナスにてんご", True),
    ("090-1234", "ゼロきゅうゼロの いちにいさんよん", True), ("090-1234", "きゅうじゅうのせんにひゃく", False),
    ("10,000", "まん", False),
])
def test_reading_matches(text: str, kana: str, ok: bool) -> None:
    assert reading_matches(text, kana) is ok


def test_reading_matches_unknown_form() -> None:
    assert reading_matches("第1", "だいいち") is None


def test_check_number_example() -> None:
    good = CounterExample(id="num-e01", ruby="{熱|ねつ}が[[{37.5|さんじゅうななてんご}]]{度|ど}あります。", vi="x",
                          source="ai-draft", review="auto")
    bad = CounterExample(id="num-e02", ruby="ケーキの[[{3分の1|いちぶんのさん}]]を{食|た}べました。", vi="x",
                         source="ai-draft", review="auto")
    rep = CounterReport()
    check_number_example(good, rep)
    check_number_example(bad, rep)
    assert len(rep.errors) == 1 and "num-e02" in rep.errors[0]
