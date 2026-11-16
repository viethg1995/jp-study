"""Từ ví dụ cho từng chữ Kanji, chia Âm On (音) / Âm Kun (訓).

1. Từ giáo trình (vocab_refs) luôn được dùng trước — có nghĩa tiếng Việt sẵn, link về thẻ.
2. Thiếu (< MIN_EXAMPLES) → bổ sung từ JMdict: ưu tiên từ thông dụng (common), ngắn, mà các chữ Hán
   khác trong từ cũng nằm trong bộ Kanji của site; đảm bảo mỗi loại âm (On/Kun) chữ có thì có ≥1 ví dụ.
   Kun: ưu tiên từ có okurigana (代わる), mỗi âm Kun một từ, tới KUN_TARGET (tổng ≤ MAX_EXAMPLES).
3. Loại âm: tách cách đọc cả từ thành cách đọc từng chữ theo âm On/Kun KANJIDIC2 (kèm biến âm
   連濁 k→g…, 促音 つ/く/ち/き→っ). Không tách được (熟字訓 như 今日 きょう) → null, web xếp "Đặc biệt".

Nghĩa tiếng Việt của từ JMdict lấy từ enrichment/kanji/examples/*.txt (`từ|kana|nghĩa`, `# by: ai|user`);
chưa có → null (web hiện nghĩa tiếng Anh). Không tự bịa nghĩa.
"""

from __future__ import annotations

from collections.abc import Iterable
from functools import cache

from pydantic import BaseModel

from jp_pipeline.dictionaries import JmEntry, KanjiInfo
from jp_pipeline.schemas import KanjiEntry, KanjiExample, ReadingType, VocabEntry
from jp_pipeline.transform.vocab_text import join_senses

MIN_EXAMPLES = 5
MAX_EXAMPLES = 7  # bổ sung ví dụ Kun được vượt MIN_EXAMPLES tới mức này
KUN_TARGET = 3  # số ví dụ Kun nhắm tới (mỗi âm Kun khác nhau một từ)
MAX_WORD_LEN = 4  # từ JMdict bổ sung: tối đa 4 ký tự
_RENDAKU = dict(zip("かきくけこさしすせそたちつてとはひふへほ", "がぎぐげござじずぜぞだぢづでどばびぶべぼ", strict=True))
_HANDAKU = dict(zip("はひふへほ", "ぱぴぷぺぽ", strict=True))
_SOKUON_END = set("つくちき")


def kata_to_hira(s: str) -> str:
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s)


def is_kanji(c: str) -> bool:
    return "一" <= c <= "鿿" or "㐀" <= c <= "䶿" or c == "々"


def _variants(r: str) -> set[str]:
    """Biến âm khi đứng trong từ ghép: 連濁 (k→g, h→b/p…) và 促音 (がく → がっ)."""
    out = {r}
    if r and r[0] in _RENDAKU:
        out.add(_RENDAKU[r[0]] + r[1:])
    if r and r[0] in _HANDAKU:
        out.add(_HANDAKU[r[0]] + r[1:])
    sokuon = {x[:-1] + "っ" for x in out if len(x) >= 2 and x[-1] in _SOKUON_END}
    return out | sokuon


def char_readings(info: KanjiInfo | None) -> list[tuple[str, ReadingType]]:
    """Các cách đọc (hiragana) của một chữ trong từ ghép: On (katakana → hiragana), Kun (gốc trước '.',
    và cả gốc + okurigana cho từ bỏ okurigana như 受付 うけつけ)."""
    if info is None:
        return []
    out: dict[str, ReadingType] = {}
    for on in info.on:
        for v in _variants(kata_to_hira(on.strip("-"))):
            out.setdefault(v, "on")
    for kun in info.kun:
        k = kun.strip("-")
        stem, _, okuri = k.partition(".")
        for base in {stem, stem + okuri}:
            for v in _variants(base):
                out.setdefault(v, "kun")  # âm trùng On và Kun → giữ On (hiếm)
    return list(out.items())


def _okurigana(word: str, char: str) -> str | None:
    """Okurigana ngay sau chữ khi từ = chữ + toàn kana ('代わる' → 'わる'); từ ghép/chữ đơn → None."""
    if not word.startswith(char) or len(word) == 1:
        return None
    rest = word[1:]
    return rest if not any(is_kanji(c) for c in rest) else None


