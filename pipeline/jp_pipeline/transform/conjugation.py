"""Chia thể động từ / tính từ / danh từ — lấy thể ます làm gốc (cách dạy ở VN).

Động từ: mọi thể suy từ thân ます (かき|ます) + nhóm V1/V2/V3. Từ N3 ghi thể từ điển → đổi về thân ます trước.
Tính từ い: gốc là dạng い (いい → よ- khi chia). Tính từ な / danh từ: gốc bỏ な.
Chỉ chia phần kana cuối; phần chữ Hán giữ nguyên → dạng chữ Hán suy ra từ dạng kana, rồi gắn furigana.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# âm hàng い → (hàng あ, hàng う, hàng え, hàng お)
_ROWS: dict[str, tuple[str, str, str, str]] = {
    "い": ("わ", "う", "え", "お"),
    "き": ("か", "く", "け", "こ"),
    "ぎ": ("が", "ぐ", "げ", "ご"),
    "し": ("さ", "す", "せ", "そ"),
    "ち": ("た", "つ", "て", "と"),
    "に": ("な", "ぬ", "ね", "の"),
    "び": ("ば", "ぶ", "べ", "ぼ"),
    "み": ("ま", "む", "め", "も"),
    "り": ("ら", "る", "れ", "ろ"),
}
_U_TO_I = {v[1]: k for k, v in _ROWS.items()}
_TE = {"い": "って", "ち": "って", "り": "って", "み": "んで", "び": "んで", "に": "んで",
       "き": "いて", "ぎ": "いで", "し": "して"}
# Kính ngữ: thân ます tận cùng い nhưng gốc là る (いらっしゃる) → chia như hàng ら, mệnh lệnh = thân ます
_HONORIFIC = ("いらっしゃい", "おっしゃい", "ください", "なさい", "ござい")

VERB_FORMS = ("masu", "masen", "mashita", "masendeshita", "mashou", "tai", "te", "nai", "nakatta", "dict",
              "ta", "tara", "potential", "volitional", "imperative", "prohibitive", "ba", "passive",
              "causative", "causative_passive")
ADJ_I_FORMS = ("plain", "desu", "neg", "neg_polite", "past", "past_polite", "past_neg", "past_neg_polite",
               "te", "adverb", "ba")
ADJ_NA_FORMS = ("da", "desu", "attributive", "neg", "neg_polite", "past", "past_polite", "past_neg",
                "past_neg_polite", "te", "adverb", "nara")
NOUN_FORMS = ADJ_NA_FORMS
FORMS_BY_GROUP = {"verb": VERB_FORMS, "adj-i": ADJ_I_FORMS, "adj-na": ADJ_NA_FORMS, "noun": NOUN_FORMS}
GROUP_OF_KIND = {"V1": "verb", "V2": "verb", "V3": "verb", "Ai": "adj-i", "An": "adj-na", "N": "noun"}

_CJK = "一-鿿㐀-䶿々〆ヶ"
_RUN = re.compile(f"[{_CJK}]+|[^{_CJK}]+")


@dataclass(frozen=True)
class Form:
    form: str
    kana: str
    kanji: str | None  # dạng có chữ Hán (None nếu từ viết kana)
    rule: str  # quy tắc đã áp dụng, vd "き → か + ない"
    irregular: bool


def to_ruby(kanji: str | None, kana: str) -> str | None:
    """'書きます' + 'かきます' → '{書|か}きます'. Không khớp → None."""
    if kanji is None:
        return kana
    parts = _RUN.findall(kanji)
    cjk = [bool(re.match(f"[{_CJK}]", p)) for p in parts]
    pattern = "".join("(.+?)" if c else re.escape(p) for p, c in zip(parts, cjk, strict=True))
    m = re.fullmatch(pattern, kana)
    if not m:
        return None
    out, g = [], 1
    for p, c in zip(parts, cjk, strict=True):
        if c:
            out.append(f"{{{p}|{m.group(g)}}}")
            g += 1
        else:
            out.append(p)
    return "".join(out)


def first_kanji(kanji: str | None) -> str | None:
    """'速い, 早い' / '治ります、直ります' → lấy cách viết đầu."""
    if kanji is None:
        return None
    return re.split(r"[,、]\s*", kanji)[0].strip() or None


def masu_stem(kind: str, kana: str, kanji: str | None, dictionary_form: bool) -> tuple[str, str | None]:
    """→ (thân ます kana, thân ます chữ Hán). Minna ghi thể ます; N3 ghi thể từ điển (さます 冷ます là thể từ điển!)."""
    if not dictionary_form:
        if not kana.endswith("ます"):
            raise ValueError(f"động từ không ở thể ます: {kana}")
        return kana[:-2], (kanji[:-2] if kanji and kanji.endswith("ます") else None)
    if kind == "V3":
        if kana.endswith("する"):
            return kana[:-2] + "し", (kanji[:-2] + "し" if kanji and kanji.endswith("する") else None)
        if kana.endswith("くる"):
            kj = None
            if kanji and kanji.endswith("来る"):
                kj = kanji[:-1]
            elif kanji and kanji.endswith("くる"):
                kj = kanji[:-2] + "き"
            return kana[:-2] + "き", kj
        raise ValueError(f"động từ nhóm 3 không tận cùng する/くる: {kana}")
    if kind == "V2":
        if not kana.endswith("る"):
            raise ValueError(f"động từ nhóm 2 không tận cùng る: {kana}")
        return kana[:-1], (kanji[:-1] if kanji and kanji.endswith("る") else None)
    if kind == "V1":
        last = kana[-1]
        if last not in _U_TO_I:
            raise ValueError(f"động từ nhóm 1 không tận cùng hàng う: {kana}")
        i = _U_TO_I[last]
        return kana[:-1] + i, (kanji[:-1] + i if kanji and kanji.endswith(last) else None)
    raise ValueError(f"không phải động từ: {kind}")


def _verb_kana(kind: str, stem: str) -> dict[str, tuple[str, str, bool]]:
    """thân ます kana → {form: (kana, quy tắc, bất quy tắc)}."""
    out: dict[str, tuple[str, str, bool]] = {}
    for f, end in (("masu", "ます"), ("masen", "ません"), ("mashita", "ました"),
                   ("masendeshita", "ませんでした"), ("mashou", "ましょう"), ("tai", "たい")):
        out[f] = (stem + end, f"thân ます + {end}", False)

    if kind == "V3":
        kuru = stem.endswith("き")
        p = stem[:-1]
        if kuru:
            table = {"te": "きて", "nai": "こない", "nakatta": "こなかった", "dict": "くる", "ta": "きた",
                     "tara": "きたら", "potential": "こられる", "volitional": "こよう", "imperative": "こい",
                     "prohibitive": "くるな", "ba": "くれば", "passive": "こられる", "causative": "こさせる",
                     "causative_passive": "こさせられる"}
            src = "きます"
        else:
            if not stem.endswith("し"):
                raise ValueError(f"động từ nhóm 3 không tận cùng します/きます: {stem}ます")
            table = {"te": "して", "nai": "しない", "nakatta": "しなかった", "dict": "する", "ta": "した",
                     "tara": "したら", "potential": "できる", "volitional": "しよう", "imperative": "しろ",
                     "prohibitive": "するな", "ba": "すれば", "passive": "される", "causative": "させる",
                     "causative_passive": "させられる"}
            src = "します"
        for f, v in table.items():
            out[f] = (p + v, f"{src} → {v}", True)
        return out

    if kind == "V2":
        for f, end in (("te", "て"), ("nai", "ない"), ("nakatta", "なかった"), ("dict", "る"), ("ta", "た"),
                       ("tara", "たら"), ("potential", "られる"), ("volitional", "よう"), ("imperative", "ろ"),
                       ("prohibitive", "るな"), ("ba", "れば"), ("passive", "られる"), ("causative", "させる"),
                       ("causative_passive", "させられる")):
            out[f] = (stem + end, f"thân ます + {end}", False)
        if stem == "くれ":
            out["imperative"] = ("くれ", "ngoại lệ: くれます → くれ", True)
        return out

    if kind != "V1":
        raise ValueError(f"không phải động từ: {kind}")
    honorific = stem.endswith(_HONORIFIC)
    i = "り" if honorific else stem[-1]
    if i not in _ROWS:
        raise ValueError(f"động từ nhóm 1: thân ます không tận cùng hàng い: {stem}ます")
    a, u, e, o = _ROWS[i]
    p = stem[:-1]
    shown = "い (gốc る)" if honorific else stem[-1]  # âm cuối thân ます như người học thấy

    def row(new: str, end: str) -> tuple[str, str, bool]:
        return (p + new + end, f"{shown} → {new} + {end}" if end else f"{shown} → {new}", honorific)

    te = _TE[i]
    ta = te[:-1] + ("だ" if te.endswith("で") else "た")
    iku = stem.endswith("いき") and not honorific
    if iku:
        te, ta = "って", "った"
    note = "ngoại lệ: いきます → いって" if iku else None
    out["te"] = (p + te, note or f"{shown} → {te}", iku or honorific)
    out["ta"] = (p + ta, note.replace("いって", "いった") if note else f"{shown} → {ta}", iku or honorific)
    out["tara"] = (p + ta + "ら", "thể た + ら", iku or honorific)
    out["nai"] = row(a, "ない")
    out["nakatta"] = row(a, "なかった")
    out["dict"] = row(u, "")
    out["potential"] = row(e, "る")
    out["volitional"] = row(o, "う")
    out["imperative"] = row(e, "")
    out["prohibitive"] = (p + u + "な", "thể từ điển + な", honorific)
    out["ba"] = row(e, "ば")
    out["passive"] = row(a, "れる")
    out["causative"] = row(a, "せる")
    out["causative_passive"] = row(a, "せられる") if i == "し" else row(a, "される")
    if honorific:  # kính ngữ: không dùng thể khả năng/ý định/bị động/sai khiến
        out["imperative"] = (stem, f"ngoại lệ: {stem}ます → {stem}", True)
        for f in ("potential", "volitional", "passive", "causative", "causative_passive"):
            del out[f]
    if stem == "あり":  # ある: phủ định là ない; không có thể khả năng/ý định/mệnh lệnh/bị động/sai khiến
        out["nai"] = ("ない", "ngoại lệ: あります → ない", True)
        out["nakatta"] = ("なかった", "ngoại lệ: あります → なかった", True)
        for f in ("mashou", "tai", "potential", "volitional", "imperative", "prohibitive", "passive",
                  "causative", "causative_passive"):
            del out[f]
    return out


# Động từ vốn mang nghĩa khả năng → không có thể khả năng (できる, わかる, みえる, きこえる)
_NO_POTENTIAL = ("でき", "わかり", "みえ", "きこえ")


def conjugate_verb(kind: str, kana_stem: str, kanji_stem: str | None) -> list[Form]:
    """Thân ます (kana + chữ Hán) → các thể. Dạng chữ Hán = phần chữ Hán giữ nguyên + đuôi kana mới."""
    forms = _verb_kana(kind, kana_stem)
    if kana_stem in _NO_POTENTIAL:
        forms.pop("potential", None)
    keep = len(kana_stem) if kind == "V2" else len(kana_stem) - 1  # số âm kana không đổi ở đầu
    kj_prefix: str | None = None
    kuru_kanji = False
    if kanji_stem is not None:
        if kind == "V2":
            kj_prefix = kanji_stem
        elif kanji_stem[-1] == kana_stem[-1]:
            kj_prefix = kanji_stem[:-1]
        elif kind == "V3" and kanji_stem.endswith("来") and kana_stem.endswith("き"):
            kj_prefix, kuru_kanji = kanji_stem[:-1], True
    out: list[Form] = []
    for f in VERB_FORMS:
        if f not in forms:
            continue
        kana, rule, irr = forms[f]
        kanji: str | None = None
        if kj_prefix is not None:
            tail = kana[keep:]
            if kuru_kanji:
                tail = "来" + tail[1:] if tail and tail[0] in "くこき" else tail
            kanji = kj_prefix + tail
        out.append(Form(f, kana, kanji, rule, irr))
    return out


def conjugate_adj_i(kana: str, kanji: str | None) -> list[Form]:
    if not kana.endswith("い") or (kanji is not None and not kanji.endswith("い")):
        raise ValueError(f"tính từ い không tận cùng い: {kana} / {kanji}")
    ii = kana == "いい" or kana.endswith("がいい")
    k_stem = kana[:-2] + "よ" if ii else kana[:-1]
    j_stem = (kanji[:-2] + "よ" if ii else kanji[:-1]) if kanji else None
    table = (("neg", "くない"), ("neg_polite", "くないです"), ("past", "かった"), ("past_polite", "かったです"),
             ("past_neg", "くなかった"), ("past_neg_polite", "くなかったです"), ("te", "くて"),
             ("adverb", "く"), ("ba", "ければ"))
    out = [Form("plain", kana, kanji, "giữ nguyên い", False),
           Form("desu", kana + "です", kanji + "です" if kanji else None, "い + です", False)]
    for f, end in table:
        rule = f"ngoại lệ: いい → よ{end}" if ii else f"bỏ い + {end}"
        out.append(Form(f, k_stem + end, j_stem + end if j_stem else None, rule, ii))
    return out


def conjugate_nominal(kind: str, kana: str, kanji: str | None) -> list[Form]:
    """Tính từ な (gốc bỏ な) / danh từ."""
    attr = "な" if kind == "An" else "の"
    table = (("da", "だ"), ("desu", "です"), ("attributive", attr), ("neg", "じゃない"),
             ("neg_polite", "じゃありません"), ("past", "だった"), ("past_polite", "でした"),
             ("past_neg", "じゃなかった"), ("past_neg_polite", "じゃありませんでした"), ("te", "で"),
             ("adverb", "に"), ("nara", "なら"))
    base = "gốc" if kind == "An" else "danh từ"
    return [Form(f, kana + end, kanji + end if kanji else None, f"{base} + {end}", False) for f, end in table]


def na_base(kana: str, kanji: str | None) -> tuple[str, str | None]:
    """N3 ghi kèm な (積極的な) → bỏ な."""
    if kana.endswith("な") and len(kana) > 2:
        kana = kana[:-1]
        if kanji and kanji.endswith("な"):
            kanji = kanji[:-1]
    return kana, kanji


def conjugate(kind: str, kana: str, kanji: str | None, dictionary_form: bool = False) -> tuple[str, str | None, list[Form]]:
    """→ (gốc kana, gốc chữ Hán, các thể). Gốc động từ là thể ます."""
    if kind in ("V1", "V2", "V3"):
        ks, js = masu_stem(kind, kana, kanji, dictionary_form)
        forms = conjugate_verb(kind, ks, js)
        return ks + "ます", (js + "ます" if js else None), forms
    if kind == "Ai":
        return kana, kanji, conjugate_adj_i(kana, kanji)
    if kind in ("An", "N"):
        kana, kanji = na_base(kana, kanji) if kind == "An" else (kana, kanji)
        return kana, kanji, conjugate_nominal(kind, kana, kanji)
    raise ValueError(f"không chia được loại {kind}")


# ── Build data/conjugation.json ───────────────────────────────────────────────────────────────────
def _entry_kind(codes: list[str]) -> str | None:
    for c in codes:
        if c in ("V1", "V2", "V3", "Ai", "An"):
            return c
    return None


@dataclass
class ConjReport:
    entries: int = 0
    duplicates: int = 0
    no_ruby: list[str] | None = None  # vocab_id không gắn được furigana → hiển thị kana


def build_conjugation(vocab: list, spec: dict) -> tuple[object, ConjReport]:  # type: ignore[type-arg]
    """vocab: list[VocabEntry] (Minna trước, N3 sau); spec: enrichment/conjugation/forms.json.
    Lỗi (ví dụ không tìm thấy, thiếu thể, chia lỗi) → ValueError."""
    from jp_pipeline.schemas import (
        ConjEntry,
        ConjFormDef,
        ConjGroupDef,
        ConjRule,
        ConjugationFile,
        ConjValue,
    )

    rep = ConjReport(no_ruby=[])
    seen: dict[tuple[str, str, str | None], str] = {}  # khóa → vocab_id đầu tiên
    aliases: dict[str, list[str]] = {}
    by_key: dict[tuple[str, str], list[ConjEntry]] = {}  # (loại, kana gốc) → entries, để giải ví dụ
    entries: list[ConjEntry] = []

    def make(e, kind: str) -> ConjEntry | None:  # type: ignore[no-untyped-def]
        kanji = first_kanji(e.kanji) if e.display == "kanji" else None
        base_kana, base_kanji, forms = conjugate(kind, e.kana, kanji, dictionary_form=e.book == "n3")
        key = (kind, base_kana, base_kanji)
        if key in seen:
            rep.duplicates += 1
            aliases.setdefault(seen[key], []).append(e.id)
            return None
        seen[key] = e.id
        ruby_ok = True

        def rb(kj: str | None, kana: str) -> str:
            nonlocal ruby_ok
            r = to_ruby(kj, kana)
            if r is None:
                ruby_ok = False
                return kana
            return r

        values = [ConjValue(form=f.form, kana=f.kana, ruby=rb(f.kanji, f.kana), rule=f.rule, irregular=f.irregular)
                  for f in forms]
        ce = ConjEntry(vocab_id=e.id, book=e.book, lesson=e.lesson, kind=kind, kana=base_kana,  # type: ignore[arg-type]
                       ruby=rb(base_kanji, base_kana), meaning_vi=e.meaning_vi, han_viet=e.han_viet, forms=values)
        if not ruby_ok:
            rep.no_ruby.append(e.id)  # type: ignore[union-attr]
        by_key.setdefault((kind, base_kana), []).append(ce)
        return ce

    for e in vocab:
        kind = _entry_kind(e.pos.code.split("/"))
        if kind is None:
            continue
        try:
            ce = make(e, kind)
        except ValueError as ex:
            raise ValueError(f"{e.id} {e.kana}: {ex}") from ex
        if ce is not None:
            entries.append(ce)

    # danh từ: chỉ những từ dùng làm ví dụ
    noun_refs = {ex for f in spec["forms"] if f["group"] == "noun" for r in f["rules"] for ex in r["examples"]}
    for ref in sorted(noun_refs):
        kana, _, kanji = ref.partition("|")
        hit = next((e for e in vocab if e.kana == kana and (not kanji or e.kanji == kanji)
                    and "N" in e.pos.code.split("/")), None)
        if hit is None:
            raise ValueError(f"forms.json: không tìm thấy danh từ ví dụ {ref!r}")
        ce = make(hit, "N")
        if ce is not None:
            entries.append(ce)

    def resolve(ref: str, kind: str) -> str:
        kana, _, kanji = ref.partition("|")
        kinds = ("V1", "V2", "V3") if kind == "V" else (kind,)
        for k in kinds:
            for ce in by_key.get((k, kana), []):
                if not kanji or re.sub(r"[{}|ぁ-ゖ]", "", ce.ruby) == re.sub(r"[ぁ-ゖ]", "", kanji):
                    return ce.vocab_id
        raise ValueError(f"forms.json: không tìm thấy ví dụ {ref!r} (loại {kind})")

    forms: list[ConjFormDef] = []
    for f in spec["forms"]:
        rules = [ConjRule(kind=r["kind"], text=r["text"], examples=[resolve(x, r["kind"]) for x in r["examples"]])
                 for r in f["rules"]]
        forms.append(ConjFormDef(id=f["id"], group=f["group"], name_vi=f["name_vi"], name_ja=f["name_ja"],
                                 lesson=f["lesson"], use_vi=f["use_vi"], rules=rules))
    for g, ids in FORMS_BY_GROUP.items():
        got = tuple(f.id for f in forms if f.group == g)
        if got != ids:
            raise ValueError(f"forms.json nhóm {g}: thứ tự/thiếu thể — có {got}, cần {ids}")
    groups = [ConjGroupDef.model_validate(g) for g in spec["groups"]]
    entries = [ce.model_copy(update={"aliases": aliases.get(ce.vocab_id, [])}) for ce in entries]
    rep.entries = len(entries)
    return ConjugationFile(groups=groups, forms=forms, entries=entries), rep
