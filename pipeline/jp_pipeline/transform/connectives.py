"""Từ nối: enrichment/connectives/{connectives.json, examples/*.txt} + từ vựng + mục ngữ pháp → ConnectiveFile.

Câu ví dụ (examples/*.txt), mỗi dòng `id|nguồn|ruby|vi`:
  cn-soshite-e01|vocab:mn-08-046-e1||          ← lấy nguyên câu ví dụ của từ vựng (ruby, vi để trống)
  cn-noni-e01|grammar:g-45-2|{約束|やくそく}をした[[のに]]、…|…   ← câu trong bài ngữ pháp: chữ phải khớp nguồn
  cn-noni-e03|ai|…|…                           ← AI viết (ai-draft, chờ duyệt)
  cn-noni-e04|user|…|…                         ← người viết / đã duyệt

Hàm thuần — I/O ở cli.py. Lỗi → report.errors (cli không ghi data/).
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any

from pydantic import ValidationError

from jp_pipeline.extract.grammar_md import GrammarSection, norm_ja
from jp_pipeline.schemas import (
    CONNECTIVE_FUNCTIONS,
    Connective,
    ConnectiveExample,
    ConnectiveFile,
    ConnectiveFunctionDef,
    VocabEntry,
)
from jp_pipeline.transform.examples import RubyError, kata_to_hira, parse_ruby, surface


@dataclass(frozen=True)
class RawExample:
    id: str
    source: str  # vocab | grammar | ai | user
    ref: str | None
    ruby: str
    vi: str


@dataclass
class ConnectiveReport:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def parse_examples(text: str) -> list[RawExample]:
    """Dòng `id|nguồn|ruby|vi`; bỏ dòng trống và dòng bắt đầu bằng #. Sai định dạng → ValueError."""
    out: list[RawExample] = []
    for n, line in enumerate(text.splitlines(), 1):
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        parts = s.split("|")
        if len(parts) != 4:
            # ruby có dấu | bên trong {漢字|かな} → tách lại: id|nguồn|…ruby…|vi
            head = s.split("|", 2)
            if len(head) < 3:
                raise ValueError(f"dòng {n}: cần 'id|nguồn|ruby|vi': {s}")
            rest = head[2]
            cut = rest.rfind("|")
            if cut < 0:
                raise ValueError(f"dòng {n}: thiếu bản dịch: {s}")
            parts = [head[0], head[1], rest[:cut], rest[cut + 1:]]
        eid, src, ruby, vi = (p.strip() for p in parts)
        kind, _, ref = src.partition(":")
        if kind not in ("vocab", "grammar", "ai", "user"):
            raise ValueError(f"dòng {n}: nguồn phải là vocab:<id> | grammar:<g-LL-N> | ai | user: {src!r}")
        if kind in ("vocab", "grammar") and not ref:
            raise ValueError(f"dòng {n}: nguồn {kind} cần tham chiếu sau dấu ':'")
        if kind == "vocab" and (ruby or vi):
            raise ValueError(f"dòng {n}: nguồn vocab lấy câu từ từ vựng — để trống ruby và vi")
        if kind != "vocab" and not (ruby and vi):
            raise ValueError(f"dòng {n}: thiếu ruby hoặc bản dịch")
        out.append(RawExample(id=eid, source=kind, ref=ref or None, ruby=ruby, vi=vi))
    return out


def matches_source(ruby: str, source_ja: str) -> bool:
    """Câu (ruby) có trong nguồn: mỗi đoạn có furigana khớp chữ HOẶC cách đọc (nguồn N5 viết kana: じかん ↔ {時間|じかん}).
    So sau NFKC, bỏ khoảng trắng, katakana → hiragana."""
    def k(s: str) -> str:
        return kata_to_hira(norm_ja(s))

    parts: list[str] = []
    for seg in parse_ruby(ruby):
        alts = {k(seg.text)} | ({k(seg.reading)} if seg.reading else set())
        parts.append("(?:" + "|".join(re.escape(a) for a in sorted(alts, key=len, reverse=True) if a) + ")")
    return re.search("".join(parts), k(source_ja)) is not None


def _target(ruby: str) -> tuple[str, str]:
    segs = parse_ruby(ruby)
    t = [s for s in segs if s.target]
    return unicodedata.normalize("NFKC", "".join(s.text for s in t)), kata_to_hira("".join(s.reading or s.text for s in t))


