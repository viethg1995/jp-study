"""Bổ sung tự động (0 token) cho từ vựng: ID chuẩn, kanji, âm Hán-Việt, kanji_refs.

Nguyên tắc (CLAUDE.md rule 5): chỉ điền khi suy ra được DUY NHẤT một đáp án từ nguồn;
còn lại gắn cờ + liệt kê ứng viên để người/AI duyệt, không đoán.
"""

from __future__ import annotations

import re
import unicodedata
from collections import Counter, defaultdict
from typing import Literal

from pydantic import BaseModel

from jp_pipeline.dictionaries import JmEntry, KanjiInfo, nfc

KanjiSource = Literal["source", "jmdict"]
HanVietSource = Literal["source", "derived", "unihan", "mixed"]


class SourceVocab(BaseModel):
    """Một dòng trong sources/vocabulary/bai_*.json (định dạng gốc)."""

    id: str
    jp: str
    kanji: str | None
    kanji_vn: str | None
    vn: str
    type: str
    type_code: str


class KanjiCandidate(BaseModel):
    kanji: str
    gloss: str  # nghĩa tiếng Anh từ JMdict, giúp người duyệt chọn


class AutoVocab(BaseModel):
    id: str  # mn-01-003
    legacy_id: str  # lesson1_3
    lesson: int
    kanji: str | None
    kanji_source: KanjiSource | None
    display: Literal["kanji", "kana"]
    han_viet: str | None
    han_viet_source: HanVietSource | None
    kanji_refs: list[str]
    kanji_gloss: str | None = None  # nghĩa EN (JMdict) của kanji được bổ sung — để đối chiếu với vn
    han_viet_original: str | None = None  # kanji_vn gốc bị loại vì lỗi scrape (để đối chiếu)
    pos_suggested: str | None = None  # mã từ loại đề xuất (khác gốc) — cần duyệt
    pos_reason: str | None = None
    flags: list[str]
    kanji_candidates: list[KanjiCandidate] = []
    han_viet_candidates: dict[str, list[str]] = {}  # chữ → các âm có thể


# ---------------------------------------------------------------- tiện ích

_LEGACY_ID = re.compile(r"lesson(\d+)_(\d+)")
_CJK = re.compile(r"[㐀-鿿豈-﫿々]")
_HIRA = re.compile(r"^[ぁ-ゟ]+$")
_KATA = re.compile(r"^[゠-ヿー・\s]+$")
_DECOR = re.compile(r"[～〜~―\s]")

GODAN_I_TO_U = dict(zip("いきぎしちにびみり", "うくぐすつぬぶむる", strict=True))

# type_code → từ khóa POS trong JMdict (khớp chuỗi con, không phân biệt hoa thường)
POS_KEYWORDS: dict[str, tuple[str, ...]] = {
    "N": ("noun",),
    "PN": ("noun",),
    "Pro": ("pronoun",),
    "QW": ("pronoun", "adverb", "noun"),
    "QP": ("pronoun", "adverb", "noun"),
    "Greet": ("expression", "interjection"),
    "Cnt": ("counter", "suffix"),
    "V1": ("godan",),
    "V2": ("ichidan",),
    "V3": ("suru", "kuru"),
    "Ai": ("adjective (keiyoushi)",),
    "An": ("adjectival nouns",),
    "Ana": ("adjectival nouns",),
    "Adv": ("adverb",),
    "Suf": ("suffix", "counter"),
    "Pre": ("prefix",),
    "Conv": ("expression", "interjection"),
    "Int": ("interjection",),
    "Exp": ("expression",),
    "Conj": ("conjunction",),
    "Phr": ("expression",),
}


def new_id(legacy_id: str) -> tuple[str, int]:
    m = _LEGACY_ID.fullmatch(legacy_id)
    if not m:
        raise ValueError(f"legacy id không đúng dạng lessonN_M: {legacy_id!r}")
    lesson, idx = int(m.group(1)), int(m.group(2))
    return f"mn-{lesson:02d}-{idx:03d}", lesson