_UNVOICE = {v: k for d in (_RENDAKU, _HANDAKU) for k, v in d.items()}  # が→か, ば→は, ぱ→は


def _unvoice(r: str) -> str:
    """Bỏ 連濁 ở âm đầu để gộp biến âm: 'づよ' → 'つよ', 'がわ' → 'かわ'."""
    return _UNVOICE.get(r[:1], r[:1]) + r[1:]


def _kun_okurigana(info: KanjiInfo | None) -> dict[str, list[str]]:
    """{gốc Kun (bỏ 連濁): [okurigana]} theo KANJIDIC2: か.わる, か.える → {'か': ['わる', 'える']}."""
    out: dict[str, list[str]] = {}
    for kun in info.kun if info else []:
        stem, _, okuri = kun.strip("-").partition(".")
        if okuri and okuri not in out.setdefault(_unvoice(stem), []):
            out[_unvoice(stem)].append(okuri)
    return out


def split_reading(
    word: str, kana: str, kanjidic: dict[str, KanjiInfo]
) -> list[list[tuple[str, ReadingType | None]]]:
    """Mọi cách tách `kana` thành cách đọc từng ký tự của `word`. Ký tự kana phải khớp nguyên văn;
    chữ Hán thử từng âm On/Kun. Trả về danh sách phương án, mỗi phương án = [(cách đọc, loại) / ký tự]."""
    w = kata_to_hira(word)
    k = kata_to_hira(kana)
    readings: list[list[tuple[str, ReadingType]]] = []
    for i, c in enumerate(w):
        src = w[i - 1] if c == "々" and i > 0 else c
        readings.append(char_readings(kanjidic.get(src)) if is_kanji(src) else [])

    @cache
    def go(i: int, j: int) -> tuple[tuple[tuple[str, ReadingType | None], ...], ...]:
        if i == len(w):
            return ((),) if j == len(k) else ()
        c = w[i]
        res: list[tuple[tuple[str, ReadingType | None], ...]] = []
        if not is_kanji(c):
            if k.startswith(c, j):
                res += [((c, None), *rest) for rest in go(i + 1, j + 1)]
            return tuple(res)
        for r, t in readings[i]:
            if k.startswith(r, j):
                res += [((r, t), *rest) for rest in go(i + 1, j + len(r))]
        return tuple(res)

    return [list(p) for p in go(0, 0)]


def classify(word: str, kana: str, char: str, kanjidic: dict[str, KanjiInfo]) -> tuple[ReadingType | None, str | None]:
    """Loại âm + cách đọc của `char` (lần xuất hiện đầu) trong từ. Nhập nhằng giữa On/Kun hoặc không tách
    được → (None, None)."""
    idx = word.find(char)
    if idx < 0:
        return None, None
    found = {p[idx] for p in split_reading(word, kana, kanjidic)}
    if len(found) == 1:
        r, t = next(iter(found))
        return t, r
    types = {t for _, t in found}
    if len(types) == 1 and found:  # cùng loại, khác cách đọc (biến âm) → lấy cách đọc ngắn nhất cho gọn
        t = types.pop()
        return t, min((r for r, _ in found), key=len)
    return None, None


class ExampleReport(BaseModel):
    below_min: dict[str, int]  # chữ vẫn chưa đủ MIN_EXAMPLES sau khi bổ sung: số từ có
    jmdict_added: int
    untranslated: int  # từ JMdict chưa có nghĩa tiếng Việt
    unclassified: int  # ví dụ không xác định được On/Kun


def _clean(s: str) -> str:
    return s.replace("～", "").replace("〜", "").strip()


