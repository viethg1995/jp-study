"""KanjiVG (CC BY-SA 3.0) → thứ tự nét viết cho từng chữ trong kanji.json.

Mỗi SVG KanjiVG: các <path id="kvg:XXXXX-sN"> theo thứ tự viết (N = 1, 2, …), kèm
<g id="kvg:StrokeNumbers_XXXXX"> chứa vị trí số thứ tự nét. Chỉ giữ path + kiểu nét + vị trí số;
bỏ chú thích, DOCTYPE, nhóm thành phần (web tự vẽ SVG từ dữ liệu này).
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET

from pydantic import BaseModel

from jp_pipeline.schemas import KanjiComponent, KanjiEntry, KanjiStroke, KanjiStrokes

SVG_NS = "{http://www.w3.org/2000/svg}"
_STROKE_ID = re.compile(r"-s(\d+)$")
_MATRIX = re.compile(r"matrix\(\s*1\s+0\s+0\s+1\s+([-\d.]+)\s+([-\d.]+)\s*\)")
_DOCTYPE = re.compile(r"<!DOCTYPE.*?\]>", re.DOTALL)


class StrokeReport(BaseModel):
    total: int
    missing: list[str]  # chữ không có trong KanjiVG
    count_mismatch: dict[str, tuple[int, int]]  # 字: (số nét KanjiVG, số nét KANJIDIC2)


def kanjivg_filename(ch: str) -> str:
    """体 → 'kanji/04f53.svg' (mã Unicode 5 chữ số hex, chữ thường)."""
    return f"kanji/{ord(ch):05x}.svg"


def parse_kanjivg_svg(text: str) -> list[KanjiStroke]:
    """Đọc một SVG KanjiVG → danh sách nét theo thứ tự viết. Lỗi cấu trúc → ValueError (không bỏ qua)."""
    root = ET.fromstring(_DOCTYPE.sub("", text, count=1))
    paths: list[tuple[int, str, str | None]] = []
    nums: list[tuple[float, float]] = []
    for el in root.iter():
        if el.tag == f"{SVG_NS}path":
            m = _STROKE_ID.search(el.get("id", ""))
            if m is None:
                raise ValueError(f"path không có id nét: {el.get('id')!r}")
            kvg_type = next((v for k, v in el.attrib.items() if k.endswith("type")), None)
            paths.append((int(m.group(1)), el.get("d", ""), kvg_type or None))
        elif el.tag == f"{SVG_NS}text":
            m = _MATRIX.search(el.get("transform", ""))
            if m is None:
                raise ValueError(f"không đọc được vị trí số nét: {el.get('transform')!r}")
            nums.append((float(m.group(1)), float(m.group(2))))
    paths.sort(key=lambda p: p[0])
    if [p[0] for p in paths] != list(range(1, len(paths) + 1)):
        raise ValueError(f"thứ tự nét không liên tục: {[p[0] for p in paths]}")
    if len(nums) != len(paths):
        raise ValueError(f"{len(paths)} nét nhưng {len(nums)} số thứ tự")
    return [KanjiStroke(d=d, type=t, num=[x, y]) for (_, d, t), (x, y) in zip(paths, nums, strict=True)]


def _kvg(el: ET.Element, name: str) -> str | None:
    return next((v for k, v in el.attrib.items() if k.endswith("}" + name) or k == name), None)


def _stroke_nums(el: ET.Element) -> list[int]:
    out: list[int] = []
    for p in el.iter(f"{SVG_NS}path"):
        m = _STROKE_ID.search(p.get("id", ""))
        if m:
            out.append(int(m.group(1)))
    return sorted(out)


def parse_components(text: str) -> list[tuple[str, str | None, list[int]]]:
    """Thành phần cấp 1 của chữ: nhóm <g kvg:element> con trực tiếp của nhóm gốc `kvg:XXXXX`.
    Nhóm tách đôi (`kvg:part`, vd 囗 bao quanh 玉 trong 国) gộp lại. Chữ không tách được → []."""
    root = ET.fromstring(_DOCTYPE.sub("", text, count=1))
    top = next((g for g in root.iter(f"{SVG_NS}g") if re.fullmatch(r"kvg:[0-9a-f]+", g.get("id", ""))), None)
    if top is None:
        return []
    merged: dict[tuple[str, str | None], list[int]] = {}
    for g in top:
        el = _kvg(g, "element") if g.tag == f"{SVG_NS}g" else None
        if el is None or len(el) != 1:  # 'CDP-8BC4' = bộ phận ngoài Unicode → bỏ
            continue
        key = (el, _kvg(g, "original"))
        merged.setdefault(key, []).extend(_stroke_nums(g))
    comps = [(el, orig, sorted(set(nums))) for (el, orig), nums in merged.items() if nums]
    return comps if len(comps) >= 2 else []


def build_strokes(
    kanji: list[KanjiEntry],
    svgs: dict[str, str],
    names: dict[str, tuple[str | None, str | None]] | None = None,
) -> tuple[list[KanjiStrokes], StrokeReport]:
    """svgs: {字: nội dung SVG} (chỉ những chữ có trong KanjiVG).
    names: {thành phần: (tên Hán-Việt, nghĩa)} — tra theo dạng gốc trước (亻 → 人), rồi dạng viết."""
    names = names or {}
    out: list[KanjiStrokes] = []
    missing: list[str] = []
    mismatch: dict[str, tuple[int, int]] = {}
    for k in kanji:
        svg = svgs.get(k.char)
        if svg is None:
            missing.append(k.char)
            continue
        try:
            strokes = parse_kanjivg_svg(svg)
        except (ValueError, ET.ParseError) as e:
            raise ValueError(f"KanjiVG {k.char}: {e}") from e
        if k.strokes is not None and len(strokes) != k.strokes:
            mismatch[k.char] = (len(strokes), k.strokes)
        comps = []
        for el, orig, nums in parse_components(svg):
            nm = names.get(orig or el) or names.get(el) or (None, None)
            comps.append(KanjiComponent(char=el, original=orig if orig != el else None, strokes=nums,
                                        name_vi=nm[0], meaning_vi=nm[1]))
        out.append(KanjiStrokes(id=k.id, char=k.char, strokes=strokes, components=comps))
    return out, StrokeReport(total=len(out), missing=missing, count_mismatch=mismatch)