def cjk_chars(text: str) -> list[str]:
    """Các chữ Hán trong chuỗi; 々 được thay bằng chữ đứng trước."""
    out: list[str] = []
    for c in _CJK.findall(text):
        out.append(out[-1] if c == "々" and out else c)
    return out


def normalize_kana(jp: str) -> str:
    return nfc(_DECOR.sub("", jp))


def masu_to_dict(kana: str, type_code: str) -> tuple[str, str] | None:
    """'かかります' (V1) → ('かかる', 'ります'): (dạng từ điển, đuôi ます thay cho đuôi từ điển)."""
    if not kana.endswith("ます") or len(kana) < 3:
        return None
    stem = kana[:-2]
    codes = set(type_code.split("/"))
    if "V2" in codes:
        return stem + "る", "ます"
    if "V1" in codes and stem[-1] in GODAN_I_TO_U:
        return stem[:-1] + GODAN_I_TO_U[stem[-1]], stem[-1] + "ます"
    if "V3" in codes:
        if stem == "し":
            return "する", "します"
        if stem == "き":
            return "くる", "きます"
        if stem.endswith("し"):  # べんきょうします → べんきょう (danh từ する)
            return stem[:-1], "します"
    return None


def pos_keys(type_code: str) -> list[str]:
    return [k for code in type_code.split("/") for k in POS_KEYWORDS.get(code, ())]


def pos_match(entry: JmEntry, type_code: str) -> bool:
    keys = pos_keys(type_code)
    if not keys:
        return False  # type_code lạ → không đủ căn cứ để chọn kanji
    text = " | ".join(entry.pos).lower()
    return any(k in text for k in keys)


# ---------------------------------------------------------------- kanji


def suggest_kanji(
    jp: str, type_code: str, jmdict: dict[str, list[JmEntry]]
) -> tuple[KanjiCandidate | None, list[KanjiCandidate], bool]:
    """→ (kanji + nghĩa EN nếu duy nhất, ứng viên nếu nhập nhằng, uk của entry được chọn)."""
    kana = normalize_kana(jp)
    if not _HIRA.match(kana) or not pos_keys(type_code):
        return None, [], False

    conv = masu_to_dict(kana, type_code)
    lookup, masu_tail = conv if conv else (kana, "")

    entries = [e for e in jmdict.get(lookup, []) if e.kanji and pos_match(e, type_code)]
    commons = [e for e in entries if e.common]
    pool = commons or entries
    # gộp entry trùng dạng kanji chính
    by_form: dict[str, JmEntry] = {}
    for e in pool:
        by_form.setdefault(e.kanji[0], e)

    def to_masu(form: str) -> str:
        """Dạng từ điển (kanji) → dạng ます như giáo trình: 掛かる→掛かります, 勉強→勉強します."""
        if not conv:
            return form
        if lookup == "くる":
            return form[:-1] + "ます"  # 来る → 来ます
        if masu_tail == "します" and lookup != "する":
            return form + "します"  # danh từ する
        return form[:-1] + masu_tail  # đổi kana đuôi (る/く/す… hoặc する→します)

    if len(by_form) == 1:
        e = next(iter(by_form.values()))
        return KanjiCandidate(kanji=to_masu(e.kanji[0]), gloss="; ".join(e.gloss[:2])), [], e.uk
    cands = [
        KanjiCandidate(kanji=to_masu(f), gloss="; ".join(e.gloss[:2])) for f, e in by_form.items()
    ][:5]
    return None, cands, False


# ---------------------------------------------------------------- từ loại

_KANA_ONLY = re.compile(r"^[ぁ-ゟ゠-ヿー・]+$")
_VERB_GROUP_BY_POS = (("ichidan", "V2"), ("godan", "V1"), ("kuru", "V3"), ("suru", "V3"))


