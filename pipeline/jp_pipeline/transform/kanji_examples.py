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


def on_groups(info: KanjiInfo | None) -> dict[str, list[str]]:
    """{âm On (hiragana): [dạng KANJIDIC]} — コウ → {'こう': ['コウ']}."""
    out: dict[str, list[str]] = {}
    for on in info.on if info else []:
        out.setdefault(kata_to_hira(on.strip("-")), []).append(on)
    return out


def kun_groups(info: KanjiInfo | None) -> dict[str, list[str]]:
    """{âm Kun chuẩn: [dạng KANJIDIC]} — gộp các cách cắt okurigana của cùng một từ và dạng tiền/hậu tố
    (う.まれる / うま.れる / うまれ → 'う'; おこな.う / おこ.なう → 'おこ'; -がわ.り → 'か'), bỏ 連濁."""
    ents: list[tuple[str, str, str]] = []
    for kun in info.kun if info else []:
        stem, _, okuri = kun.strip("-").partition(".")
        ents.append((_unvoice(stem), _unvoice(stem) + okuri, kun))
    fulls: dict[str, set[str]] = {}
    out: dict[str, list[str]] = {}
    for stem, full, kun in sorted(ents, key=lambda x: len(x[0])):  # gốc ngắn trước làm âm chuẩn
        canon = next((t for t in out if stem.startswith(t) and any(f.startswith(stem) for f in fulls[t])), stem)
        out.setdefault(canon, []).append(kun)
        fulls.setdefault(canon, set()).add(full)
    # giữ thứ tự KANJIDIC
    order = {kun: i for i, kun in enumerate(info.kun if info else [])}
    return {c: sorted(ks, key=order.__getitem__) for c, ks in sorted(out.items(), key=lambda x: min(order[k] for k in x[1]))}


class ReadingGroups:
    """Âm On/Kun chuẩn của một chữ + quy cách đọc trong từ về âm chuẩn."""

    def __init__(self, info: KanjiInfo | None) -> None:
        self.on = on_groups(info)
        self.kun = kun_groups(info)
        self._fulls = {
            c: {_unvoice(k.strip("-").replace(".", "")) for k in ks} for c, ks in self.kun.items()
        }

    def of(self, r: str, t: ReadingType) -> str | None:
        """Âm chuẩn mà cách đọc `r` thuộc về; không khớp → None. On: theo biến âm (がっ → がく).
        Kun: bỏ 連濁, gốc + okurigana (つり → つ), 促音 (ひっ → ひく)."""
        if t == "on":
            return next((o for o in self.on if r in _variants(o)), None)
        u = _unvoice(r)
        hit = [c for c in self.kun if u == c or (u.startswith(c) and any(f.startswith(u) for f in self._fulls[c]))]
        if not hit and u.endswith("っ"):
            hit = [c for c in self.kun
                   if any(len(f) == len(u) and f[:-1] == u[:-1] and f[-1] in _SOKUON_END for f in self._fulls[c])]
        return max(hit, key=len) if hit else None


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
    readings_filled: int = 0  # từ thêm ở bước (c) để phủ âm còn thiếu
    readings_removed: dict[str, list[str]] = {}  # âm KANJIDIC bị bỏ khỏi on/kun: không có từ nào trong JMdict
    readings_without_example: dict[str, list[str]] = {}  # âm còn giữ nhưng chỉ có từ hiếm → chưa có ví dụ
    untranslated: int  # từ JMdict chưa có nghĩa tiếng Việt
    unclassified: int  # ví dụ không xác định được On/Kun


def _clean(s: str) -> str:
    return s.replace("～", "").replace("〜", "").strip()


def jm_candidates(
    jm: dict[str, list[JmEntry]], chars: set[str], *, all_forms: bool = False
) -> dict[str, list[tuple[str, str, JmEntry]]]:
    """{字: [(từ, kana, entry)]} — mỗi (từ, kana) một lần, chỉ dạng chữ Hán đầu tiên (phổ biến nhất)
    của entry (thêm dạng thông dụng chữ + okurigana khác, vd 代わる trong mục 変わる), bỏ từ thường viết bằng kana (uk).
    `all_forms`: mọi dạng chữ, mọi độ dài, kể cả uk — chỉ dùng để xét âm có còn từ nào trong JMdict không."""
    out: dict[str, list[tuple[str, str, JmEntry]]] = {}
    seen: set[tuple[str, str]] = set()
    for kana in sorted(jm):
        for e in jm[kana]:
            if not e.kanji or (not all_forms and (e.uk or not e.gloss)):
                continue
            # dạng đầu + dạng thông dụng khác kiểu chữ + okurigana (mục かわる: 変わる đầu, 代わる thông dụng)
            forms = e.kanji if all_forms else [
                e.kanji[0], *(f for f in e.kanji[1:] if f in e.common_kanji and _okurigana(f, f[0]) is not None)]
            for w in forms:
                if (not all_forms and len(w) > MAX_WORD_LEN) or (w, kana) in seen:
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