def jm_candidates(jm: dict[str, list[JmEntry]], chars: set[str]) -> dict[str, list[tuple[str, str, JmEntry]]]:
    """{字: [(từ, kana, entry)]} — mỗi (từ, kana) một lần, chỉ dạng chữ Hán đầu tiên (phổ biến nhất)
    của entry (thêm dạng thông dụng chữ + okurigana khác, vd 代わる trong mục 変わる), bỏ từ thường viết bằng kana (uk)."""
    out: dict[str, list[tuple[str, str, JmEntry]]] = {}
    seen: set[tuple[str, str]] = set()
    for kana in sorted(jm):
        for e in jm[kana]:
            if e.uk or not e.kanji or not e.gloss:
                continue
            # dạng đầu + dạng thông dụng khác kiểu chữ + okurigana (mục かわる: 変わる đầu, 代わる thông dụng)
            forms = [e.kanji[0], *(f for f in e.kanji[1:] if f in e.common_kanji and _okurigana(f, f[0]) is not None)]
            for w in forms:
                if len(w) > MAX_WORD_LEN or (w, kana) in seen:
                    continue
                seen.add((w, kana))
                for c in set(w):
                    if c in chars:
                        out.setdefault(c, []).append((w, kana, e))
    return out


def parse_example_translations(files: Iterable[tuple[str, str]]) -> dict[tuple[str, str], tuple[str, str]]:
    """enrichment/kanji/examples/*.txt — `từ|kana|nghĩa` → {(từ, kana): (nghĩa, "ai-draft"|"user")}.
    File sau ghi đè file trước (theo thứ tự tên)."""
    out: dict[tuple[str, str], tuple[str, str]] = {}
    for name, text in files:
        by = "ai-draft"
        for n, raw in enumerate(text.splitlines(), 1):
            line = raw.strip()
            if line.startswith("# by:"):
                by = "user" if line.split(":", 1)[1].strip() == "user" else "ai-draft"
                continue
            if not line or line.startswith("#"):
                continue
            parts = [p.strip() for p in line.split("|")]
            if len(parts) != 3 or not all(parts):
                raise ValueError(f"{name}:{n}: cần `từ|kana|nghĩa`: {line!r}")
            out[(parts[0], parts[1])] = (parts[2], by)
    return out