def _verb_groups(entries: list[JmEntry], kanji: str | None) -> set[str]:
    """Nhóm động từ theo JMdict của các entry khớp (nếu có kanji: chữ Hán đầu phải trùng)."""
    first = (cjk_chars(kanji) or [None])[0] if kanji else None
    out: set[str] = set()
    for e in entries:
        if first and not any(first in k for k in e.kanji):
            continue
        text = " | ".join(e.pos).lower()
        for key, group in _VERB_GROUP_BY_POS:
            if key in text:
                out.add(group)
                break
    return out


def suggest_pos(row: SourceVocab, jmdict: dict[str, list[JmEntry]]) -> tuple[str | None, str | None]:
    """Đề xuất sửa từ loại gốc (chỉ khi có căn cứ JMdict) → (mã mới, lý do)."""
    code = row.type_code
    kana = normalize_kana(row.jp)

    # 1. "PN" nhưng JMdict ghi là danh từ thông dụng → N (tên nước/công ty sẽ được duyệt lại)
    if code == "PN" and _KANA_ONLY.match(kana):
        for e in jmdict.get(kana, []):
            if e.common and any("noun (common)" in p for p in e.pos):
                return "N", f"JMdict: danh từ thông dụng ({'; '.join(e.gloss[:2])})"
        return None, None

    # 2. Động từ: kiểm tra nhóm qua dạng từ điển godan / ichidan / する
    if code in ("V1", "V2", "V3") and kana.endswith("ます") and len(kana) > 2:
        stem = kana[:-2]
        groups: set[str] = set()
        if stem in ("き",):
            groups.add("V3")
        if stem.endswith("し") and len(stem) > 1:  # danh từ + します
            noun = stem[:-1]
            if any("suru" in " | ".join(e.pos).lower() for e in jmdict.get(noun, [])):
                groups.add("V3")
        ichidan = stem + "る"
        groups |= {g for g in _verb_groups(jmdict.get(ichidan, []), row.kanji) if g == "V2"}
        if stem[-1] in GODAN_I_TO_U:
            godan = stem[:-1] + GODAN_I_TO_U[stem[-1]]
            groups |= {g for g in _verb_groups(jmdict.get(godan, []), row.kanji) if g == "V1"}
        if stem == "し":
            groups = {"V3"}
        if len(groups) == 1 and code not in groups:
            new = groups.pop()
            return new, f"JMdict: dạng từ điển thuộc {POS_GROUP_NAME[new]}"
    return None, None


POS_GROUP_NAME = {"V1": "nhóm 1 (godan)", "V2": "nhóm 2 (ichidan)", "V3": "nhóm 3 (する/くる)"}


# ---------------------------------------------------------------- Hán-Việt


_GLUED = re.compile(r"[AEIOUY][^AEIOUY]+[AEIOUY]")


_IY = re.compile(r"\b([KLM])I([̣̀́̃̉]?)\b")


def normalize_han_viet(hv: str | None) -> str | None:
    """Thống nhất i/y theo quy ước của dữ liệu: sau K/L/M viết 'y' (LÍ→LÝ, MĨ→MỸ, KÌ→KỲ).

    Không đụng SĨ, TI, TỊ, HI… (cách viết chuẩn). Trả về NFC, viết hoa giữ nguyên.
    """
    if not hv:
        return hv
    nfd = _IY.sub(r"\1Y\2", unicodedata.normalize("NFD", hv))
    # Dấu kiểu cũ → kiểu đang dùng: HOÀ→HÒA, TOẠ→TỌA, THUỶ→THỦY, KHOẺ→KHỎE (không đụng QUÁ, QUÝ, GIÀ)
    nfd = _OLD_TONE.sub(r"\1\3\2", nfd)
    return unicodedata.normalize("NFC", nfd)


