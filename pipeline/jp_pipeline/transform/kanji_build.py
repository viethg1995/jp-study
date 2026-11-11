"""Build data/kanji/: radicals.json (214 bộ thủ) + kanji.json (mọi chữ Hán trong từ vựng).

Nguồn:
  - Bộ thủ: bảng trong PDF "214 bộ thủ" đã trích (sources/_extracted/kanji/214-bộ-thủ-kanji/content.md)
  - On/Kun, nét, cấp, JLPT, số bộ: KANJIDIC2
  - Âm Hán-Việt: ưu tiên âm dùng trong từ vựng đã chuẩn hóa (vocab); thiếu thì Unihan kVietnamese
  - Nghĩa tiếng Việt: CHƯA có nguồn → null (CLAUDE.md rule 5)
"""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from pathlib import Path

from pydantic import BaseModel

from jp_pipeline.dictionaries import KanjiInfo
from jp_pipeline.schemas import KanjiEntry, KanjiLessonRef, Radical, VocabEntry
from jp_pipeline.transform.vocab_auto import cjk_chars, kanji_forms, normalize_han_viet

# Số nét theo nhóm bộ thủ Khang Hy (chuẩn): (bộ đầu, bộ cuối, số nét)
KANGXI_STROKE_RANGES = [
    (1, 6, 1), (7, 29, 2), (30, 60, 3), (61, 94, 4), (95, 117, 5), (118, 146, 6),
    (147, 166, 7), (167, 175, 8), (176, 186, 9), (187, 194, 10), (195, 200, 11),
    (201, 204, 12), (205, 208, 13), (209, 210, 14), (211, 211, 15), (212, 213, 16), (214, 214, 17),
]
_RADICAL_ROW = re.compile(r"^\|[^|]*\|\s*(\d{1,3})\s*\|([^|]*)\|([^|]*)\|([^|]*)\|\s*$")


def radical_strokes(n: int) -> int:
    for lo, hi, s in KANGXI_STROKE_RANGES:
        if lo <= n <= hi:
            return s
    raise ValueError(f"số bộ thủ ngoài 1–214: {n}")


def _clean(cell: str) -> str:
    return re.sub(r"\*\*|<br>", "", cell).strip()


def parse_radicals(md: str) -> list[Radical]:
    """Đọc bảng '| Số nét | STT | Bộ | Tên bộ | Nghĩa |' → 214 bộ thủ (lỗi nếu thiếu/trùng)."""
    found: dict[int, Radical] = {}
    for line in md.splitlines():
        m = _RADICAL_ROW.match(line.strip())
        if not m:
            continue
        n = int(m.group(1))
        forms = [f for f in re.split(r"[,、\s]+", _clean(m.group(2))) if f]
        if not forms or n in found:
            raise ValueError(f"bộ thủ {n}: dòng lỗi hoặc trùng: {line!r}")
        meaning = _clean(m.group(4)) or None
        found[n] = Radical(
            number=n,
            char=forms[0],
            variants=forms[1:],
            strokes=radical_strokes(n),
            name_vi=_clean(m.group(3)),
            meaning_vi=meaning,
        )
    missing = sorted(set(range(1, 215)) - set(found))
    if missing:
        raise ValueError(f"thiếu bộ thủ: {missing[:10]}")
    return [found[n] for n in range(1, 215)]


def char_readings_from_vocab(entries: list[VocabEntry]) -> dict[str, Counter[str]]:
    """Âm Hán-Việt của từng chữ, suy ra từ các từ vựng (chỉ khi số âm khớp số chữ của từng dạng)."""
    usage: dict[str, Counter[str]] = defaultdict(Counter)
    for e in entries:
        if not e.kanji or not e.han_viet or any(c in e.han_viet for c in "()"):
            continue
        if "/" in e.han_viet:
            # chỉ tin khi là MỘT chữ Hán với các âm thay thế: 好き → HIẾU/HẢO
            chars = cjk_chars(e.kanji)
            alts = [a.strip() for a in e.han_viet.split("/")]
            if len(chars) == 1 and all(a and " " not in a for a in alts):
                for a in alts:
                    usage[chars[0]][a.upper()] += 1
            continue
        forms = kanji_forms(e.kanji)
        groups = [g.split() for g in re.split(r"[,、/]", e.han_viet) if g.strip()]
        pairs = zip(forms, groups, strict=False) if len(forms) == len(groups) else [(forms[0], groups[0])]
        for form, toks in pairs:
            chars = cjk_chars(form)
            if len(chars) == len(toks):
                for c, t in zip(chars, toks, strict=True):
                    usage[c][t.upper()] += 1
    return usage


