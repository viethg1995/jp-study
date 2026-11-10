"""N3 (đã phân tích theo bố cục) + sửa lỗi + JMdict → VocabEntry (book="n3", id n3-NNN).

- Từ loại: sách không ghi → suy từ JMdict (mục khớp từ + cách đọc); không khớp → đoán theo hình thức, cờ.
- Âm Hán-Việt: ghép âm từng chữ Hán (ưu tiên âm dùng trong từ vựng Minna, sau đó âm trong sách Kanji N3).
- Câu ví dụ: KHÔNG lấy từ sách (bản quyền) — AI viết riêng sau (enrichment/n3/_examples/).
- Sửa lỗi: enrichment/n3/vocab-fixes.txt — `NNN | field | giá trị | ghi chú`, field ∈ word, reading, meaning, pos, particle, drop.
"""

from __future__ import annotations

import re

from pydantic import BaseModel

from jp_pipeline.dictionaries import JmEntry
from jp_pipeline.schemas import PartOfSpeech, VocabEntry, VocabExample, VocabProvenance
from jp_pipeline.transform.n3_vocab import KANJI, N3VocabRaw, _core, _hira
from jp_pipeline.transform.vocab_auto import cjk_chars, normalize_han_viet
from jp_pipeline.transform.vocab_text import normalize_slots, split_senses


def parse_examples(files: list[tuple[str, str]]) -> dict[int, list[tuple[str, str, str]]]:
    """enrichment/n3/_examples/lesson-XX.txt → {số thứ tự: [(ruby, vi, 'ai'|'user')]}.
    Dòng: NNN|ruby|vi (ruby chứa '|' → id = trước '|' đầu, vi = sau '|' cuối). Dòng đầu '# by: ai|user'."""
    from jp_pipeline.transform.examples import parse_ruby

    out: dict[int, list[tuple[str, str, str]]] = {}
    for name, text in files:
        lines = text.splitlines()
        m = re.match(r"#\s*by:\s*(ai|user)\s*$", lines[0].strip()) if lines else None
        if not m:
            raise ValueError(f"{name}: dòng đầu phải là '# by: ai|user'")
        for i, raw in enumerate(lines[1:], start=2):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            if line.count("|") < 2:
                raise ValueError(f"{name}:{i}: cần 'NNN|ruby|vi'")
            head, vi = line.rsplit("|", 1)
            no, ruby = head.split("|", 1)
            parse_ruby(ruby.strip())  # sai cú pháp → RubyError (build dừng)
            out.setdefault(int(no), []).append((ruby.strip(), vi.strip(), m.group(1)))
    return out


FIX_FIELDS = ("word", "reading", "meaning", "pos", "particle", "drop")


class N3Fix(BaseModel):
    no: int
    field: str
    value: str
    note: str


def parse_fixes(text: str) -> tuple[str, list[N3Fix]]:
    """→ (người duyệt 'ai'|'user', danh sách sửa). Dòng đầu bắt buộc '# by: ai|user'."""
    lines = text.splitlines()
    m = re.match(r"#\s*by:\s*(ai|user)\s*$", lines[0].strip()) if lines else None
    if not m:
        raise ValueError("vocab-fixes: dòng đầu phải là '# by: ai|user'")
    out: list[N3Fix] = []
    for i, raw in enumerate(lines[1:], start=2):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.split("|")]
        if len(parts) < 3 or parts[1] not in FIX_FIELDS or not parts[0].isdigit():
            raise ValueError(f"vocab-fixes:{i}: cần 'NNN|field|giá trị' (field ∈ {FIX_FIELDS}): {raw!r}")
        out.append(N3Fix(no=int(parts[0]), field=parts[1], value=parts[2], note=parts[3] if len(parts) > 3 else ""))
    return m.group(1), out