_OLD_TONE = re.compile(r"(?<![Q])([OU])([AEY])([̣̀́̃̉])(?![A-ZĐ̀-ͯ])")


def is_glued(token: str) -> bool:
    """'GIÁNGVŨ', 'THÔNGĐẠO' = 2 âm tiết dính liền (lỗi scrape).

    Một âm tiết tiếng Việt chỉ có MỘT cụm nguyên âm (phụ âm cuối: c ch m n ng nh p t),
    nên mẫu nguyên âm–phụ âm–nguyên âm (sau khi bỏ dấu) nghĩa là có 2 âm tiết.
    """
    base = "".join(c for c in unicodedata.normalize("NFD", token.upper()) if not unicodedata.combining(c))
    return bool(_GLUED.search(base))


def _hv_tokens(kanji_vn: str) -> list[str] | None:
    if any(c in kanji_vn for c in "/()"):
        return None
    toks = [t for t in re.split(r"[\s、,~～]+", kanji_vn.strip()) if t]
    if any(is_glued(t) for t in toks):
        return None
    return toks or None


_ALT_SEP = re.compile(r"[,、/]")


def kanji_forms(kanji: str) -> list[str]:
    """'暑い, 熱い' → ['暑い', '熱い']; '夫 /主人' → ['夫', '主人']."""
    return [f.strip() for f in _ALT_SEP.split(kanji) if f.strip()]


def source_han_viet_valid(kanji: str, kanji_vn: str) -> bool:
    """kanji_vn gốc có khớp với kanji không (số âm = số chữ Hán).

    Hợp lệ khi một trong các trường hợp:
      - nhiều dạng kanji ↔ cùng số nhóm âm, từng cặp khớp ('暑い, 熱い' ↔ 'THỬ, NHIỆT');
      - một dạng kanji, có ít nhất một phương án khớp ('住' ↔ 'TRÚ, TRỤ'; '時間' ↔ 'THÌ/THỜI GIAN').
    Không hợp lệ: 'HƯUHỘI XÃ' cho 休みます (dính âm của từ trong cụm ví dụ khi scrape).
    """
    forms = kanji_forms(kanji)
    if any(is_glued(t) for t in re.split(r"[\s,、/()~～]+", kanji_vn) if t):
        return False
    text = re.sub(r"\([^)]*\)|[~～]", " ", kanji_vn)
    groups = [g.split() for g in _ALT_SEP.split(text) if g.strip()]
    counts = [len(cjk_chars(f)) for f in forms]
    if not groups or not any(counts):
        return False
    if len(forms) > 1 and len(groups) == len(forms):
        return all(len(g) == n for g, n in zip(groups, counts, strict=True))
    return len(forms) == 1 and any(len(g) == counts[0] for g in groups)


def learn_han_viet(rows: list[SourceVocab]) -> dict[str, Counter[str]]:
    """Học bảng chữ → âm Hán-Việt từ các mục đã có cả kanji và kanji_vn (khớp số lượng)."""
    votes: dict[str, Counter[str]] = defaultdict(Counter)
    for r in rows:
        if not r.kanji or not r.kanji_vn:
            continue
        chars = cjk_chars(r.kanji)
        toks = _hv_tokens(nfc(r.kanji_vn))
        if toks and len(toks) == len(chars):
            for c, t in zip(chars, toks, strict=True):
                votes[c][t.upper()] += 1
    return votes


