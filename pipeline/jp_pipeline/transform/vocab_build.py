"""Gộp 3 lớp dữ liệu từ vựng → VocabEntry (data/), kèm kiểm tra.

  sources/vocabulary (gốc)  ←  enrichment/_auto (script)  ←  enrichment/lesson-XX (đã duyệt)

Lỗi (errors) → build FAIL. Cảnh báo (warnings) → ghi báo cáo, build vẫn chạy.
"""

from __future__ import annotations

import re
from collections import Counter, defaultdict

from pydantic import BaseModel, ValidationError

from jp_pipeline.dictionaries import KanjiInfo
from jp_pipeline.schemas import PartOfSpeech, VocabEntry, VocabExample, VocabProvenance
from jp_pipeline.transform.vocab_auto import (
    AutoVocab,
    SourceVocab,
    cjk_chars,
    new_id,
    normalize_han_viet,
    source_han_viet_valid,
)
from jp_pipeline.transform.vocab_text import normalize_slots, split_senses


class BuildReport(BaseModel):
    errors: list[str] = []
    warnings: list[str] = []
    pending_review: list[str] = []  # id còn cờ chưa ai duyệt
    han_viet_conflicts: dict[str, dict[str, list[str]]] = {}  # chữ → âm → [id]


def merge_entry(row: SourceVocab, auto: AutoVocab, reviewed: dict[str, object] | None) -> VocabEntry:
    rv = reviewed or {}
    kanji = rv.get("kanji", auto.kanji)
    kanji = normalize_slots(str(kanji)) if kanji else None  # '－歳' → '～歳'
    if kanji and not cjk_chars(str(kanji)):
        kanji = None  # nguồn ghi kana/số vào cột kanji (かけます, １つ) → không phải kanji
    han_viet = normalize_han_viet(rv.get("han_viet", auto.han_viet)) if kanji else None  # type: ignore[arg-type]
    meaning = normalize_slots(str(rv.get("meaning_vi", row.vn)))
    k_src = rv.get("kanji_source", auto.kanji_source)
    h_src = rv.get("han_viet_source", auto.han_viet_source)
    review_by = (rv.get("review") or {}).get("by") if isinstance(rv.get("review"), dict) else None  # type: ignore[union-attr]
    examples = [VocabExample.model_validate(e) for e in rv.get("examples", [])]  # type: ignore[union-attr]

    return VocabEntry(
        id=auto.id,
        legacy_id=row.id,
        lesson=auto.lesson,
        kana=normalize_slots(str(rv.get("kana", row.jp))),
        kanji=kanji,  # type: ignore[arg-type]
        display="kanji" if row.kanji and cjk_chars(row.kanji) else "kana",
        han_viet=han_viet,  # type: ignore[arg-type]
        meaning_vi=meaning,
        senses=split_senses(meaning),
        # Từ loại: mã đã duyệt (nếu có) hoặc mã gốc; nhãn LUÔN sinh từ mã chuẩn (bỏ nhãn gốc)
        pos=PartOfSpeech.of(str(rv.get("pos_code", row.type_code))),
        kanji_refs=[f"k-{c}" for c in dict.fromkeys(cjk_chars(str(kanji or "")))],
        same_word=[],  # điền ở link_same_word()
        examples=examples,
        provenance=VocabProvenance(
            kanji=k_src if kanji else None,  # type: ignore[arg-type]
            han_viet=h_src if han_viet else None,  # type: ignore[arg-type]
            pos=rv.get("pos_source", "source"),  # type: ignore[arg-type]
            meaning=rv.get("meaning_source", "source"),  # type: ignore[arg-type]
        ),
        review=review_by if review_by in ("ai", "user") else "auto",  # type: ignore[arg-type]
    )


_HV_SPLIT = re.compile(r"[\s、,~～]+")
REVIEW_FLAGS = ("kanji_verify", "kanji_ambiguous", "han_viet_ambiguous")