def pos_from_jmdict(word: str, reading: str | None, jm: dict[str, list[JmEntry]]) -> str | None:
    """Mã từ loại chuẩn từ JMdict (mục có cách đọc = reading và dạng kanji = từ). None nếu không khớp.
    Sách ghi kèm な/だ (得意な) hoặc する (禁煙する) → tra phần gốc: tính từ な → An, danh từ する → V3."""
    core = _core(word)
    rd0 = _core(reading) if reading else core
    for tail, code in (("する", "V3"), ("な", "An"), ("だ", "An")):
        if core.endswith(tail) and len(core) > len(tail) and rd0.endswith(tail):
            stem = pos_from_jmdict(core[: -len(tail)], rd0[: -len(tail)], jm)
            if stem is not None:
                return code if (code == "V3" or stem in ("An", "N")) else stem
    rd = _core(reading) if reading else core
    pool = jm.get(rd) or jm.get(_hira(rd)) or []
    cands = [e for e in pool if not KANJI.search(core) or core in e.kanji]
    if not cands:
        return None
    pos = " | ".join(cands[0].pos).lower()
    if core.endswith("する") or ("suru" in pos and core.endswith("する")):
        return "V3"
    if "ichidan" in pos:
        return "V2"
    if "godan" in pos:
        return "V1"
    if "suru" in pos and "noun" not in pos:
        return "V3"
    if "adjective (keiyoushi)" in pos:
        return "Ai"
    if "keiyodoshi" in pos or "quasi-adjective" in pos:
        return "An"
    if pos.startswith("adverb") or ("adverb" in pos and "noun" not in pos):
        return "Adv"
    if "conjunction" in pos:
        return "Conj"
    if "interjection" in pos:
        return "Int"
    if "noun" in pos:
        return "N"
    if "expression" in pos:
        return "Phr"
    return None


def guess_pos(word: str) -> str:
    """Không khớp JMdict: đoán theo hình thức (cụm có trợ từ / 〜 → Phr; đuôi する → V3)."""
    core = _core(word)
    if core.endswith("する"):
        return "V3"
    if re.search(r"[をがにで]|[～〜＋]", word):
        return "Phr"
    return "N"


RELIABLE_HV = ("minna", "n3book", "user")


_JUNK_SENSE = re.compile(r"^(vs|\+|/?\s*(CM|DM)|[぀-ヿ]+)$")


def clean_meaning(meaning: str, word: str) -> str:
    """Làm sạch rác khi trích nghĩa từ thẻ N3: tiền tố '～ ', '/ ', 'A B ( ～', 'A B / ～'; số thứ tự '1.' '2 ';
    nghĩa vụn ('vs', '+', '/ CM', kana lạc); nghĩa trùng lặp. '～' giữ lại nếu bản thân từ là mẫu có '～'."""
    out: list[str] = []
    for part in meaning.split(";"):
        t = part.strip()
        t = re.sub(r"^A\s*B\s*[(/]?\s*[～〜~]?\s*", "", t)
        t = re.sub(r"^(/\s*)+", "", t)
        if "～" not in word and "〜" not in word:
            t = re.sub(r"^[～〜~]\s*", "", t)
        t = re.sub(r"^\d+\.?\s+(?=\S)", "", t).strip(" /")
        if t and not _JUNK_SENSE.match(t) and t not in out:
            out.append(t)
    return "; ".join(out)


def derive_han_viet(word: str, char_hv: dict[str, tuple[str, str]]) -> tuple[str | None, str | None]:
    """→ (âm ghép, provenance): 'derived' nếu mọi chữ từ nguồn tin cậy (Minna / sách N3 / user duyệt),
    'mixed' nếu có chữ lấy từ AI nháp hoặc Unihan (cần soát). Thiếu âm một chữ → (None, None)."""
    chars = cjk_chars(_core(word))
    if not chars or any(c not in char_hv for c in chars):
        return None, None
    hv = normalize_han_viet(" ".join(char_hv[c][0] for c in chars))
    prov = "derived" if all(char_hv[c][1] in RELIABLE_HV for c in chars) else "mixed"
    return hv, prov


