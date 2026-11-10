"""Lọc từ vựng nghi sai nghĩa / sai kanji bằng JMdict (0 token) — người hoặc AI chỉ đọc danh sách nghi vấn.

Lỗi điển hình: nguồn lẫn từ ĐỒNG ÂM (わかれます: 分かれる 'bị chia ra' ↔ 別れる 'chia tay'), nên
nghĩa tiếng Việt thuộc một chữ còn kanji thuộc chữ kia. Không so được nghĩa Việt ↔ Anh tự động, nên script:

  homophone  — kanji của từ khớp JMdict, NHƯNG cùng cách đọc còn ≥1 từ thông dụng khác (kanji khác,
               cùng nhóm từ loại) → in nghĩa EN của tất cả để đối chiếu với nghĩa Việt
  no_match   — kanji của từ KHÔNG có trong JMdict ở cách đọc này (kanji hoặc kana có thể sai)
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from jp_pipeline.dictionaries import JmEntry
from jp_pipeline.schemas import VocabEntry
from jp_pipeline.transform.vocab_auto import kanji_forms, masu_to_dict, pos_match


class Candidate(BaseModel):
    kanji: list[str]
    gloss: list[str]


class MeaningSuspect(BaseModel):
    id: str
    kind: Literal["homophone", "no_match"]
    kana: str
    kanji: str
    meaning_vi: str
    pos: str
    gloss: list[str]  # nghĩa EN của entry khớp kanji (rỗng nếu no_match)
    others: list[Candidate]  # từ đồng âm thông dụng khác


def dict_form(e: VocabEntry) -> tuple[str, list[str]]:
    """(kana từ điển, [kanji từ điển]) — động từ ます → thể từ điển; bỏ ～ và tiền tố お/ご không đổi."""
    kana = e.kana.replace("～", "")
    forms = [f.replace("～", "") for f in kanji_forms(e.kanji or "")]
    conv = masu_to_dict(kana, e.pos.code)
    if conv:
        dict_kana, tail = conv
        if len(tail) >= len(kana):  # 来ます/します: cả từ là đuôi → kanji gốc + る
            forms = [f[:-2] + "る" if f.endswith("ます") else f for f in forms]
        else:
            suffix = dict_kana[len(kana) - len(tail):]
            forms = [f[: -len(tail)] + suffix if f.endswith(tail) else f for f in forms]
        kana = dict_kana
    return kana, forms


def check_meanings(entries: list[VocabEntry], jmdict: dict[str, list[JmEntry]]) -> list[MeaningSuspect]:
    out: list[MeaningSuspect] = []
    for e in entries:
        if not e.kanji:
            continue
        kana, forms = dict_form(e)
        cands = jmdict.get(kana, [])
        if not cands:
            continue  # cách đọc không có trong JMdict (tên riêng, cụm từ) → không đủ căn cứ
        matched = [c for c in cands if set(forms) & set(c.kanji)]
        base = {"id": e.id, "kana": e.kana, "kanji": e.kanji, "meaning_vi": e.meaning_vi, "pos": e.pos.code}
        if not matched:
            others = [Candidate(kanji=c.kanji[:3], gloss=c.gloss) for c in cands if c.common and c.kanji]
            if others:
                out.append(MeaningSuspect(kind="no_match", gloss=[], others=others[:4], **base))
            continue
        seqs = {c.seq for c in matched}
        others = [
            Candidate(kanji=c.kanji[:3], gloss=c.gloss)
            for c in cands
            if c.seq not in seqs and c.common and c.kanji and pos_match(c, e.pos.code)
        ]
        if others:
            out.append(MeaningSuspect(kind="homophone", gloss=matched[0].gloss, others=others[:4], **base))
    return out