def build_vocab(
    rows: list[SourceVocab],
    auto: dict[str, AutoVocab],
    reviewed: dict[str, dict[str, object]],
    kanjidic: dict[str, KanjiInfo],
) -> tuple[list[VocabEntry], BuildReport]:
    report = BuildReport()
    entries: list[VocabEntry] = []
    seen: set[str] = set()

    for row in rows:
        vid, _ = new_id(row.id)
        if vid in seen:
            report.errors.append(f"{vid}: trùng ID")
            continue
        seen.add(vid)
        a = auto.get(vid)
        if a is None:
            report.errors.append(f"{vid}: thiếu trong _auto/ — chạy lại enrich-vocab")
            continue
        try:
            e = merge_entry(row, a, reviewed.get(vid))
        except ValidationError as exc:
            report.errors.append(f"{vid}: {exc.errors()[0]['msg']}")
            continue
        entries.append(e)

        if e.review == "auto" and any(f in REVIEW_FLAGS for f in a.flags):
            report.pending_review.append(vid)
        elif a.pos_suggested and "pos_code" not in (reviewed.get(vid) or {}):
            report.pending_review.append(vid)  # đề xuất sửa từ loại chưa duyệt
        missing = [r[2:] for r in e.kanji_refs if r[2:] not in kanjidic]
        if missing:
            report.warnings.append(f"{vid}: kanji không có trong KANJIDIC2: {''.join(missing)}")
        if e.kanji and e.han_viet:
            toks = [t for t in _HV_SPLIT.split(e.han_viet) if t]
            n_chars = len(cjk_chars(e.kanji))
            if not source_han_viet_valid(e.kanji, e.han_viet):
                report.warnings.append(
                    f"{vid}: số âm Hán-Việt ({len(toks)}) ≠ số chữ Hán ({n_chars}): {e.kanji} / {e.han_viet}"
                )

    for vid in reviewed:
        if vid not in seen:
            report.errors.append(f"{vid}: có trong file đã duyệt nhưng không có trong sources/")

    report.han_viet_conflicts = find_han_viet_conflicts(entries)
    return link_same_word(entries), report


def link_same_word(entries: list[VocabEntry]) -> list[VocabEntry]:
    """Nối 2 chiều các mục cùng (kana, kanji) — vd かけます: đeo [kính] / treo / khóa / ngồi."""
    groups: dict[tuple[str, str | None], list[str]] = defaultdict(list)
    for e in entries:
        groups[(e.kana, e.kanji)].append(e.id)
    return [
        e.model_copy(update={"same_word": [i for i in groups[(e.kana, e.kanji)] if i != e.id]})
        for e in entries
    ]


def find_han_viet_conflicts(entries: list[VocabEntry]) -> dict[str, dict[str, list[str]]]:
    """Chữ Hán được ghi nhiều âm khác nhau giữa các từ — có thể là đa âm hợp lệ (行 HÀNH/HÀNG)
    hoặc lỗi dữ liệu (腹 PHỤC/PHÚC). Chỉ báo cáo, không tự sửa."""
    usage: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
    for e in entries:
        if not (e.kanji and e.han_viet) or any(c in e.han_viet for c in "/()"):
            continue
        chars = cjk_chars(e.kanji)
        toks = [t for t in _HV_SPLIT.split(e.han_viet) if t]
        if len(chars) == len(toks):
            for c, t in zip(chars, toks, strict=True):
                usage[c][t].append(e.id)
    return {c: dict(v) for c, v in sorted(usage.items()) if len(v) > 1}


def summarize(entries: list[VocabEntry]) -> dict[str, Counter[str]]:
    return {
        "review": Counter(e.review for e in entries),
        "kanji": Counter(str(e.provenance.kanji) for e in entries),
        "han_viet": Counter(str(e.provenance.han_viet) for e in entries),
    }


def cross_link_books(a: list[VocabEntry], b: list[VocabEntry]) -> tuple[list[VocabEntry], list[VocabEntry]]:
    """Nối same_word 2 chiều giữa hai sách (Minna ↔ N3) theo mặt chữ: kanji (nếu có) hoặc kana."""
    def key(e: VocabEntry) -> str:
        return e.kanji or e.kana

    idx: dict[str, list[str]] = defaultdict(list)
    for e in a + b:
        idx[key(e)].append(e.id)

    def upd(es: list[VocabEntry]) -> list[VocabEntry]:
        out = []
        for e in es:
            extra = [i for i in idx[key(e)] if i != e.id and i not in e.same_word]
            out.append(e.model_copy(update={"same_word": [*e.same_word, *extra]}) if extra else e)
        return out

    return upd(a), upd(b)