def build_examples(
    kanji: list[KanjiEntry],
    vocab: list[VocabEntry],
    jm: dict[str, list[JmEntry]],
    kanjidic: dict[str, KanjiInfo],
    translations: dict[tuple[str, str], tuple[str, str]],
) -> tuple[list[KanjiEntry], ExampleReport]:
    chars = {k.char for k in kanji}
    by_id = {v.id: v for v in vocab}
    cands = jm_candidates(jm, chars)
    below: dict[str, int] = {}
    added = untranslated = unclassified = 0
    out: list[KanjiEntry] = []

    for k in kanji:
        has_types = {t for t in (("on" if k.on else None), ("kun" if k.kun else None)) if t}
        exs: list[KanjiExample] = []
        words: set[str] = set()
        for vid in k.vocab_refs:
            v = by_id.get(vid)
            if v is None or v.kanji is None:
                continue
            # "夫/主人" — chọn phương án chứa chữ đang xét (kana cùng vị trí nếu số phương án khớp)
            ks, ns = v.kanji.split("/"), v.kana.split("/")
            i = next((n for n, x in enumerate(ks) if k.char in x), 0)
            w = _clean(ks[i])
            kana = _clean(ns[i] if len(ns) == len(ks) else ns[0])
            if not w or w in words:
                continue
            words.add(w)
            t, r = classify(w, kana, k.char, kanjidic)
            exs.append(KanjiExample(word=w, kana=kana, reading_type=t, reading=r, meaning_vi=v.meaning_vi,
                                    meaning_vi_source="vocab", meaning_en=None, vocab_id=v.id, source="vocab"))

        def rank(c: tuple[str, str, JmEntry]) -> tuple[int, int, int, int, str, str]:
            w, kana, e = c
            others_known = all(ch in chars or not is_kanji(ch) for ch in w)
            return (0 if e.common else 1, 0 if others_known else 1, abs(len(w) - 2), len(kana), w, kana)

        pool = sorted((c for c in cands.get(k.char, []) if c[0] not in words), key=rank)
        classified = [(c, *classify(c[0], c[1], k.char, kanjidic)) for c in pool]

        def take(
            c: tuple[str, str, JmEntry],
            t: ReadingType | None,
            r: str | None,
            words: set[str] = words,
            exs: list[KanjiExample] = exs,
        ) -> None:
            nonlocal added, untranslated
            w, kana, e = c
            words.add(w)
            vi = translations.get((w, kana))
            untranslated += vi is None
            added += 1
            exs.append(KanjiExample(word=w, kana=kana, reading_type=t, reading=r,
                                    meaning_vi=join_senses(vi[0]) if vi else None,
                                    meaning_vi_source=vi[1] if vi else None,  # type: ignore[arg-type]
                                    meaning_en="; ".join(e.gloss[:3]), vocab_id=None, source="jmdict"))

        # (a) mỗi loại âm chữ có → ≥1 ví dụ (chỉ lấy từ thông dụng, tránh từ hiếm cho đủ chỉ tiêu)
        if "on" in has_types and not any(x.reading_type == "on" for x in exs):
            pick = next((x for x in classified if x[1] == "on" and x[0][2].common and x[0][0] not in words), None)
            if pick:
                take(*pick)
        # (a') Kun: từ có okurigana (代わる) trước; mỗi âm Kun một ví dụ (lượt 1 theo âm gốc か/よ/しろ, lượt 2
        # theo okurigana 代わる/代える), tới KUN_TARGET ví dụ Kun, tổng không quá MAX_EXAMPLES; luôn ≥1 nếu có
        if "kun" in has_types:
            kd_okuri = _kun_okurigana(kanjidic.get(k.char))

            def okuri_rank(w: str, r: str, e: JmEntry) -> tuple[int, int, int]:
                """(0 dạng đúng okurigana KANJIDIC 代わる / 1 chữ + okurigana khác 代わります / 2 từ ghép,
                0 động từ·tính từ trước danh từ 代わり, thứ tự okurigana trong KANJIDIC)."""
                o = _okurigana(w, k.char)
                okuris = kd_okuri.get(_unvoice(r), [])
                group = 2 if o is None else 0 if o in okuris else 1
                verb_adj = any(p.startswith(("Godan", "Ichidan", "adjective (keiyoushi)")) for p in e.pos)
                return group, 0 if verb_adj else 1, okuris.index(o) if o in okuris else len(okuris)

            kun_pool = sorted(
                ((c, t, r) for c, t, r in classified if t == "kun" and r and c[2].common),
                key=lambda x: (*okuri_rank(x[0][0], x[2], x[0][2]), *rank(x[0])),
            )

            def stem_key(w: str, r: str) -> tuple[str, str] | None:
                return (_unvoice(r), "")  # 根強い づよ = 強い つよ

            def okuri_key(w: str, r: str) -> tuple[str, str] | None:
                """Lượt 2: chỉ từ chữ + okurigana đúng KANJIDIC (代わる/代わります → (か, わる)); khác → None."""
                o = _okurigana(w, k.char)
                if o is None:
                    return None
                okuris = kd_okuri.get(_unvoice(r), [])
                if o in okuris:  # khớp đúng trước: 代わり → わり (không phải わる)
                    return (_unvoice(r), o)
                return next(((_unvoice(r), x) for x in okuris if o.startswith(x[:-1] or x)), None)

            for key in (stem_key, okuri_key):
                seen = {key(x.word, x.reading) for x in exs if x.reading_type == "kun" and x.reading}
                for c, t, r in kun_pool:
                    n_kun = sum(x.reading_type == "kun" for x in exs)
                    if n_kun >= KUN_TARGET or (n_kun and len(exs) >= MAX_EXAMPLES):
                        break
                    kk = key(c[0], r)
                    if c[0] in words or kk is None or kk in seen:
                        continue
                    seen.add(kk)
                    take(c, t, r)
        # (b) đủ MIN_EXAMPLES: ưu tiên từ đã xác định được loại âm
        for want_known in (True, False):
            for c, t, r in classified:
                if len(exs) >= MIN_EXAMPLES:
                    break
                if c[0] in words or (t is not None) != want_known:
                    continue
                take(c, t, r)

        if len(exs) < MIN_EXAMPLES:
            below[k.char] = len(exs)
        unclassified += sum(1 for x in exs if x.reading_type is None)
        out.append(k.model_copy(update={"examples": exs}))

    return out, ExampleReport(below_min=below, jmdict_added=added, untranslated=untranslated, unclassified=unclassified)