def parse_meanings(files: list[tuple[str, str]]) -> dict[str, tuple[str, str]]:
    """[(tên file, nội dung)] theo thứ tự → {字: (nghĩa, 'ai-draft'|'user')}. File sau ghi đè file trước.

    Dòng đầu bắt buộc '# by: ai|user'. Trùng chữ trong cùng file hoặc dòng sai cú pháp → ValueError.
    """
    out: dict[str, tuple[str, str]] = {}
    for name, text in files:
        lines = text.splitlines()
        m = re.match(r"#\s*by:\s*(ai|user)\s*$", lines[0].strip()) if lines else None
        if not m:
            raise ValueError(f"{name}: dòng đầu phải là '# by: ai|user'")
        src = "user" if m.group(1) == "user" else "ai-draft"
        seen: set[str] = set()
        for i, line in enumerate(lines[1:], start=2):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            ch, sep, meaning = line.partition("|")
            ch, meaning = ch.strip(), meaning.strip()
            if not sep or len(ch) != 1 or not meaning:
                raise ValueError(f"{name}:{i}: sai cú pháp '字|nghĩa': {line!r}")
            if ch in seen:
                raise ValueError(f"{name}:{i}: trùng chữ {ch}")
            seen.add(ch)
            out[ch] = (meaning, src)
    return out