def parse_pinned_examples(text: str, name: str = "pinned/examples.txt") -> dict[str, list[tuple[str, str]]]:
    """`字|từ|kana` → {字: [(từ, kana)]}; sai cú pháp, từ không chứa chữ, hoặc trùng → lỗi."""
    out: dict[str, list[tuple[str, str]]] = {}
    for n, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.split("|")]
        if len(parts) != 3 or not all(parts) or parts[0] not in parts[1]:
            raise ValueError(f"{name}:{n}: cần `字|từ chứa 字|kana`: {line!r}")
        if (parts[1], parts[2]) in out.get(parts[0], []):
            raise ValueError(f"{name}:{n}: trùng: {line!r}")
        out.setdefault(parts[0], []).append((parts[1], parts[2]))
    return out


def build_examples(
    kanji: list[KanjiEntry],
    vocab: list[VocabEntry],
    jm: dict[str, list[JmEntry]],
    kanjidic: dict[str, KanjiInfo],
    translations: dict[tuple[str, str], tuple[str, str]],
    pinned: dict[str, list[tuple[str, str]]] | None = None,
) -> tuple[list[KanjiEntry], ExampleReport]:
    chars = {k.char for k in kanji}
    pinned = pinned or {}
    if unknown := set(pinned) - chars:
        raise ValueError(f"ví dụ ghim cho chữ không có trong kanji.json: {''.join(sorted(unknown))}")
    by_id = {v.id: v for v in vocab}
    cands = jm_candidates(jm, chars)
    all_cands = jm_candidates(jm, chars, all_forms=True)
    below: dict[str, int] = {}
    removed: dict[str, list[str]] = {}
    without: dict[str, list[str]] = {}
    added = untranslated = unclassified = filled = 0
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

            # âm gốc + okurigana khi từ ghép bỏ okurigana (不釣合い つり = 釣る つ.る) → tính theo gốc
            kd_full = {stem + o: stem for stem, os in kd_okuri.items() for o in os}

            def stem_key(w: str, r: str) -> tuple[str, str] | None:
                u = _unvoice(r)
                return (kd_full.get(u, u), "")  # 根強い づよ = 強い つよ

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

        # (b') ví dụ ghim (enrichment/kanji/pinned/examples.txt) — luôn có, nối thêm nếu chưa có
        for w, kana in pinned.get(k.char, []):
            if w in words:
                continue
            c = next((x for x in all_cands.get(k.char, []) if x[0] == w and x[1] == kana), None)
            if c is None:
                raise ValueError(f"ví dụ ghim {k.char}|{w}|{kana}: không có trong JMdict")
            take(c, *classify(w, kana, k.char, kanjidic))
        # (c) phủ cách đọc: mỗi âm On/Kun chuẩn chưa có ví dụ → thêm 1 từ mà chính cách đọc đó thông dụng
        # (common_reading — tránh 王女 おうにょ); chỉ nối thêm, không giới hạn MAX_EXAMPLES. Kun: chữ + okurigana,
        # động/tính từ trước. (d) âm không có từ nào trong JMdict (mọi độ dài, cả uk) → bỏ khỏi on/kun.
        groups = ReadingGroups(kanjidic.get(k.char))
        cov = {(x.reading_type, g) for x in exs
               if x.reading_type and x.reading and (g := groups.of(x.reading, x.reading_type))}
        drop: set[str] = set()
        no_example: list[str] = []
        for t, gs in (("on", groups.on), ("kun", groups.kun)):
            for g, forms in gs.items():
                if (t, g) in cov:
                    continue
                hits = [(c, tt, r) for c, tt, r in classified
                        if tt == t and r and c[2].common_reading and c[0] not in words and groups.of(r, t) == g]
                if t == "kun":  # sort ổn định: giữ thứ tự `rank` trong cùng nhóm
                    hits.sort(key=lambda x: (_okurigana(x[0][0], k.char) is None, not _is_verb_adj(x[0][2])))
                if hits:
                    take(*hits[0])
                    filled += 1
                    cov.add((t, g))
                    continue
                variants = _variants(g)
                # xét mọi phương án tách (không đòi duy nhất như classify) để không bỏ nhầm âm
                exists = any(
                    any(v in kata_to_hira(kana) for v in variants)
                    and any(rt == t and groups.of(r, t) == g
                            for p in split_reading(w, kana, kanjidic) for r, rt in [p[w.index(k.char)]])
                    for w, kana, _ in all_cands.get(k.char, [])
                )
                if exists:
                    no_example.append(g)
                else:
                    drop.update(forms)
        update: dict[str, object] = {"examples": exs}
        if drop:
            removed[k.char] = [x for x in (*k.on, *k.kun) if x in drop]
            update |= {"on": [x for x in k.on if x not in drop], "kun": [x for x in k.kun if x not in drop]}
        if no_example:
            without[k.char] = no_example

        if len(exs) < MIN_EXAMPLES:
            below[k.char] = len(exs)
        unclassified += sum(1 for x in exs if x.reading_type is None)
        out.append(k.model_copy(update=update))

    return out, ExampleReport(below_min=below, jmdict_added=added, readings_filled=filled, readings_removed=removed,
                              readings_without_example=without, untranslated=untranslated, unclassified=unclassified)


def _is_verb_adj(e: JmEntry) -> bool:
    return any(p.startswith(("Godan", "Ichidan", "adjective (keiyoushi)")) for p in e.pos)
