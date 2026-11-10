"""Câu ví dụ cho từ vựng: parse cú pháp ruby + kiểm tra tự động (0 token).

Cú pháp:  {漢字|かな} = chữ có furigana;  [[…]] = từ đang học (đúng 1 lần).
  vd: [[{私|わたし}]]は{学生|がくせい}です。

Kiểm tra:
  E  lỗi    — cú pháp sai, kanji nằm ngoài {…|…}, không có [[…]], từ đang học không khớp
  W  cảnh báo — furigana khác cách đọc của Sudachi; có từ ngoài phạm vi bài ≤ max_lesson
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from functools import lru_cache

from pydantic import BaseModel

from jp_pipeline.transform.vocab_auto import masu_to_dict

_CJK = re.compile(r"[㐀-鿿豈-﫿々]")
_TOKEN = re.compile(r"\[\[|\]\]|\{([^{}|]+)\|([^{}|]+)\}|([^\[\]{}]+)")
_PUNCT = re.compile(r"[\s、。，．・！？!?「」『』（）()〜～ー―…,.]")
# Cụm hội thoại/chào hỏi trọn câu (はじめまして, いいですね) — bản thân đã là câu, không cần ví dụ.
# KHÔNG bỏ qua "PN": dữ liệu gốc gán nhầm PN cho danh từ thông dụng (ノート, コーヒー, くに, かいしゃ…).
# Conv có "～" là mẫu có chỗ điền (この～, どんな～) → vẫn cần ví dụ.
SKIP_POS_CODES = {"Conv", "Greet"}


def needs_example(pos_code: str, kana: str) -> bool:
    codes = set(pos_code.split("/"))
    return not (codes & SKIP_POS_CODES) or any(c in kana for c in "～〜~")


@dataclass(frozen=True)
class Segment:
    text: str
    reading: str | None  # None = text không có furigana (kana/ký hiệu)
    target: bool


class RubyError(ValueError):
    pass


def parse_ruby(ruby: str) -> list[Segment]:
    segs: list[Segment] = []
    in_target = False
    targets = 0
    pos = 0
    for m in _TOKEN.finditer(ruby):
        if m.start() != pos:
            raise RubyError(f"ký tự không hợp lệ tại vị trí {pos}: {ruby[pos:m.start()]!r}")
        pos = m.end()
        tok = m.group(0)
        if tok == "[[":
            if in_target:
                raise RubyError("[[ lồng nhau")
            in_target, targets = True, targets + 1
        elif tok == "]]":
            if not in_target:
                raise RubyError("]] không có [[ mở")
            in_target = False
        elif m.group(1) is not None:
            segs.append(Segment(m.group(1), m.group(2), in_target))
        else:
            segs.append(Segment(tok, None, in_target))
    if pos != len(ruby):
        raise RubyError(f"ký tự thừa ở cuối: {ruby[pos:]!r}")
    if in_target:
        raise RubyError("thiếu ]]")
    if targets != 1:
        raise RubyError(f"cần đúng 1 cặp [[…]], có {targets}")
    for s in segs:
        if s.reading is None and _CJK.search(s.text):
            raise RubyError(f"kanji không có furigana: {s.text!r} — viết {{{s.text}|…}}")
        if s.reading is not None and _CJK.search(s.reading):
            raise RubyError(f"furigana chứa kanji: {s.reading!r}")
    return segs


def surface(segs: list[Segment]) -> str:
    return "".join(s.text for s in segs)


def kata_to_hira(s: str) -> str:
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s)


def reading_of(segs: list[Segment]) -> str:
    return "".join(s.reading or s.text for s in segs)


def norm_kana(s: str) -> str:
    return _PUNCT.sub("", kata_to_hira(unicodedata.normalize("NFKC", s)))


# ---------------------------------------------------------------- Sudachi


@lru_cache(maxsize=1)
def _tokenizer():  # type: ignore[no-untyped-def]
    from sudachipy import Dictionary, SplitMode

    d = Dictionary(dict="core")
    return d.tokenizer(mode=SplitMode.C) if hasattr(d, "tokenizer") else d.create(SplitMode.C)


@dataclass(frozen=True)
class Morph:
    surface: str
    reading: str  # hiragana
    lemma: str
    pos: tuple[str, ...]
    oov: bool = False  # Sudachi không có trong từ điển (thường là tên riêng)


def analyze(text: str) -> list[Morph]:
    return [
        Morph(
            m.surface(),
            kata_to_hira(m.reading_form()),
            m.dictionary_form(),
            tuple(m.part_of_speech()),
            bool(m.is_oov()),
        )
        for m in _tokenizer().tokenize(text)
    ]


_KATA_ONLY = re.compile(r"^[゠-ヿー・]+$")
_ALNUM_ONLY = re.compile(r"^[A-Za-z0-9Ａ-Ｚａ-ｚ０-９]+$")
NAME_SUFFIXES = {"さん", "ちゃん", "くん", "先生", "様", "さま"}


def _covered_spans(text: str, known: set[str]) -> set[int]:
    """Vị trí ký tự nằm trong một từ đã biết dài ≥ 2 (vd あの人, さくら大学) — Sudachi
    có thể tách các từ này thành nhiều mảnh (あの + 人)."""
    covered: set[int] = set()
    for form in known:
        if len(form) < 2:
            continue
        start = text.find(form)
        while start != -1:
            covered.update(range(start, start + len(form)))
            start = text.find(form, start + 1)
    return covered


def _is_known_compound(s: str, known: set[str]) -> bool:
    """イギリス人 = katakana (tên nước) + hậu tố đã biết (人)."""
    return any(
        s[i:] in known and (_KATA_ONLY.match(s[:i]) or s[:i] in known) for i in range(1, len(s))
    )


CONTENT_POS = {"名詞", "動詞", "形容詞", "形状詞", "副詞", "代名詞", "連体詞", "接続詞", "感動詞"}
# Danh từ hình thức / ngữ pháp (ことができます, つもり, はず…) — không tính là từ vựng
GRAMMAR_WORDS = {
    "こと", "つもり", "はず", "ため", "よう", "まま", "ほう", "わけ", "の", "ん",
    "とおり", "しれ",  # V たとおりに、かもしれません
}
IGNORE_POS2 = {"数詞", "固有名詞", "非自立可能"}  # số, tên riêng, động từ phụ (ある/いる/する…)


# ---------------------------------------------------------------- từ vựng đã biết


def _strip_decor(s: str) -> str:
    s = re.sub(r"[～〜~―\s\[\]［］]", "", s)
    return re.sub(r"^[ー－\-]+", "", s)  # 'ー年', '－歳': dấu gạch đầu từ (chỗ điền số)


def loose_kana(s: str) -> str:
    """Bỏ dakuten/handakuten để chấp nhận biến âm sau số: ３階 さんがい, １０分 じゅっぷん."""
    return "".join(c for c in unicodedata.normalize("NFD", norm_kana(s)) if c not in "゙゚")


def word_forms(kana: str, kanji: str | None, pos_code: str) -> set[str]:
    """Các dạng để so khớp: kana, kanji, dạng từ điển (động từ ます → る/う)."""
    forms: set[str] = set()
    for raw in [*re.split(r"[/／]", kana), *(re.split(r"[,、/／]", kanji) if kanji else [])]:
        f = _strip_decor(unicodedata.normalize("NFKC", raw))
        if not f:
            continue
        forms.add(f)
        forms |= _dict_forms(f, pos_code)
    return {kata_to_hira(x) for x in forms} | forms


def _dict_forms(masu: str, pos_code: str) -> set[str]:
    """起きます→起きる, 行きます→行く, 勉強します→勉強/勉強する, 来ます→来る (cả kana lẫn kanji)."""
    if not masu.endswith("ます") or len(masu) < 3:
        return set()
    # Nhóm động từ trong dữ liệu gốc đôi khi sai (借ります ghi V1, 貸します ghi V3) → sinh
    # thêm dạng của nhóm lân cận; chỉ dùng để nhận diện "từ đã biết" nên dư một chút không sao.
    codes = set(pos_code.split("/"))
    stem = masu[:-2]  # bỏ ます
    out: set[str] = set()
    conv = masu_to_dict(kata_to_hira(masu), "V1")  # kana đuôi う-段 nếu là godan
    if codes & {"V1", "V2", "V3"}:
        out.add(stem + "る")  # ichidan
        if conv:
            out.add(stem[:-1] + conv[0][-1])  # godan
    if "V3" in codes:
        if stem.endswith("し"):
            base = stem[:-1]
            out |= {base + "する", base} if base else {"する"}
        if stem in ("き", "来"):
            out |= {"くる", "来る"}
    return out


# type_code của từ vựng → nhóm từ loại Sudachi tương thích (để gợi ý kanji không nhầm đồng âm)
_POS_COMPAT: dict[str, set[str]] = {
    "V1": {"動詞"}, "V2": {"動詞"}, "V3": {"動詞", "名詞"},
    "N": {"名詞", "代名詞"}, "PN": {"名詞"}, "Pro": {"代名詞", "名詞"},
    "Ai": {"形容詞"}, "An": {"形状詞", "名詞"}, "Ana": {"形状詞", "名詞"},
    "Adv": {"副詞", "名詞"}, "QW": {"代名詞", "副詞", "名詞"}, "QP": {"代名詞", "副詞", "名詞"},
    "Suf": {"名詞", "接尾辞"}, "Cnt": {"名詞", "接尾辞"},
}


def pos_compatible(type_code: str, sudachi_pos0: str) -> bool:
    groups = [_POS_COMPAT.get(c) for c in type_code.split("/")]
    known = [g for g in groups if g is not None]
    return not known or any(sudachi_pos0 in g for g in known)


# ---------------------------------------------------------------- kiểm tra 1 câu


def vocab_readings(entries: list[tuple[str, str | None]]) -> dict[str, set[str]]:
    """(kana, kanji) của bộ từ vựng → {dạng kanji: {cách đọc}} để chấp nhận cách đọc hợp lệ
    khác Sudachi (vd 私 = わたし, Sudachi mặc định わたくし)."""
    out: dict[str, set[str]] = {}
    for kana, kanji in entries:
        if not kanji:
            continue
        for form in re.split(r"[,、/]", kanji):
            f, k = _strip_decor(form), _strip_decor(kana)
            if f and k:
                out.setdefault(f, set()).add(kata_to_hira(k))
    return out


def kana_to_kanji_map(entries: list[tuple[str, str | None, str]]) -> dict[str, list[tuple[str, set[str]]]]:
    """(kana, kanji, pos) của bộ từ vựng → {dạng kana: [(type_code, {dạng kanji})]} kể cả dạng
    từ điển của động từ (おきる → 起きる). Dùng để bắt từ viết kana trong câu khi đã có kanji."""
    out: dict[str, list[tuple[str, set[str]]]] = {}
    for kana, kanji, pos in entries:
        if not kanji or not _CJK.search(kanji):
            continue
        forms = word_forms(kana, kanji, pos)
        kanji_forms = {f for f in forms if _CJK.search(f)}
        for f in forms:
            if not _CJK.search(f) and len(f) >= 2:
                out.setdefault(kata_to_hira(f), []).append((pos, kanji_forms))
    return out


def _regions(segs: list[Segment], morphs: list[Morph]) -> list[tuple[str, str, str]]:
    """Chia câu thành các vùng mà ranh giới segment ruby và ranh giới từ Sudachi trùng nhau.
    → [(chữ, cách đọc của ta, cách đọc Sudachi)]"""
    def bounds(lengths: list[int]) -> list[int]:
        out, acc = [], 0
        for n in lengths:
            acc += n
            out.append(acc)
        return out

    sb = bounds([len(s.text) for s in segs])
    mb = set(bounds([len(m.surface) for m in morphs]))
    common = [b for b in sb if b in mb]
    regions: list[tuple[str, str, str]] = []
    si = mi = start = 0
    for end in common:
        ours = theirs = text = ""
        while si < len(segs) and sum(len(s.text) for s in segs[: si + 1]) <= end:
            text += segs[si].text
            ours += segs[si].reading or segs[si].text
            si += 1
        while mi < len(morphs) and sum(len(m.surface) for m in morphs[: mi + 1]) <= end:
            theirs += morphs[mi].reading
            mi += 1
        regions.append((text, ours, theirs))
        start = end
    _ = start
    return regions


def slot_pattern_match(kana: str, surface: str, reading: str) -> bool:
    """Mẫu có ～ → regex, ～ = chuỗi bất kỳ: 'こちらは～さんです' khớp 'こちらはミラーさんです'."""
    if not re.search(r"[～〜~]", kana):
        return False
    parts = [_strip_decor(p) for p in re.split(r"[～〜~]", kana) if _strip_decor(p)]
    if not parts:
        return False
    rx = re.compile(".*".join(re.escape(kata_to_hira(p)) for p in parts))
    return bool(rx.search(kata_to_hira(surface)) or rx.search(kata_to_hira(reading)))


class ExampleIssue(BaseModel):
    level: str  # "E" | "W"
    msg: str


def check_example(
    ruby: str,
    target_forms: set[str],
    known: set[str],
    readings: dict[str, set[str]] | None = None,
    target_kanji: str | None = None,
    kana_to_kanji: dict[str, list[tuple[str, set[str]]]] | None = None,
    target_kana: str | None = None,
) -> list[ExampleIssue]:
    issues: list[ExampleIssue] = []
    try:
        segs = parse_ruby(ruby)
    except RubyError as exc:
        return [ExampleIssue(level="E", msg=f"cú pháp: {exc}")]

    text = surface(segs)
    target_surface = unicodedata.normalize("NFKC", "".join(s.text for s in segs if s.target))
    target_reading = "".join(s.reading or s.text for s in segs if s.target)
    stems = {f[:-2] if f.endswith("ます") else f[:-1] if f.endswith("い") and len(f) > 2 else f for f in target_forms}
    stems = {s for s in stems if s}
    # thể て/た của godan biến âm (急ぎます → 急いで) → so thêm dạng từ điển Sudachi của phần [[…]]
    target_lemmas = {m.lemma for m in analyze(target_surface)} if target_surface else set()
    lemma_hit = bool(target_lemmas & target_forms) or any(
        kata_to_hira(lem) in target_forms for lem in target_lemmas
    )
    # Mẫu có chỗ điền ở giữa: 'こちらは～さんです' khớp 'こちらはミラーさんです'
    slot_hit = bool(target_kana) and slot_pattern_match(str(target_kana), target_surface, target_reading)
    if not lemma_hit and not slot_hit and not any(
        target_surface.startswith(s) or target_reading.startswith(s) for s in stems
    ):
        issues.append(ExampleIssue(level="E", msg=f"[[{target_surface}]] không khớp từ đang học {sorted(target_forms)[:3]}"))
    if target_kanji and _CJK.search(target_kanji) and not _CJK.search(target_surface):
        issues.append(
            ExampleIssue(level="E", msg=f"[[{target_surface}]] phải viết bằng kanji + furigana: {target_kanji}")
        )

    morphs = analyze(text)
    rd = readings or {}
    diffs: list[str] = []
    for chunk, ours, theirs in _regions(segs, morphs):
        if not _CJK.search(chunk) or loose_kana(ours) == loose_kana(theirs):
            continue
        # cách đọc hợp lệ theo bộ từ vựng (vd 私=わたし); cho phép kèm okurigana/trợ từ phía sau
        ok = any(
            chunk.startswith(form) and norm_kana(ours).startswith(norm_kana(r))
            for form, rs in rd.items()
            for r in rs
            if _CJK.search(form)
        )
        if not ok:
            diffs.append(f"{chunk}: {norm_kana(ours)}≠{norm_kana(theirs)}")
    if diffs:
        issues.append(ExampleIssue(level="W", msg="furigana khác Sudachi — " + "; ".join(diffs)))

    # Mọi từ có kanji trong bộ từ vựng phải viết kanji + furigana (không chỉ từ đang học)
    k2k = kana_to_kanji or {}
    kana_words: list[str] = []
    pos_ = 0
    t_start = text.find(target_surface)
    for i_m, m in enumerate(morphs):
        start, pos_ = pos_, pos_ + len(m.surface)
        if t_start <= start < t_start + len(target_surface) or _CJK.search(m.surface):
            continue
        prev = morphs[i_m - 1] if i_m > 0 else None
        if m.surface in GRAMMAR_WORDS or (
            prev is not None and prev.surface == "と" and m.lemma in ("言う", "いう")
        ):
            continue  # ～という (ngữ pháp, quy ước viết kana)
        if m.surface == "ところ" and prev is not None and prev.pos[0] in ("動詞", "助動詞"):
            continue  # V るところです/V たところです (ngữ pháp) ≠ 所 (nơi chốn)
        if m.pos[0] not in CONTENT_POS or m.pos[1] in IGNORE_POS2 or m.pos[0] == "感動詞":
            continue  # thán từ (はい, いいえ) không viết kanji dù đồng âm (はい ≠ 杯)
        cands_k = k2k.get(kata_to_hira(m.surface), []) + k2k.get(kata_to_hira(m.lemma), [])
        hits = {k for code, ks in cands_k if pos_compatible(code, m.pos[0]) for k in ks}
        # ngoại lệ: kana nằm trong một từ đã biết vốn viết kana ở phần đó (さくら大学, あの人)
        in_known_kana = any(
            len(f) > len(m.surface) and m.surface in f and 0 <= text.find(f) <= start < text.find(f) + len(f)
            for f in known
        )
        if hits and not in_known_kana:
            kana_words.append(f"{m.surface}→{'/'.join(sorted(hits)[:2])}")
    if kana_words:
        issues.append(ExampleIssue(level="E", msg="viết kanji + furigana: " + "、".join(kana_words)))

    unknown: list[str] = []
    tgt_start = text.find(target_surface)
    tgt_end = tgt_start + len(target_surface)
    covered = _covered_spans(text, known)
    offset = 0
    for idx, m in enumerate(morphs):
        start, offset = offset, offset + len(m.surface)
        if tgt_start <= start < tgt_end or all(i in covered for i in range(start, offset)):
            continue  # nằm trong từ đang học, hoặc trong một từ đã biết bị Sudachi tách
        if m.pos[0] not in CONTENT_POS or m.pos[1] in IGNORE_POS2:
            continue
        if m.oov or _ALNUM_ONLY.match(m.surface) or m.surface in GRAMMAR_WORDS:
            continue  # tên riêng lạ, ký hiệu ＩＭＣ, từ ngữ pháp (こと…)
        nxt = morphs[idx + 1].surface if idx + 1 < len(morphs) else ""
        if _KATA_ONLY.match(m.surface) and nxt in NAME_SUFFIXES:
            continue  # tên người: ミラーさん, ワット先生
        cands = {m.surface, m.lemma, kata_to_hira(m.surface), m.reading}
        if not cands & known and not _is_known_compound(m.surface, known):
            unknown.append(m.surface)
    if unknown:
        issues.append(ExampleIssue(level="W", msg=f"từ ngoài phạm vi bài: {'、'.join(dict.fromkeys(unknown))}"))
    return issues