def build_connectives(
    spec: list[dict[str, Any]],
    examples: list[RawExample],
    vocab: list[VocabEntry],
    sections: dict[str, GrammarSection],
) -> tuple[ConnectiveFile, ConnectiveReport]:
    rep = ConnectiveReport()
    vocab_by_id = {e.id: e for e in vocab}
    vex = {x.id: x for e in vocab for x in e.examples}
    ids = [str(c.get("id")) for c in spec]
    dup = sorted({i for i in ids if ids.count(i) > 1})
    if dup:
        rep.errors.append(f"id từ nối trùng: {dup}")
    eids = [x.id for x in examples]
    dup_e = sorted({i for i in eids if eids.count(i) > 1})
    if dup_e:
        rep.errors.append(f"id câu ví dụ trùng: {dup_e}")

    by_owner: dict[str, list[RawExample]] = {}
    for x in examples:
        owner = x.id.rsplit("-e", 1)[0]
        if owner not in ids:
            rep.errors.append(f"{x.id}: không có từ nối {owner}")
            continue
        by_owner.setdefault(owner, []).append(x)

    out: list[Connective] = []
    for raw in spec:
        cid = str(raw.get("id"))
        forms = {unicodedata.normalize("NFKC", f) for f in raw.get("forms", [])} | {kata_to_hira(f) for f in raw.get("forms", [])}
        exs: list[ConnectiveExample] = []
        for x in sorted(by_owner.get(cid, []), key=lambda r: r.id):
            ruby, vi, ref, review = x.ruby, x.vi, x.ref, "auto"
            if x.source == "vocab":
                v = vex.get(str(x.ref))
                if v is None:
                    rep.errors.append(f"{x.id}: không có câu ví dụ từ vựng {x.ref}")
                    continue
                ruby, vi, review = v.ruby, v.vi, v.review
            elif x.source == "user":
                review = "user"
            try:
                t_text, t_read = _target(ruby)
                plain = surface(parse_ruby(ruby))
            except RubyError as ex:
                rep.errors.append(f"{x.id}: ruby — {ex}")
                continue
            if t_text not in forms and t_read not in forms:
                rep.errors.append(f"{x.id}: [[{t_text}]] không thuộc forms của {cid} {sorted(forms)}")
            if x.source == "grammar":
                sec = sections.get(str(x.ref))
                if sec is None:
                    rep.errors.append(f"{x.id}: không có mục ngữ pháp {x.ref}")
                elif not matches_source(ruby, sec.ja_text):
                    rep.errors.append(f"{x.id}: câu không khớp nguồn {x.ref} ({sec.title}): {plain}")
            src = {"vocab": "vocab", "grammar": "grammar", "ai": "ai-draft", "user": "user"}[x.source]
            exs.append(ConnectiveExample(id=x.id, ruby=ruby, vi=vi, source=src, ref=ref, review=review))  # type: ignore[arg-type]
        try:
            c = Connective.model_validate({**raw, "examples": [e.model_dump() for e in exs]})
        except ValidationError as ex:
            err = ex.errors()[0]
            rep.errors.append(f"{cid}: {err['loc']} — {err['msg']}")
            continue
        for v in c.vocab_refs:
            if v not in vocab_by_id:
                rep.errors.append(f"{cid}: vocab_refs không có từ {v}")
        for g in c.grammar_refs:
            if g not in sections:
                rep.errors.append(f"{cid}: grammar_refs không có mục {g}")
        if c.type == "clause" and not c.connects_vi:
            rep.warnings.append(f"{cid}: mẫu nối mệnh đề chưa ghi cách nối")
        if sum(1 for e in c.examples if e.source != "ai-draft") == 0:
            rep.warnings.append(f"{cid}: mọi câu ví dụ đều do AI viết")
        out.append(c)

    known = {c.id for c in out}
    subs = {c.id: set(c.substitutes) for c in out}
    for c in out:
        for s in c.substitutes:
            if s not in known:
                rep.errors.append(f"{c.id}: substitutes có id lạ {s}")
            elif c.id not in subs[s]:
                rep.errors.append(f"{c.id}: substitutes không đối xứng — {s} thiếu {c.id}")

    functions = [ConnectiveFunctionDef(id=k, label_vi=v[0], hint_vi=v[1]) for k, v in CONNECTIVE_FUNCTIONS.items()]  # type: ignore[arg-type]
    return ConnectiveFile(functions=functions, connectives=out), rep
