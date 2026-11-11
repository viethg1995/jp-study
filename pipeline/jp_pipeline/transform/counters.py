"""Số đếm & trợ số từ: enrichment/counters/ → data/counters.json.

Bảng cách đọc được GHI CỨNG từng ô trong enrichment (không sinh tự động — rule 5). Module này chỉ KIỂM TRA:
  - number_kana() / number_pattern(): đọc số nguyên (< 10^12), thập phân, phân số, %, số âm, số điện thoại
    theo quy tắc chuẩn → đối chiếu bảng số đếm và câu ví dụ.
  - candidates(): các cách đọc hợp quy tắc biến âm của nhóm (h/k/s/t/none) → mỗi ô hoặc khớp quy tắc,
    hoặc phải đánh dấu irregular = true (và ngược lại: khớp quy tắc mà đánh dấu irregular → lỗi).
  - câu ví dụ: cú pháp ruby, chữ Hán phải có furigana, [[…]] chứa số + trợ số từ đọc đúng theo bảng.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass, field

from pydantic import ValidationError

from jp_pipeline.schemas import (
    CJK,
    Counter,
    CounterExample,
    CounterFile,
    CounterQuestion,
    CounterReading,
    NumberSystem,
    SoundRule,
    VocabEntry,
)

# ---------------------------------------------------------------- đọc số

_DIGIT = ["", "いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう"]
_HUNDRED = {1: "ひゃく", 3: "さんびゃく", 6: "ろっぴゃく", 8: "はっぴゃく"}
_THOUSAND = {1: "せん", 3: "さんぜん", 8: "はっせん"}


def _group_parts(n: int) -> list[str]:
    """0 < n < 10000 → các thành phần kana theo thứ tự đọc: 300 → ['さん', 'びゃく'], 21 → ['に', 'じゅう', 'いち']."""
    th, h, t, o = n // 1000, n // 100 % 10, n // 10 % 10, n % 10
    out: list[str] = []
    if th:
        out += {1: ["せん"], 3: ["さん", "ぜん"], 8: ["はっ", "せん"]}.get(th, [_DIGIT[th], "せん"])
    if h:
        out += {1: ["ひゃく"], 3: ["さん", "びゃく"], 6: ["ろっ", "ぴゃく"], 8: ["はっ", "ぴゃく"]}.get(h, [_DIGIT[h], "ひゃく"])
    if t:
        out += ([] if t == 1 else [_DIGIT[t]]) + ["じゅう"]
    if o:
        out.append(_DIGIT[o])
    return out


def number_parts(n: int) -> list[str]:
    """Thành phần kana của n (< 10^12); 10000 → ['いち', 'まん']."""
    if not 0 < n < 10**12:
        raise ValueError(f"ngoài phạm vi: {n}")
    oku, man, rest = n // 10**8, n // 10**4 % 10**4, n % 10**4
    out: list[str] = []
    if oku:
        out += _group_parts(oku) + ["おく"]
    if man:
        out += _group_parts(man) + ["まん"]
    if rest:
        out += _group_parts(rest)
    return out


def number_kana(n: int) -> str:
    """Đọc số theo cách chuẩn: 4 → よん, 7 → なな, 9 → きゅう; 10000 → いちまん; 0 → ゼロ."""
    return "ゼロ" if n == 0 else "".join(number_parts(n))


# ---------------------------------------------------------------- số không phải số tự nhiên

_DIGIT_READ = {"0": ("れい", "ゼロ"), "1": ("いち",), "2": ("に",), "3": ("さん",), "4": ("よん",), "5": ("ご",),
               "6": ("ろく",), "7": ("なな",), "8": ("はち",), "9": ("きゅう",)}
# đọc từng chữ số (số điện thoại, số phòng): 0 còn đọc まる, 2/5 kéo dài にい/ごう
_DIGIT_SPOKEN = {**_DIGIT_READ, "0": ("ゼロ", "れい", "まる"), "2": ("に", "にい"), "5": ("ご", "ごう")}
_GEM_BEFORE_PT = {"いち": "いっ", "はち": "はっ", "じゅう": ("じゅっ", "じっ"), "ひゃく": "ひゃっ"}


def _alt(options: Iterable[str]) -> str:
    return "(?:" + "|".join(re.escape(o) for o in sorted(set(options), key=len, reverse=True)) + ")"


def _int_variants(n: int, geminate: bool) -> set[str]:
    """Cách đọc số nguyên; geminate = trước âm p/t (てん, パーセント): 1, 8, 10, 100 ngắt っ (vẫn chấp nhận không ngắt)."""
    if n == 0:
        return {"れい", "ゼロ"}
    parts = number_parts(n)
    out = {"".join(parts)}
    gem = _GEM_BEFORE_PT.get(parts[-1]) if geminate else None
    for g in ([gem] if isinstance(gem, str) else list(gem or ())):
        out.add("".join(parts[:-1]) + g)
    return out


def _decimal_re(ip: str, fp: str) -> str:
    return _alt(_int_variants(int(ip), True)) + "てん" + "".join(_alt(_DIGIT_READ[d]) for d in fp)


def number_pattern(text: str) -> str | None:
    """Regex cách đọc của số viết kiểu Nhật: 3,500 · 2.5 · 1/2 · 3分の1 · 50% · -3 · 090-1234-5678.
    None nếu không phải dạng kiểm được (第1, 2番目…). Khoảng trắng trong cách đọc được bỏ qua khi so."""
    t = text.replace(",", "").replace("−", "-").replace("％", "%")
    if m := re.fullmatch(r"-(.+)", t):
        inner = number_pattern(m.group(1))
        return "マイナス" + inner if inner else None
    if m := re.fullmatch(r"(\d+)(?:\.(\d+))?%", t):
        head = _decimal_re(m.group(1), m.group(2)) if m.group(2) else _alt(_int_variants(int(m.group(1)), True))
        return head + "パーセント"
    if (m := re.fullmatch(r"(\d+)/(\d+)", t)) or (m2 := re.fullmatch(r"(\d+)分の(\d+)", t)):
        num, den = (m.group(1), m.group(2)) if m else (m2.group(2), m2.group(1))  # type: ignore[union-attr]
        return _alt(_int_variants(int(den), False)) + "ぶんの" + _alt(_int_variants(int(num), False))
    if m := re.fullmatch(r"(\d+)\.(\d+)", t):
        return _decimal_re(m.group(1), m.group(2))
    if re.fullmatch(r"\d+", t):
        return _alt(_int_variants(int(t), False))
    if re.fullmatch(r"\d+(?:-\d+)+", t):
        return "".join("の?" if ch == "-" else _alt(_DIGIT_SPOKEN[ch]) for ch in t)
    return None


def reading_matches(text: str, kana: str, prefix: bool = False) -> bool | None:
    """Cách đọc khớp số? prefix = cho phép phần đuôi phía sau (trợ số từ, đơn vị). None = dạng không kiểm được."""
    pat = number_pattern(text)
    if pat is None:
        return None
    k = kana.replace(" ", "").replace("　", "")
    return bool((re.match if prefix else re.fullmatch)(pat, k))


# ---------------------------------------------------------------- biến âm

_VOICED = {"か": "が", "き": "ぎ", "く": "ぐ", "け": "げ", "こ": "ご", "さ": "ざ", "し": "じ", "す": "ず",
           "せ": "ぜ", "そ": "ぞ", "は": "ば", "ひ": "び", "ふ": "ぶ", "へ": "べ", "ほ": "ぼ"}
_SEMI = {"は": "ぱ", "ひ": "ぴ", "ふ": "ぷ", "へ": "ぺ", "ほ": "ぽ"}
# thành phần cuối của số → dạng ngắt っ (1, 6, 8, 10, 100; 300 びゃく, 600/800 ぴゃく)
_GEMINATE = {"いち": "いっ", "ろく": "ろっ", "はち": "はっ", "じゅう": "じゅっ", "ひゃく": "ひゃっ",
             "びゃく": "びゃっ", "ぴゃく": "ぴゃっ"}
_TAIL_KEY = {"びゃく": "ひゃく", "ぴゃく": "ひゃく", "ぜん": "せん"}  # biến thể → thành phần gốc để tra quy tắc
# nhóm nào ngắt っ ở các số đó
_GEM_DIGITS = {"h": {"いち", "ろく", "はち", "じゅう", "ひゃく"}, "k": {"いち", "ろく", "はち", "じゅう", "ひゃく"},
               "s": {"いち", "はち", "じゅう", "ひゃく"}, "t": {"いち", "はち", "じゅう", "ひゃく"}}


def _join(head: str, tail: str, counter: str, group: str) -> set[str]:
    """head = phần số trước thành phần cuối; tail = thành phần cuối; counter = cách đọc gốc trợ số từ."""
    first, rest = counter[0], counter[1:]
    plain = head + tail + counter
    if group not in _GEM_DIGITS:
        return {plain}
    out: set[str] = set()
    key = _TAIL_KEY.get(tail, tail)
    if key in _GEM_DIGITS[group]:
        start = _SEMI.get(first, first) if group == "h" else first
        out.add(head + _GEMINATE[tail] + start + rest)
        if key == "じゅう":
            out.add(head + "じっ" + start + rest)
        # không ngắt vẫn đúng: はちかい, はちさつ; ひゃくさつ, ひゃくさい (nhóm h thì không: ×ひゃくほん)
        if (key == "はち" and group != "h") or (key == "ひゃく" and group in ("s", "t")):
            out.add(plain)
    elif tail == "よん":  # 4: không biến âm, riêng 分 → よんぷん
        out.add(plain)
        if group == "h":
            out.add(head + tail + _SEMI[first] + rest)
    elif tail.endswith("ん"):  # さん, せん, まん, なん: h → b/p (bắt buộc), k → k/g, s → s/z (tùy từ)
        if group != "h":
            out.add(plain)
        if first in _VOICED:
            out.add(head + tail + _VOICED[first] + rest)
        if first in _SEMI:
            out.add(head + tail + _SEMI[first] + rest)
    else:
        out.add(plain)
    return out


def candidates(n: int, counter_kana: str, group: str) -> set[str]:
    """Các cách đọc hợp quy tắc nhóm biến âm cho 'n + trợ số từ'. Nhóm native/special → tập rỗng (không đoán)."""
    if group in ("native", "special"):
        return set()
    parts = number_parts(n)
    return _join("".join(parts[:-1]), parts[-1], counter_kana, group)


def question_candidates(counter_kana: str, group: str) -> set[str]:
    if group in ("native", "special"):
        return set()
    return _join("", "なん", counter_kana, group)


# ---------------------------------------------------------------- câu ví dụ

_TOKEN = re.compile(r"\[\[|\]\]|\{([^{}|]+)\|([^{}|]+)\}|([^[\]{}]+)")
_NUM_SEG = re.compile(r"^(\d[\d,]*|何)(.*)$")


@dataclass
class Segment:
    text: str
    reading: str | None
    target: bool


def parse_ruby(ruby: str) -> list[Segment]:
    """Giống web/src/lib/ruby.ts — lỗi cú pháp → ValueError."""
    out: list[Segment] = []
    in_target = False
    pos = 0
    for m in _TOKEN.finditer(ruby):
        if m.start() != pos:
            raise ValueError(f"cú pháp ruby lỗi tại vị trí {pos}: {ruby!r}")
        pos = m.end()
        tok = m.group(0)
        if tok == "[[":
            if in_target:
                raise ValueError(f"[[ lồng nhau: {ruby!r}")
            in_target = True
        elif tok == "]]":
            if not in_target:
                raise ValueError(f"]] thừa: {ruby!r}")
            in_target = False
        elif m.group(1) is not None:
            out.append(Segment(m.group(1), m.group(2), in_target))
        else:
            out.append(Segment(tok, None, in_target))
    if pos != len(ruby) or in_target:
        raise ValueError(f"cú pháp ruby lỗi (thiếu ]] hoặc ký tự lạ): {ruby!r}")
    return out


def _bare_kanji(segs: Iterable[Segment]) -> list[str]:
    return [s.text for s in segs if s.reading is None and CJK.search(s.text)]


@dataclass
class CounterReport:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def _reading_ok(c: Counter, n: int, kana: str) -> bool | None:
    """True/False nếu xác định được; None nếu n không có trong bảng và nhóm không đoán được."""
    for r in c.readings:
        if r.n == n:
            return kana == r.kana or kana in r.alt
    cand = candidates(n, c.kana, c.sound_group)
    parts = number_parts(n)
    # số > 10 tận cùng 4/7/9: theo cách đọc riêng của ô 4/7/9 (84円 はちじゅうよえん, 17時 じゅうしちじ)
    digit = {"よん": 4, "なな": 7, "きゅう": 9}.get(parts[-1])
    if digit and len(parts) > 1:
        for r in c.readings:
            if r.n == digit and r.irregular:
                cand |= {"".join(parts[:-1]) + k for k in (r.kana, *r.alt)}
    return (kana in cand) if cand else None


def check_counter_example(c: Counter, ex: CounterExample, rep: CounterReport) -> None:
    where = f"{c.id} {ex.id}"
    if not ex.id.startswith(c.id + "-e"):
        rep.errors.append(f"{where}: id ví dụ phải bắt đầu bằng {c.id}-e")
    try:
        segs = parse_ruby(ex.ruby)
    except ValueError as e:
        rep.errors.append(f"{where}: {e}")
        return
    bare = _bare_kanji(segs)
    if bare:
        rep.errors.append(f"{where}: chữ Hán thiếu furigana: {bare}")
    hits = 0
    for s in segs:
        if not s.target or s.reading is None:
            continue
        m = _NUM_SEG.match(s.text)
        # số thuần Nhật có ô không kèm trợ số từ: 10 → とお (không có つ)
        bare_native = bool(m) and c.sound_group == "native" and m.group(2) == ""  # type: ignore[union-attr]
        if not m or (m.group(2) != c.char and not bare_native):
            continue
        hits += 1
        if m.group(1) == "何":
            if s.reading != c.question.kana and s.reading not in c.question.alt:
                rep.errors.append(f"{where}: {s.text} đọc {s.reading}, bảng ghi {c.question.kana}")
            continue
        n = int(m.group(1).replace(",", ""))
        ok = _reading_ok(c, n, s.reading)
        if ok is False:
            rep.errors.append(f"{where}: {s.text} đọc {s.reading} — không khớp bảng/quy tắc biến âm")
        elif ok is None:
            rep.warnings.append(f"{where}: {s.text} ({s.reading}) ngoài bảng, chưa kiểm được")
    if not hits:
        rep.errors.append(f"{where}: [[…]] phải chứa {{số{c.char}|cách đọc}} hoặc {{何{c.char}|…}}")


_NUM_TOKEN = re.compile(r"^[-−]?\d[\d,]*(?:\.\d+)?(?:%|/\d+|分の\d+|(?:-\d+)+)?")


def check_number_example(ex: CounterExample, rep: CounterReport) -> None:
    if not ex.id.startswith("num-e"):
        rep.errors.append(f"{ex.id}: id ví dụ số đếm phải là num-eNN")
    try:
        segs = parse_ruby(ex.ruby)
    except ValueError as e:
        rep.errors.append(f"{ex.id}: {e}")
        return
    bare = _bare_kanji(segs)
    if bare:
        rep.errors.append(f"{ex.id}: chữ Hán thiếu furigana: {bare}")
    nums = [(s, m.group(0)) for s in segs if s.target and s.reading and (m := _NUM_TOKEN.match(s.text))]
    if not nums:
        rep.errors.append(f"{ex.id}: [[…]] phải chứa {{số|cách đọc}}")
    for s, tok in nums:
        ok = reading_matches(tok, s.reading or "", prefix=True)
        if ok is False:
            if re.fullmatch(r"\d[\d,]*", tok) and tok != s.text:
                # số nguyên + trợ số từ có thể biến âm (4年 よねん, 1000円 せんえん) → chỉ cảnh báo
                rep.warnings.append(f"{ex.id}: {s.text} đọc {s.reading} — phần số không khớp cách đọc riêng")
            else:
                rep.errors.append(f"{ex.id}: {s.text} đọc {s.reading} — không khớp cách đọc số")


# ---------------------------------------------------------------- kiểm tra bảng


def check_counter(c: Counter, rep: CounterReport) -> None:
    ns = [r.n for r in c.readings]
    if ns != sorted(set(ns)):
        rep.errors.append(f"{c.id}: readings phải tăng dần, không trùng n: {ns}")
    missing = [n for n in range(1, 11) if n not in ns]
    if missing:
        rep.errors.append(f"{c.id}: thiếu cách đọc cho {missing}")
    if not c.large_vi:
        rep.errors.append(f"{c.id}: thiếu mô tả cách đếm hàng chục/trăm/nghìn/vạn (large_vi)")
    for r in c.readings:
        cand = candidates(r.n, c.kana, c.sound_group)
        if not cand:
            continue
        if r.irregular and r.kana in cand:
            rep.errors.append(f"{c.id} {r.n}: {r.kana} hợp quy tắc nhóm {c.sound_group} nhưng đánh dấu irregular")
        if not r.irregular and r.kana not in cand:
            rep.errors.append(f"{c.id} {r.n}: {r.kana} không khớp quy tắc nhóm {c.sound_group} "
                              f"({' / '.join(sorted(cand))}) — sửa hoặc đánh dấu irregular")
    qc = question_candidates(c.kana, c.sound_group)
    if qc and c.question.kana not in qc and not c.question.note:
        rep.errors.append(f"{c.id}: từ để hỏi {c.question.kana} không khớp quy tắc ({' / '.join(sorted(qc))}) — thêm note giải thích")
    ids = [e.id for e in c.examples]
    if len(ids) != len(set(ids)):
        rep.errors.append(f"{c.id}: id ví dụ trùng")
    for ex in c.examples:
        check_counter_example(c, ex, rep)


def check_numbers(num: NumberSystem, rep: CounterReport) -> None:
    for tab in num.tabs:
        for sec in tab.sections:
            for it in sec.items:
                oks = [reading_matches(it.display, k) for k in (it.kana, *it.alt)]
                if oks and oks[0] is not None and not any(oks):
                    rep.errors.append(f"số {it.display}: '{it.kana}' (và cách đọc khác) không khớp quy tắc đọc số")
        for ex in tab.examples:
            check_number_example(ex, rep)
    total = sum(len(t.examples) for t in num.tabs)
    if total < 10:
        rep.errors.append(f"số đếm: cần ≥10 câu ví dụ (có {total})")


# ---------------------------------------------------------------- dựng file


def _kanji_refs(char: str) -> list[str]:
    out: list[str] = []
    for ch in char:
        if CJK.match(ch) and f"k-{ch}" not in out:
            out.append(f"k-{ch}")
    return out


def _vocab_refs(char: str, kana: str, vocab: list[VocabEntry], rep: CounterReport) -> list[str]:
    """Từ vựng Minna ～X: khớp cả chữ (～本) lẫn cách đọc (～ほん) để tách ～人 にん / じん.
    Cùng chữ khác cách đọc → cảnh báo (có thể là lỗi dữ liệu từ vựng, vd ～個 ghi ～ご)."""
    out = []
    for v in vocab:
        if v.book != "minna" or v.kana[:1] not in "～〜":
            continue
        vk = v.kana.lstrip("～〜")
        vj = (v.kanji or v.kana).lstrip("～〜")
        if vj != char:
            continue
        if vk == kana:
            out.append(v.id)
        elif not (char == "人" and vk == "じん"):
            rep.warnings.append(f"{v.id} ～{char}: từ vựng ghi ～{vk}, trợ số từ đọc ～{kana} — không liên kết")
    return out


def build_counters(spec_counters: list[dict[str, object]], numbers: dict[str, object],
                   sound_rules: list[dict[str, object]], examples: dict[str, list[CounterExample]],
                   vocab: list[VocabEntry]) -> tuple[CounterFile, CounterReport]:
    """spec (enrichment JSON) + câu ví dụ + từ vựng → CounterFile. Lỗi dữ liệu nằm trong report.errors."""
    rep = CounterReport()
    counters: list[Counter] = []
    seen: set[str] = set()
    for raw in spec_counters:
        cid = str(raw["id"])
        if cid in seen:
            rep.errors.append(f"{cid}: id trùng")
        seen.add(cid)
        vrefs = _vocab_refs(str(raw["char"]), str(raw["kana"]), vocab, rep)
        lessons = [int(v[3:5]) for v in vrefs]
        try:
            c = Counter.model_validate({
                **raw,
                "lesson": min(lessons) if lessons else None,
                "vocab_refs": vrefs,
                "kanji_refs": _kanji_refs(str(raw["char"])),
                "readings": [CounterReading.model_validate(r) for r in raw["readings"]],  # type: ignore[attr-defined]
                "question": CounterQuestion.model_validate(raw["question"]),
                "examples": examples.get(cid, []),
            })
        except ValidationError as ex:
            rep.errors.append(f"{cid}: " + "; ".join(f"{'.'.join(map(str, e['loc']))}: {e['msg']}" for e in ex.errors()))
            continue
        check_counter(c, rep)
        counters.append(c)
    unknown = sorted(set(examples) - seen - {"num"})
    if unknown:
        rep.errors.append(f"câu ví dụ cho trợ số từ không tồn tại: {unknown}")

    num_ex = {e.id: e for e in examples.get("num", [])}
    used: list[str] = []
    tabs = []
    for t in numbers["tabs"]:  # type: ignore[attr-defined]
        ids = list(t.get("examples", []))
        missing = [i for i in ids if i not in num_ex]
        if missing:
            rep.errors.append(f"tab số đếm {t['id']}: câu ví dụ không tồn tại {missing}")
        used += ids
        tabs.append({**t, "examples": [num_ex[i] for i in ids if i in num_ex]})
    orphan = sorted(set(num_ex) - set(used))
    dup = sorted({i for i in used if used.count(i) > 1})
    if orphan or dup:
        rep.errors.append(f"câu ví dụ số đếm chưa gán tab: {orphan} / gán nhiều tab: {dup}")
    num = NumberSystem.model_validate({"intro_vi": numbers["intro_vi"], "tabs": tabs})
    check_numbers(num, rep)

    rules = [SoundRule.model_validate({**r, "counters": [c.id for c in counters if c.sound_group == r["group"]]})
             for r in sound_rules]
    missing = {c.sound_group for c in counters} - {r.group for r in rules}
    if missing:
        rep.errors.append(f"thiếu mô tả nhóm biến âm: {sorted(missing)}")
    return CounterFile(numbers=num, sound_rules=rules, counters=counters), rep


def parse_examples(text: str) -> dict[str, list[CounterExample]]:
    """Dòng 'c-hon-e01|ruby|vi[|review]' — # là chú thích. Khóa = id trợ số từ (hoặc 'num')."""
    out: dict[str, list[CounterExample]] = {}
    for i, line in enumerate(text.splitlines(), 1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split("|")
        # ruby có thể chứa '|' bên trong {漢字|かな} → tách id ở đầu, vi (và review) ở cuối
        review = "auto"
        if parts[-1] in ("auto", "ai", "user"):
            review = parts.pop()
        if len(parts) < 3:
            raise ValueError(f"dòng {i}: cần 'id|ruby|vi': {line!r}")
        eid, vi, ruby = parts[0], parts[-1], "|".join(parts[1:-1])
        key = eid.rsplit("-e", 1)[0]
        out.setdefault(key, []).append(CounterExample.model_validate(
            {"id": eid, "ruby": ruby, "vi": vi, "source": "ai-draft", "review": review}))
    return out
