from jp_pipeline.schemas import Radical
from jp_pipeline.transform.kanji_parts import radical_lookup, radical_parts
from jp_pipeline.transform.kanji_strokes import TreeNode, parse_element_tree


def _r(n: int, ch: str, variants: list[str] | None = None) -> Radical:
    return Radical(number=n, char=ch, variants=variants or [], strokes=1, name_vi="x", meaning_vi=None)


RADS = [_r(1, "一"), _r(9, "人", ["亻"]), _r(72, "日"), _r(74, "月"), _r(75, "木"), _r(130, "肉", ["月"])]
LOOKUP = radical_lookup(RADS)


def _n(el: str, depth: int, orig: str | None = None) -> TreeNode:
    return TreeNode(element=el, original=orig, radical=None, depth=depth)


def test_lookup_main_char_beats_variant() -> None:
    assert LOOKUP["月"] == 74 and LOOKUP["肉"] == 130 and LOOKUP["亻"] == 9


def test_parts_original_and_nested() -> None:
    nodes = [_n("休", 0), _n("亻", 1, "人"), _n("木", 1)]
    assert radical_parts(nodes, 9, LOOKUP) == ([9, 75], True, [])


def test_parts_prefers_primary_when_ambiguous() -> None:
    # 朝: KanjiVG ghi 月 gốc 肉, KANJIDIC xếp bộ 74 → dùng 74
    nodes = [_n("朝", 0), _n("𠦝", 1), _n("日", 2), _n("月", 1, "肉")]
    parts, in_tree, unmapped = radical_parts(nodes, 74, LOOKUP)
    assert parts == [72, 74] and in_tree and unmapped == ["𠦝"]
    # 腹: bộ chính 130 → 月 gốc 肉 = 130
    assert radical_parts([_n("腹", 0), _n("月", 1, "肉")], 130, LOOKUP)[0] == [130]


def test_parts_skip_one_stroke_unless_primary_and_add_missing_primary() -> None:
    nodes = [_n("X", 0), _n("一", 1), _n("木", 1)]
    assert radical_parts(nodes, 75, LOOKUP)[0] == [75]
    assert radical_parts(nodes, 1, LOOKUP)[0] == [1, 75]
    parts, in_tree, _ = radical_parts([_n("X", 0), _n("木", 1)], 72, LOOKUP)
    assert parts == [72, 75] and not in_tree


def test_parse_element_tree_through_unnamed_groups() -> None:
    svg = """<svg xmlns="http://www.w3.org/2000/svg" xmlns:kvg="http://kanjivg.tagaini.net">
<g id="kvg:05b66" kvg:element="学"><g id="kvg:05b66-g1"><g id="kvg:05b66-g2" kvg:element="⺍" kvg:original="つ"/>
<g id="kvg:05b66-g3" kvg:element="冖"/></g><g id="kvg:05b66-g4" kvg:element="子" kvg:radical="general"/></g></svg>"""
    nodes = parse_element_tree(svg)
    assert [(n.element, n.depth) for n in nodes] == [("学", 0), ("⺍", 1), ("冖", 1), ("子", 1)]
    assert nodes[1].original == "つ" and nodes[3].radical == "general"