def parse_lesson_files(files: list[tuple[str, str]]) -> dict[str, dict[str, tuple[int, int]]]:
    """enrichment/kanji/lessons/{n5,n4}.txt — dòng `bài|chữ|âm HV` → {"N5": {字: (bài, thứ tự trong bài)}}.
    Tên file (n5/n4) là cấp. Chữ lặp trong cùng cấp → lỗi (không lặng lẽ bỏ qua)."""
    out: dict[str, dict[str, tuple[int, int]]] = {}
    for name, text in files:
        level = Path(name).stem.upper()
        lv = out.setdefault(level, {})
        for n, raw in enumerate(text.splitlines(), 1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split("|")
            if len(parts) < 2 or not parts[0].isdigit():
                raise ValueError(f"{name}:{n}: cần `bài|chữ|âm HV`: {line!r}")
            for i, ch in enumerate(parts[1].strip(), 1):
                if ch in lv:
                    raise ValueError(f"{name}:{n}: chữ {ch} đã có ở bài {lv[ch][0]}")
                lv[ch] = (int(parts[0]), i)
    return out


def parse_stories(files: list[tuple[str, str]]) -> dict[str, tuple[str, str]]:
    """enrichment/kanji/stories/*.txt — `字|câu chuyện` → {字: (câu chuyện, "ai-draft"|"user")}.
    Header `# by: ai|user`; file sau ghi đè file trước. Dòng sai cú pháp → lỗi."""
    out: dict[str, tuple[str, str]] = {}
    for name, text in files:
        by = "ai-draft"
        for n, raw in enumerate(text.splitlines(), 1):
            line = raw.strip()
            if line.startswith("# by:"):
                by = "user" if line.split(":", 1)[1].strip() == "user" else "ai-draft"
                continue
            if not line or line.startswith("#"):
                continue
            ch, sep, story = line.partition("|")
            if not sep or len(ch.strip()) != 1 or not story.strip():
                raise ValueError(f"{name}:{n}: cần `字|câu chuyện`: {line!r}")
            out[ch.strip()] = (story.strip(), by)
    return out


def parse_hanviet_files(files: list[tuple[str, str]]) -> dict[str, tuple[str | None, str]]:
    """[(tên, nội dung)] theo thứ tự → {字: (ÂM | None nếu '-', 'ai-draft'|'user')}. Dòng đầu '# by: ai|user'."""
    out: dict[str, tuple[str | None, str]] = {}
    for name, text in files:
        lines = text.splitlines()
        m = re.match(r"#\s*by:\s*(ai|user)\s*$", lines[0].strip()) if lines else None
        if not m:
            raise ValueError(f"{name}: dòng đầu phải là '# by: ai|user'")
        src = "user" if m.group(1) == "user" else "ai-draft"
        for i, line in enumerate(lines[1:], start=2):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            ch, sep, hv = (x.strip() for x in line.partition("|"))
            if not sep or len(ch) != 1 or not hv:
                raise ValueError(f"{name}:{i}: sai cú pháp '字|ÂM': {line!r}")
            out[ch] = (None if hv == "-" else normalize_han_viet(hv.upper()), src)
    return out


class KanjiBuildReport(BaseModel):
    total: int
    no_meaning: list[str] = []
    meaning_unused: list[str] = []  # chữ có trong file nghĩa nhưng không còn trong từ vựng
    no_han_viet: list[str]
    not_in_kanjidic: list[str]
    multi_reading: dict[str, list[str]]


def build_kanji(
    entries: list[VocabEntry],
    kanjidic: dict[str, KanjiInfo],
    unihan: dict[str, list[str]],
    meanings: dict[str, tuple[str, str]] | None = None,
    n3: dict[str, tuple[int, str | None]] | None = None,
    hv_files: dict[str, tuple[str | None, str]] | None = None,
    ebook: dict[str, dict[str, tuple[int, int]]] | None = None,
    n3_places: dict[str, list[tuple[int, int]]] | None = None,
) -> tuple[list[KanjiEntry], KanjiBuildReport]:
    """n3: {字: (bài Kanji N3, âm Hán-Việt sách N3 đã chuẩn hóa/sửa)} — chữ chỉ có ở N3 vẫn được tạo mục.
    n3_places: {字: [(bài, thứ tự trong bài), …]} — mọi bài Kanji N3 có chữ (bảng tổng hợp đầu bài)."""
    n3_places = n3_places or {}
    meanings = meanings or {}
    n3 = n3 or {}
    hv_files = hv_files or {}
    ebook = ebook or {}  # {"N5": {字: (bài, thứ tự)}, "N4": …} — chữ trong giáo trình Kanji theo cấp
    refs: dict[str, list[VocabEntry]] = defaultdict(list)
    # Minna trước (mn-…), N3 sau (n3-…) — sắp theo id là đủ vì "mn" < "n3"
    for e in sorted(entries, key=lambda x: x.id):
        for r in e.kanji_refs:
            refs[r[2:]].append(e)
    for ch in n3:
        refs.setdefault(ch, [])
    for lv in ebook.values():
        for ch in lv:
            refs.setdefault(ch, [])

    # Âm Hán-Việt chỉ học từ từ vựng MINNA (âm N3 là suy ra từ chữ Hán → tránh vòng lặp)
    readings = char_readings_from_vocab([e for e in entries if e.book == "minna"])
    out: list[KanjiEntry] = []
    no_hv: list[str] = []
    missing: list[str] = []
    multi: dict[str, list[str]] = {}

    def first_minna(c: str) -> int | None:
        ls = [v.lesson for v in refs[c] if v.book == "minna"]
        return min(ls) if ls else None

    def order(c: str) -> tuple[int, int, int, int, str]:
        fl = first_minna(c)
        return (
            fl if fl is not None else 100,
            ebook.get("N5", {}).get(c, (99, 0))[0],
            ebook.get("N4", {}).get(c, (99, 0))[0],
            n3.get(c, (99, None))[0],
            c,
        )

    for ch in sorted(refs, key=order):
        info = kanjidic.get(ch)
        if info is None:
            missing.append(ch)
        if ch in readings:
            hv = [t for t, _ in readings[ch].most_common()]
            hv_src = "vocab"
        elif ch in hv_files:
            hv = [hv_files[ch][0]] if hv_files[ch][0] else []  # type: ignore[list-item]
            hv_src = hv_files[ch][1] if hv else None
            if not hv:
                no_hv.append(ch)
        elif n3.get(ch, (0, None))[1]:
            hv = [n3[ch][1]]  # type: ignore[list-item]
            hv_src = "n3book"
        elif unihan.get(ch):
            hv = list(dict.fromkeys(normalize_han_viet(v.upper()) or "" for v in unihan[ch]))
            hv_src = "unihan"
        else:
            hv, hv_src = [], None
            no_hv.append(ch)
        if len(hv) > 1:
            multi[ch] = hv
        vocab = refs[ch]
        meaning, m_src = meanings.get(ch, (None, None))
        out.append(
            KanjiEntry(
                id=f"k-{ch}",
                char=ch,
                han_viet=hv,
                han_viet_source=hv_src,  # type: ignore[arg-type]
                meaning_vi=meaning,
                meaning_vi_source=m_src,  # type: ignore[arg-type]
                meanings_en=info.meanings_en if info else [],
                on=info.on if info else [],
                kun=info.kun if info else [],
                strokes=info.strokes if info else None,
                grade=info.grade if info else None,
                jlpt_old=info.jlpt_old if info else None,
                radical=info.radical if info else None,
                first_lesson=first_minna(ch),
                n3_lesson=n3[ch][0] if ch in n3 else None,
                n3_lessons=[KanjiLessonRef(lesson=l, order=o) for l, o in sorted(n3_places.get(ch, []))],
                n4_lesson=ebook["N4"][ch][0] if ch in ebook.get("N4", {}) else None,
                n4_order=ebook["N4"][ch][1] if ch in ebook.get("N4", {}) else None,
                n5_lesson=ebook["N5"][ch][0] if ch in ebook.get("N5", {}) else None,
                n5_order=ebook["N5"][ch][1] if ch in ebook.get("N5", {}) else None,
                vocab_refs=[v.id for v in vocab],
            )
        )
    report = KanjiBuildReport(
        total=len(out),
        no_meaning=[k.char for k in out if k.meaning_vi is None],
        meaning_unused=sorted(set(meanings) - set(refs)),
        no_han_viet=no_hv,
        not_in_kanjidic=missing,
        multi_reading=multi,
    )
    return out, report