def build_n3_vocab(
    raws: list[N3VocabRaw],
    fixes: list[N3Fix],
    fix_by: str,
    jm: dict[str, list[JmEntry]],
    char_hv: dict[str, tuple[str, str]],
    examples: dict[int, list[tuple[str, str, str]]] | None = None,
) -> tuple[list[VocabEntry], list[str]]:
    """→ (entries sắp theo số thứ tự, cảnh báo)."""
    by_no: dict[int, list[N3Fix]] = {}
    for f in fixes:
        by_no.setdefault(f.no, []).append(f)
    changed_src = "user" if fix_by == "user" else "ai-draft"
    out: list[VocabEntry] = []
    warnings: list[str] = []
    seen: set[int] = set()
    for r in sorted(raws, key=lambda r: r.no):
        if r.no >= 1000 or r.no in seen:
            warnings.append(f"n3-{r.no}: bỏ (số thẻ ghép lệch / trùng) — {r.word}")
            continue
        seen.add(r.no)
        fx = {f.field: f.value for f in by_no.get(r.no, [])}
        if "drop" in fx:
            continue
        word = fx.get("word", r.word)
        reading = fx.get("reading", r.reading)
        meaning = fx.get("meaning", "; ".join(m.strip() for m in r.meaning_vi if m.strip()))
        if not meaning:
            warnings.append(f"n3-{r.no:03d}: thiếu nghĩa — {word}")
            continue
        if not reading:
            reading = word if not KANJI.search(word) else None
        if not reading:
            warnings.append(f"n3-{r.no:03d}: thiếu cách đọc — {word}")
            continue
        pos_code = fx.get("pos") or pos_from_jmdict(word, reading, jm)
        pos_src = changed_src if "pos" in fx else "jmdict"
        if pos_code is None:
            pos_code, pos_src = guess_pos(word), "ai-draft"
        kanji = normalize_slots(word) if KANJI.search(word) else None
        han_viet, hv_prov = derive_han_viet(word, char_hv) if kanji else (None, None)
        tr = next((t.strip("()（）") for t in r.tags), None)
        meaning = normalize_slots(meaning if "meaning" in fx else clean_meaning(meaning, word))
        out.append(
            VocabEntry(
                id=f"n3-{r.no:03d}",
                legacy_id=f"n3cb-{r.no}",
                book="n3",
                lesson=r.lesson,
                kana=normalize_slots(reading),
                kanji=kanji,
                display="kanji" if kanji else "kana",
                han_viet=han_viet,
                meaning_vi=meaning,
                senses=split_senses(meaning),
                pos=PartOfSpeech.of(pos_code),
                kanji_refs=[f"k-{c}" for c in dict.fromkeys(cjk_chars(kanji or ""))],
                same_word=[],
                examples=[
                    VocabExample(
                        id=f"n3-{r.no:03d}-e{k}", ruby=ru, vi=vi, max_lesson=r.lesson,
                        source="ai-draft", review="user" if by == "user" else "auto",
                    )
                    for k, (ru, vi, by) in enumerate((examples or {}).get(r.no, []), 1)
                ],
                particle=fx.get("particle", r.particle),
                transitivity=tr,
                variants=r.variants,
                antonyms=[i.text for i in r.items if i.kind == "antonym"],
                related=[i.text for i in r.items if i.kind == "note"],
                provenance=VocabProvenance(
                    kanji="source" if kanji else None,
                    han_viet=hv_prov if han_viet else None,  # type: ignore[arg-type]
                    pos=pos_src,  # type: ignore[arg-type]
                    meaning=changed_src if "meaning" in fx else "source",  # type: ignore[arg-type]
                ),
                review="user" if (fx and fix_by == "user") else ("ai" if fx else "auto"),
            )
        )
    return out, warnings
