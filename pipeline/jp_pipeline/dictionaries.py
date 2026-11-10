"""Đọc các từ điển mở (JMdict, KANJIDIC2, Unihan) thành index gọn, cache JSON.

Nguồn (tải về sources/dictionaries/, gitignored):
  JMdict_e.gz        — EDRDG, CC BY-SA 4.0   http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz
  kanjidic2.xml.gz   — EDRDG, CC BY-SA 4.0   http://www.edrdg.org/kanjidic/kanjidic2.xml.gz
  Unihan.zip         — Unicode, Unicode License  (trường kVietnamese = âm Hán-Việt)

Index cache ở sources/dictionaries/_index/, tự build lại khi file nguồn mới hơn.
"""

from __future__ import annotations

import gzip
import json
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from pydantic import BaseModel

COMMON_PRI = {"news1", "ichi1", "spec1", "spec2", "gai1"}
UK_MISC = "word usually written using kana alone"


class JmEntry(BaseModel):
    seq: int
    kanji: list[str]  # dạng kanji áp dụng cho cách đọc này, phổ biến trước
    common: bool
    uk: bool  # JMdict đánh dấu "thường viết bằng kana"
    pos: list[str]
    gloss: list[str]  # nghĩa tiếng Anh (sense đầu), tối đa 3


class KanjiInfo(BaseModel):
    char: str
    on: list[str]
    kun: list[str]
    meanings_en: list[str]
    strokes: int | None
    grade: int | None
    jlpt_old: int | None  # thang JLPT cũ 1–4 của KANJIDIC2 (4 ≈ N5)
    radical: int | None


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


# ---------------------------------------------------------------- JMdict


def build_jmdict_index(gz_path: Path) -> dict[str, list[JmEntry]]:
    """reading (kana) → danh sách entry có cách đọc đó."""
    index: dict[str, list[JmEntry]] = {}
    with gzip.open(gz_path, "rb") as f:
        for _, el in ET.iterparse(f, events=("end",)):
            if el.tag != "entry":
                continue
            seq = int(el.findtext("ent_seq") or 0)
            k_eles = [
                (k.findtext("keb") or "", {p.text for p in k.findall("ke_pri")})
                for k in el.findall("k_ele")
            ]
            senses = el.findall("sense")
            pos = [p.text or "" for s in senses for p in s.findall("pos")]
            first = senses[0] if senses else None
            uk = first is not None and any(m.text == UK_MISC for m in first.findall("misc"))
            gloss = [g.text or "" for g in first.findall("gloss")][:3] if first is not None else []

            for r in el.findall("r_ele"):
                reb = nfc(r.findtext("reb") or "")
                if r.find("re_nokanji") is not None:
                    kanji_forms: list[tuple[str, set[str | None]]] = []
                else:
                    restr = {x.text for x in r.findall("re_restr")}
                    kanji_forms = [k for k in k_eles if not restr or k[0] in restr]
                r_pri = {p.text for p in r.findall("re_pri")}
                common = bool(r_pri & COMMON_PRI) or any(pri & COMMON_PRI for _, pri in kanji_forms)
                ordered = sorted(kanji_forms, key=lambda k: not (k[1] & COMMON_PRI))
                index.setdefault(reb, []).append(
                    JmEntry(
                        seq=seq,
                        kanji=[nfc(k) for k, _ in ordered],
                        common=common,
                        uk=uk,
                        pos=pos,
                        gloss=gloss,
                    )
                )
            el.clear()
    return index


# ---------------------------------------------------------------- KANJIDIC2


def build_kanjidic_index(gz_path: Path) -> dict[str, KanjiInfo]:
    out: dict[str, KanjiInfo] = {}
    with gzip.open(gz_path, "rb") as f:
        for _, el in ET.iterparse(f, events=("end",)):
            if el.tag != "character":
                continue
            raw = el.findtext("literal") or ""
            char = nfc(raw)
            if char != raw:
                # chữ tương thích CJK (U+F900–FAFF, dạng cũ: 者 U+FA5B) → NFC thành chữ thường, mục chữ thường
                # đã có riêng; nếu không bỏ thì ghi đè số nét / On-Kun đúng (者 8 nét → 9)
                el.clear()
                continue
            rm = el.find("reading_meaning")
            on: list[str] = []
            kun: list[str] = []
            meanings: list[str] = []
            if rm is not None:
                for g in rm.findall("rmgroup"):
                    for r in g.findall("reading"):
                        if r.get("r_type") == "ja_on":
                            on.append(r.text or "")
                        elif r.get("r_type") == "ja_kun":
                            kun.append(r.text or "")
                    meanings += [m.text or "" for m in g.findall("meaning") if m.get("m_lang") is None]

            def num(path: str, node: ET.Element = el) -> int | None:
                t = node.findtext(path)
                return int(t) if t and t.isdigit() else None

            rad = next(
                (int(r.text) for r in el.findall("radical/rad_value") if r.get("rad_type") == "classical" and r.text),
                None,
            )
            out[char] = KanjiInfo(
                char=char,
                on=on,
                kun=kun,
                meanings_en=meanings,
                strokes=num("misc/stroke_count"),
                grade=num("misc/grade"),
                jlpt_old=num("misc/jlpt"),
                radical=rad,
            )
            el.clear()
    return out


# ---------------------------------------------------------------- Unihan


def build_unihan_vi_index(zip_path: Path) -> dict[str, list[str]]:
    """chữ Hán → các âm Hán-Việt (kVietnamese), giữ thứ tự Unihan."""
    out: dict[str, list[str]] = {}
    with zipfile.ZipFile(zip_path) as z, z.open("Unihan_Readings.txt") as f:
        for raw in f:
            line = raw.decode("utf-8")
            if "\tkVietnamese\t" not in line:
                continue
            code, _, value = line.rstrip("\n").split("\t")
            char = chr(int(code[2:], 16))  # noqa: FURB166 — "U+79C1" không parse được bằng base=0
            out[char] = [nfc(v) for v in value.split()]
    return out


# ---------------------------------------------------------------- cache


def _cached(src: Path, cache: Path, build, encode, decode):  # type: ignore[no-untyped-def]
    if cache.exists() and cache.stat().st_mtime >= src.stat().st_mtime:
        return decode(json.loads(cache.read_text(encoding="utf-8")))
    data = build(src)
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(encode(data), ensure_ascii=False), encoding="utf-8")
    return data


def load_jmdict(src: Path, cache: Path) -> dict[str, list[JmEntry]]:
    return _cached(
        src,
        cache,
        build_jmdict_index,
        lambda d: {k: [e.model_dump() for e in v] for k, v in d.items()},
        lambda d: {k: [JmEntry.model_validate(e) for e in v] for k, v in d.items()},
    )


def load_kanjidic(src: Path, cache: Path) -> dict[str, KanjiInfo]:
    return _cached(
        src,
        cache,
        build_kanjidic_index,
        lambda d: {k: v.model_dump() for k, v in d.items()},
        lambda d: {k: KanjiInfo.model_validate(v) for k, v in d.items()},
    )


def load_unihan_vi(src: Path, cache: Path) -> dict[str, list[str]]:
    return _cached(src, cache, build_unihan_vi_index, lambda d: d, lambda d: d)
