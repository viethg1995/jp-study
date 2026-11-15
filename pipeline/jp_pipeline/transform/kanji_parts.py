"""Bộ thủ thành phần của mỗi chữ: mọi bộ trong 214 bộ xuất hiện ở bất kỳ độ sâu nào của cây KanjiVG.

Bộ chính (KANJIDIC2) luôn có mặt. Một phần tử quy được về hai bộ (dạng viết ≠ dạng gốc, vd 月 gốc 肉)
→ ưu tiên bộ chính của chữ, sau đó dạng gốc. Bộ 1 nét (一 丨 丶 丿 乙 亅) bỏ qua trừ khi là bộ chính —
chúng có trong gần như mọi chữ nên không giúp nhận diện.
"""

from __future__ import annotations

from pydantic import BaseModel

from jp_pipeline.schemas import KanjiEntry, Radical
from jp_pipeline.transform.kanji_strokes import TreeNode

SKIP_RADICALS = frozenset(range(1, 7))  # bộ 1 nét


class PartsReport(BaseModel):
    no_tree: list[str]  # chữ không có SVG KanjiVG → chỉ có bộ chính
    primary_not_in_tree: list[str]  # bộ chính KANJIDIC2 không thấy trong cây KanjiVG (vẫn được thêm)
    unmapped: dict[str, int]  # phần tử KanjiVG không quy về được bộ nào: số lần gặp


def radical_lookup(radicals: list[Radical]) -> dict[str, int]:
    """Chữ → số bộ: chữ chính trước, biến thể sau (biến thể không đè chữ chính của bộ khác)."""
    out = {r.char: r.number for r in radicals}
    for r in radicals:
        for v in r.variants:
            out.setdefault(v, r.number)
    return out


def radical_parts(
    nodes: list[TreeNode], primary: int | None, lookup: dict[str, int]
) -> tuple[list[int], bool, list[str]]:
    """→ (số bộ tăng dần, bộ chính có trong cây không, phần tử không quy được về bộ nào)."""
    found: set[int] = set()
    unmapped: list[str] = []
    for n in nodes:
        cands = [lookup[c] for c in (n.original, n.element) if c and c in lookup]
        if not cands:
            if n.depth > 0:
                unmapped.append(n.element)
            continue
        found.add(primary if primary in cands else cands[0])
    in_tree = primary is None or primary in found
    parts = {p for p in found if p not in SKIP_RADICALS}
    if primary is not None:
        parts.add(primary)
    return sorted(parts), in_tree, unmapped


def build_radical_parts(
    kanji: list[KanjiEntry], trees: dict[str, list[TreeNode]], radicals: list[Radical]
) -> tuple[list[KanjiEntry], PartsReport]:
    """Gán `radical_parts` cho mọi chữ. trees: {字: cây KanjiVG} (thiếu → chỉ bộ chính)."""
    lookup = radical_lookup(radicals)
    out: list[KanjiEntry] = []
    no_tree: list[str] = []
    not_in: list[str] = []
    unmapped: dict[str, int] = {}
    for k in kanji:
        nodes = trees.get(k.char)
        if nodes is None:
            no_tree.append(k.char)
            parts = [k.radical] if k.radical is not None else []
        else:
            parts, in_tree, miss = radical_parts(nodes, k.radical, lookup)
            if not in_tree:
                not_in.append(k.char)
            for m in miss:
                unmapped[m] = unmapped.get(m, 0) + 1
        out.append(k.model_copy(update={"radical_parts": parts}))
    report = PartsReport(
        no_tree=no_tree,
        primary_not_in_tree=not_in,
        unmapped=dict(sorted(unmapped.items(), key=lambda kv: (-kv[1], kv[0]))),
    )
    return out, report