def resolve_han_viet(
    chars: list[str], learned: dict[str, Counter[str]], unihan: dict[str, list[str]]
) -> tuple[str | None, HanVietSource | None, dict[str, list[str]]]:
    parts: list[str] = []
    used: set[str] = set()
    ambiguous: dict[str, list[str]] = {}
    for c in chars:
        if c in learned:
            (top, n), *rest = learned[c].most_common()
            if rest and rest[0][1] == n:  # hòa phiếu → nhập nhằng
                ambiguous[c] = [t for t, _ in learned[c].most_common(4)]
            parts.append(top)
            used.add("derived")
        elif len(unihan.get(c, [])) == 1:
            parts.append(unihan[c][0].upper())
            used.add("unihan")
        else:
            ambiguous[c] = [v.upper() for v in unihan.get(c, [])]
            parts.append("?")
    if ambiguous or not parts:
        return None, None, ambiguous
    src: HanVietSource = "mixed" if len(used) > 1 else used.pop()  # type: ignore[assignment]
    return " ".join(parts), src, {}


# ---------------------------------------------------------------- tổng hợp


def enrich_entry(
    row: SourceVocab,
    jmdict: dict[str, list[JmEntry]],
    kanjidic: dict[str, KanjiInfo],
    learned: dict[str, Counter[str]],
    unihan: dict[str, list[str]],
) -> AutoVocab:
    vid, lesson = new_id(row.id)
    flags: list[str] = []
    kanji, ksrc, cands = row.kanji, ("source" if row.kanji else None), []
    display: Literal["kanji", "kana"] = "kanji" if row.kanji else "kana"

    gloss: str | None = None
    if not kanji and not _KATA.match(normalize_kana(row.jp)):
        picked, cands, uk = suggest_kanji(row.jp, row.type_code, jmdict)
        if picked:
            kanji, gloss, ksrc = picked.kanji, picked.gloss, "jmdict"
            flags.append("kanji_verify")  # nghĩa chưa được đối chiếu với vn
            if uk:
                flags.append("kana_usually")  # JMdict: thường viết kana → giữ display=kana
        elif cands:
            flags.append("kanji_ambiguous")

    chars = cjk_chars(kanji or "")
    missing = sorted({c for c in chars if c not in kanjidic})
    if missing:
        flags.append("kanji_not_in_kanjidic:" + "".join(missing))

    hv, hsrc, hv_cands = (nfc(row.kanji_vn).upper(), "source", {}) if row.kanji_vn else (None, None, {})
    hv_original: str | None = None
    if hv and not row.kanji:
        # gốc không có kanji → kanji_vn gốc thuộc từ khác trong cụm ví dụ (vd 道が空きます → ĐẠO)
        hv_original, hv, hsrc = hv, None, None
        flags.append("han_viet_source_fixed")
    elif hv and kanji and not source_han_viet_valid(kanji, hv):
        hv_original, hv, hsrc = hv, None, None  # lỗi scrape → tính lại theo từng dạng/chữ
        flags.append("han_viet_source_fixed")
    if not hv and chars:
        parts: list[str] = []
        srcs: set[str] = set()
        for form in kanji_forms(kanji or ""):
            fc = cjk_chars(form)
            if not fc:
                continue
            p, s, c = resolve_han_viet(fc, learned, unihan)
            hv_cands.update(c)
            if p:
                parts.append(p)
                srcs.add(str(s))
        if parts and not hv_cands:
            hv = ", ".join(parts)
            hsrc = "mixed" if len(srcs) > 1 or "mixed" in srcs else srcs.pop()  # type: ignore[assignment]
        if hv_cands:
            flags.append("han_viet_ambiguous")

    pos_new, pos_why = suggest_pos(row, jmdict)
    return AutoVocab(
        id=vid,
        legacy_id=row.id,
        lesson=lesson,
        kanji=kanji,
        kanji_source=ksrc,  # type: ignore[arg-type]
        display=display,
        han_viet=hv,
        han_viet_source=hsrc,  # type: ignore[arg-type]
        kanji_refs=[f"k-{c}" for c in dict.fromkeys(chars)],
        kanji_gloss=gloss,
        han_viet_original=hv_original,
        pos_suggested=pos_new,
        pos_reason=pos_why,
        flags=flags + (["pos_verify"] if pos_new else []),
        kanji_candidates=cands,
        han_viet_candidates=hv_cands,
    )
