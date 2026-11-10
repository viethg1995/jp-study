"""Entry point: python -m jp_pipeline <command>.

Luồng PDF:  score-pdf → extract-pdf → (status / show / export-queue)
AI chỉ đọc output của các lệnh này, KHÔNG đọc PDF trong sources/ trực tiếp.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from fnmatch import fnmatch
from pathlib import Path

from jp_pipeline import paths

# ---------------------------------------------------------------- helpers


def _nfc(text: str) -> str:
    import unicodedata

    return unicodedata.normalize("NFC", text)


def _rel(pdf: Path) -> str:
    return _nfc(pdf.relative_to(paths.SOURCES).as_posix())


def _discover_pdfs(include_grammar: bool = False) -> list[Path]:
    roots = [paths.SRC_BOOKS, paths.SRC_KANJI]
    if include_grammar:
        roots.append(paths.SRC_GRAMMAR_PDF)
    return sorted(p for root in roots for p in root.rglob("*.pdf"))


def _match(pdfs: list[Path], pattern: str | None) -> list[Path]:
    """Lọc theo tên/đường dẫn; không có ký tự đại diện thì hiểu là 'chứa chuỗi'."""
    if not pattern:
        return pdfs
    pat = _nfc(pattern).lower()
    if not any(c in pat for c in "*?["):
        pat = f"*{pat}*"
    return [p for p in pdfs if fnmatch(_rel(p).lower(), pat)]


def _one_pdf(pattern: str) -> Path | None:
    found = _match(_discover_pdfs(include_grammar=True), pattern)
    if len(found) != 1:
        print(f"'{pattern}' khớp {len(found)} file — cần đúng 1:")
        for p in found:
            print(f"  - {_rel(p)}")
        return None
    return found[0]


def _out_dir(pdf: Path) -> Path:
    from jp_pipeline.extract.pdf_to_md import output_dir_for

    return output_dir_for(pdf, paths.SOURCES, paths.EXTRACTED)


def _read_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )


# ---------------------------------------------------------------- check / build


def cmd_check(_: argparse.Namespace) -> int:
    """Kiểm tra cấu trúc sources/ đã sẵn sàng."""
    required = [paths.SRC_VOCABULARY, paths.SRC_GRAMMAR_MD, paths.SRC_COUNTERS, paths.SRC_KANJI]
    ok = True
    for p in required:
        exists = p.is_dir() and any(p.iterdir())
        print(f"[{'OK' if exists else 'MISSING'}] {p.relative_to(paths.ROOT)}")
        ok &= exists
    return 0 if ok else 1


def cmd_build(_: argparse.Namespace) -> int:
    """sources + enrichment → data/ (hiện có: từ vựng). Lỗi validate → không ghi gì, exit 1."""
    from jp_pipeline.dictionaries import load_kanjidic
    from jp_pipeline.schemas import VocabLesson
    from jp_pipeline.transform.vocab_auto import AutoVocab, SourceVocab
    from jp_pipeline.transform.vocab_build import build_vocab, summarize

    files = sorted(paths.SRC_VOCABULARY.glob("bai_*.json"), key=lambda p: int(p.stem.split("_")[1]))
    rows = [SourceVocab.model_validate(r) for f in files for r in _read_json(f)]  # type: ignore[union-attr]
    auto = {
        a.id: a
        for f in paths.ENRICH_VOCAB_AUTO.glob("lesson-*.json")
        for a in (AutoVocab.model_validate(r) for r in _read_json(f))  # type: ignore[union-attr]
    }
    if not auto:
        print("Chưa có enrichment/_auto — chạy: python -m jp_pipeline enrich-vocab")
        return 1
    reviewed: dict[str, dict[str, object]] = {}
    for f in sorted(paths.ENRICH_VOCAB.glob("lesson-*.json")):
        reviewed.update(_read_json(f))  # type: ignore[arg-type]
    kanjidic = load_kanjidic(paths.DICT_KANJIDIC, paths.DICT_INDEX / "kanjidic2.json")

    entries, report = build_vocab(rows, auto, reviewed, kanjidic)
    _write_json(paths.ENRICH_VOCAB_AUTO / "build-report.json", report.model_dump())
    if report.errors:
        print(f"BUILD FAIL — {len(report.errors)} lỗi (không ghi data/):")
        for e in report.errors[:20]:
            print(f"  - {e}")
        return 1

    by_lesson: dict[int, list] = {}
    for e in entries:
        by_lesson.setdefault(e.lesson, []).append(e)
    for lesson, items in sorted(by_lesson.items()):
        doc = VocabLesson(lesson=lesson, entries=items)
        _write_json(paths.OUT_VOCABULARY / f"lesson-{lesson:02d}.json", doc.model_dump(mode="json"))
    _write_json(paths.DATA_SCHEMA / "vocabulary.schema.json", VocabLesson.model_json_schema())

    s = summarize(entries)
    print(f"OK — {len(entries)} từ, {len(by_lesson)} bài → {paths.OUT_VOCABULARY.relative_to(paths.ROOT)}/")
    print(f"  duyệt     : {dict(s['review'])}")
    print(f"  kanji     : {dict(s['kanji'])}")
    print(f"  Hán-Việt  : {dict(s['han_viet'])}")
    print(f"  cảnh báo  : {len(report.warnings)} | chờ duyệt: {len(report.pending_review)} "
          f"| chữ Hán nhiều âm: {len(report.han_viet_conflicts)}")
    print(f"  chi tiết  : {(paths.ENRICH_VOCAB_AUTO / 'build-report.json').relative_to(paths.ROOT)}")
    n3_entries, n3_kanji = _build_n3(entries)
    if n3_entries:
        from jp_pipeline.transform.vocab_build import cross_link_books

        entries, n3_entries = cross_link_books(entries, n3_entries)
        for book_entries, out_dir, book in ((entries, paths.OUT_VOCABULARY, "minna"),
                                            (n3_entries, paths.OUT_VOCABULARY / "n3", "n3")):
            grouped: dict[int, list] = {}  # type: ignore[type-arg]
            for e in book_entries:
                grouped.setdefault(e.lesson, []).append(e)
            for lesson, items in sorted(grouped.items()):
                doc = VocabLesson(book=book, lesson=lesson, entries=items)  # type: ignore[arg-type]
                _write_json(out_dir / f"lesson-{lesson:02d}.json", doc.model_dump(mode="json"))
        print(f"  liên kết Minna ↔ N3: {sum(1 for e in n3_entries if any(i.startswith('mn-') for i in e.same_word))} từ N3")
    rc = _build_kanji(entries + n3_entries, kanjidic, n3_kanji)
    return rc or _build_conjugation(entries + n3_entries)


def _build_conjugation(vocab: list) -> int:  # type: ignore[type-arg]
    """Từ vựng (động từ, tính từ, danh từ ví dụ) + enrichment/conjugation/forms.json → data/conjugation.json."""
    from collections import Counter

    from jp_pipeline.schemas import ConjugationFile
    from jp_pipeline.transform.conjugation import build_conjugation

    spec = _read_json(paths.ENRICH_CONJ / "forms.json")
    try:
        doc, rep = build_conjugation(vocab, spec)  # type: ignore[arg-type]
    except ValueError as ex:
        print(f"CHIA THỂ FAIL — {ex}")
        return 1
    _write_json(paths.OUT_CONJUGATION, doc.model_dump(mode="json"))  # type: ignore[attr-defined]
    _write_json(paths.DATA_SCHEMA / "conjugation.schema.json", ConjugationFile.model_json_schema())
    kinds = Counter(e.kind for e in doc.entries)  # type: ignore[attr-defined]
    print(f"  chia thể  : {rep.entries} từ {dict(kinds)} | trùng bỏ qua {rep.duplicates} "
          f"| không gắn furigana {len(rep.no_ruby or [])}{' ' + ', '.join((rep.no_ruby or [])[:10]) if rep.no_ruby else ''}")
    return 0


def _build_n3(minna: list) -> tuple[list, dict[str, tuple[int, str | None]]]:  # type: ignore[type-arg]
    """Từ vựng N3 → data/vocabulary/n3/lesson-XX.json; trả (entries, {字: (bài N3, Hán-Việt)}) cho Kanji.
    Cần sources/_extracted/books/N3/_parsed/ (chạy parse-n3) — thiếu thì bỏ qua N3."""
    from jp_pipeline.dictionaries import load_jmdict
    from jp_pipeline.schemas import VocabLesson
    from jp_pipeline.transform.kanji_build import char_readings_from_vocab
    from jp_pipeline.transform.n3_build import build_n3_vocab, parse_fixes
    from jp_pipeline.transform.n3_kanji import N3KanjiRaw
    from jp_pipeline.transform.n3_vocab import N3VocabRaw
    from jp_pipeline.transform.vocab_auto import normalize_han_viet

    parsed = paths.EXTRACTED / "books" / "N3" / "_parsed"
    if not (parsed / "vocab.json").exists():
        print("N3: chưa có dữ liệu đã phân tích (python -m jp_pipeline parse-n3) — bỏ qua.")
        return [], {}
    enrich = paths.ROOT / "pipeline" / "enrichment" / "n3"

    # Kanji N3: {字: (bài, Hán-Việt)} — chuẩn hóa dấu + sửa lỗi sách (kanji-fixes.txt: 字|ÂM, '-' = không có)
    kfix: dict[str, str | None] = {}
    kf = enrich / "kanji-fixes.txt"
    if kf.exists():
        for ln in kf.read_text(encoding="utf-8").splitlines()[1:]:
            if ln.strip() and not ln.startswith("#"):
                # 字|ÂM|ghi chú — cột 2 là âm (trước đây lấy nhầm cột 3 = ghi chú)
                ch, hv = (x.strip() for x in [*ln.split("|"), ""][:2])
                kfix[ch] = None if hv in ("-", "") else hv
    n3_kanji: dict[str, tuple[int, str | None]] = {}
    for k in (N3KanjiRaw.model_validate(x) for x in _read_json(parsed / "kanji.json")):  # type: ignore[union-attr]
        if k.char and k.char not in n3_kanji:
            hv = kfix[k.char] if k.char in kfix else normalize_han_viet(k.han_viet)
            n3_kanji[k.char] = (k.lesson, hv)

    from jp_pipeline.dictionaries import load_unihan_vi

    # Âm từng chữ (kèm nguồn): Minna > file duyệt (user/ai) > sách Kanji N3 > Unihan
    readings = char_readings_from_vocab(minna)
    char_hv: dict[str, tuple[str, str]] = {c: (cnt.most_common(1)[0][0], "minna") for c, cnt in readings.items()}
    for c, (hv, src) in _hanviet_files().items():
        if c not in char_hv and hv:
            char_hv[c] = (hv, "user" if src == "user" else "ai")
    for c, (_, hv) in n3_kanji.items():
        if c not in char_hv and hv:
            char_hv[c] = (hv, "n3book")
    for c, vals in load_unihan_vi(paths.DICT_UNIHAN, paths.DICT_INDEX / "unihan_vi.json").items():
        if c not in char_hv and vals:
            char_hv[c] = (normalize_han_viet(vals[0].upper()) or "", "unihan")

    fix_file = enrich / "vocab-fixes.txt"
    fix_by, fixes = parse_fixes(fix_file.read_text(encoding="utf-8")) if fix_file.exists() else ("ai", [])
    raws = [N3VocabRaw.model_validate(x) for x in _read_json(parsed / "vocab.json")]  # type: ignore[union-attr]
    jm = load_jmdict(paths.DICT_JMDICT, paths.DICT_INDEX / "jmdict.json")
    from jp_pipeline.transform.n3_build import parse_examples

    ex_files = sorted((enrich / "_examples").glob("lesson-*.txt"))
    n3_examples = parse_examples([(f.name, f.read_text(encoding="utf-8")) for f in ex_files])
    entries, warnings = build_n3_vocab(raws, fixes, fix_by, jm, char_hv, n3_examples)

    out_dir = paths.OUT_VOCABULARY / "n3"
    by_lesson: dict[int, list] = {}  # type: ignore[type-arg]
    for e in entries:
        by_lesson.setdefault(e.lesson, []).append(e)
    for lesson, items in sorted(by_lesson.items()):
        doc = VocabLesson(book="n3", lesson=lesson, entries=items)
        _write_json(out_dir / f"lesson-{lesson:02d}.json", doc.model_dump(mode="json"))
    _write_json(enrich / "_auto" / "build-report.json", {"warnings": warnings})
    pos_src: dict[str, int] = {}
    for e in entries:
        pos_src[e.provenance.pos] = pos_src.get(e.provenance.pos, 0) + 1
    print(f"OK — N3: {len(entries)} từ, {len(by_lesson)} bài → {out_dir.relative_to(paths.ROOT)}/ | "
          f"từ loại {pos_src} | Hán-Việt {sum(1 for e in entries if e.han_viet)}/{sum(1 for e in entries if e.kanji)} "
          f"| cảnh báo {len(warnings)}")
    return entries, n3_kanji


def _hanviet_files() -> dict[str, tuple[str | None, str]]:
    from jp_pipeline.transform.kanji_build import parse_hanviet_files

    d = paths.ENRICH_KANJI / "hanviet"
    return parse_hanviet_files([(f.name, f.read_text(encoding="utf-8")) for f in sorted(d.glob("*.txt"))])


def _build_kanji(entries: list, kanjidic: dict, n3: dict | None = None) -> int:  # type: ignore[type-arg]
    """data/kanji/radicals.json + kanji.json (+ JSON Schema)."""
    from jp_pipeline.dictionaries import load_unihan_vi
    from jp_pipeline.schemas import KanjiFile, RadicalFile
    from jp_pipeline.transform.kanji_build import (
        build_kanji,
        parse_lesson_files,
        parse_meanings,
        parse_radicals,
        parse_stories,
    )

    rad_md = next(iter(paths.EXTRACTED.glob("kanji/214*/content.md")), None)
    if rad_md is None:
        print("Thiếu bảng 214 bộ thủ — chạy: python -m jp_pipeline extract-pdf --only 214")
        return 1
    radicals = parse_radicals(rad_md.read_text(encoding="utf-8"))
    unihan = load_unihan_vi(paths.DICT_UNIHAN, paths.DICT_INDEX / "unihan_vi.json")
    meanings = parse_meanings(
        [(f.name, f.read_text(encoding="utf-8")) for f in sorted(paths.ENRICH_KANJI.glob("*.txt"))]
    )
    # Danh sách chữ theo bài của Ebook Kanji N5/N4 — file commit (N4: parse-kanji-ebooks, N5: AI đọc ảnh)
    ebook = parse_lesson_files(
        [(f.name, f.read_text(encoding="utf-8")) for f in sorted((paths.ENRICH_KANJI / "lessons").glob("*.txt"))]
    )
    kanji, report = build_kanji(entries, kanjidic, unihan, meanings, n3, _hanviet_files(), ebook)
    kanji, ex_report = _kanji_examples(kanji, entries, kanjidic)
    stories = parse_stories(
        [(f.name, f.read_text(encoding="utf-8")) for f in sorted((paths.ENRICH_KANJI / "stories").glob("*.txt"))]
    )
    unknown = sorted(set(stories) - {k.char for k in kanji})
    if unknown:
        print(f"Lỗi: câu chuyện cho chữ không có trong kanji.json: {''.join(unknown)}")
        return 1
    kanji = [k.model_copy(update={"story": stories[k.char][0], "story_source": stories[k.char][1]})
             if k.char in stories else k for k in kanji]

    _write_json(paths.OUT_KANJI / "radicals.json",
                RadicalFile(source="PDF 214 bộ thủ Kanji (tự tổng hợp)", radicals=radicals).model_dump(mode="json"))
    _write_json(paths.OUT_KANJI / "kanji.json", KanjiFile(kanji=kanji).model_dump(mode="json"))
    _write_json(paths.DATA_SCHEMA / "radicals.schema.json", RadicalFile.model_json_schema())
    _write_json(paths.DATA_SCHEMA / "kanji.schema.json", KanjiFile.model_json_schema())
    _write_json(paths.ENRICH_VOCAB_AUTO.parent.parent / "kanji-report.json", report.model_dump())

    print(f"OK — {len(kanji)} kanji, {len(radicals)} bộ thủ → {paths.OUT_KANJI.relative_to(paths.ROOT)}/")
    m_src: dict[str, int] = {}
    for k in kanji:
        m_src[str(k.meaning_vi_source)] = m_src.get(str(k.meaning_vi_source), 0) + 1
    print(f"  nghĩa tiếng Việt: {m_src} | thừa trong file nghĩa: {''.join(report.meaning_unused)}")
    print(f"  thiếu Hán-Việt: {len(report.no_han_viet)} {''.join(report.no_han_viet[:30])}")
    print(f"  không có trong KANJIDIC2: {len(report.not_in_kanjidic)} {''.join(report.not_in_kanjidic)}")
    print(f"  nhiều âm Hán-Việt: {len(report.multi_reading)}")
    print(f"  mẹo nhớ: {sum(1 for k in kanji if k.story)}/{len(kanji)}")
    print(f"  ví dụ: +{ex_report.jmdict_added} từ JMdict | chưa dịch {ex_report.untranslated} "
          f"| không rõ On/Kun {ex_report.unclassified} | chữ < 5 ví dụ: {len(ex_report.below_min)} "
          f"{''.join(ex_report.below_min)}")
    return _build_strokes(kanji, radicals)


def _kanji_examples(kanji: list, entries: list, kanjidic: dict):  # type: ignore[no-untyped-def,type-arg]
    """Từ ví dụ On/Kun cho từng chữ (giáo trình + JMdict) — xem transform/kanji_examples.py."""
    from jp_pipeline.dictionaries import load_jmdict
    from jp_pipeline.transform.kanji_examples import build_examples, parse_example_translations

    jm = load_jmdict(paths.DICT_JMDICT, paths.DICT_INDEX / "jmdict.json")
    d = paths.ENRICH_KANJI / "examples"
    tr = parse_example_translations([(f.name, f.read_text(encoding="utf-8")) for f in sorted(d.glob("*.txt"))])
    kanji, rep = build_examples(kanji, entries, jm, kanjidic, tr)
    _write_json(paths.ENRICH_VOCAB_AUTO.parent.parent / "kanji-examples-report.json", rep.model_dump())
    return kanji, rep


def cmd_kanji_stories_todo(args: argparse.Namespace) -> int:
    """In chữ chưa có mẹo nhớ: 字|Hán-Việt|nghĩa|thành phần (đọc data/kanji/*.json)."""
    from jp_pipeline.schemas import KanjiFile, StrokeFile

    kf = KanjiFile.model_validate(_read_json(paths.OUT_KANJI / "kanji.json"))
    sf = StrokeFile.model_validate(_read_json(paths.OUT_KANJI / "strokes.json"))
    comps = {s.char: s.components for s in sf.kanji}
    todo = []
    for k in kf.kanji:
        if k.story:
            continue
        parts = " + ".join(
            f"{c.char}{'(' + c.original + ')' if c.original else ''}"
            f"{' ' + c.name_vi if c.name_vi else ''}{' ' + c.meaning_vi if c.meaning_vi else ''}"
            for c in comps.get(k.char, [])
        )
        todo.append(f"{k.char}|{'/'.join(k.han_viet) or '-'}|{k.meaning_vi or '-'}|{parts or '(chữ đơn)'}")
    print(f"# {len(todo)} chữ chưa có mẹo nhớ — in {args.offset}..{args.offset + args.limit}")
    for line in todo[args.offset:args.offset + args.limit]:
        print(line)
    return 0


def cmd_kanji_examples_todo(args: argparse.Namespace) -> int:
    """In các từ ví dụ JMdict chưa có nghĩa tiếng Việt (từ|kana|nghĩa EN) — đọc data/kanji/kanji.json."""
    from jp_pipeline.schemas import KanjiFile

    kf = KanjiFile.model_validate(_read_json(paths.OUT_KANJI / "kanji.json"))
    seen: set[tuple[str, str]] = set()
    todo: list[str] = []
    for k in kf.kanji:
        for e in k.examples:
            if e.source == "jmdict" and e.meaning_vi is None and (e.word, e.kana) not in seen:
                seen.add((e.word, e.kana))
                todo.append(f"{e.word}|{e.kana}|{e.meaning_en}")
    print(f"# {len(todo)} từ chưa dịch — in {args.offset}..{args.offset + args.limit}")
    for line in todo[args.offset:args.offset + args.limit]:
        print(line)
    return 0


def _build_strokes(kanji: list, radicals: list) -> int:  # type: ignore[type-arg]
    """KanjiVG zip → data/kanji/strokes.json (chỉ các chữ trong kanji.json) + báo cáo lệch số nét."""
    import zipfile

    from jp_pipeline.schemas import StrokeFile
    from jp_pipeline.transform.kanji_strokes import build_strokes, kanjivg_filename

    zips = sorted(paths.DICT_KANJIVG.glob("kanjivg-*-main.zip"))
    if not zips:
        print(f"Thiếu KanjiVG — tải kanjivg-YYYYMMDD-main.zip (github.com/KanjiVG/kanjivg/releases) vào {paths.DICT_KANJIVG}")
        return 1
    src = zips[-1]
    with zipfile.ZipFile(src) as z:
        names = set(z.namelist())
        svgs = {k.char: z.read(kanjivg_filename(k.char)).decode("utf-8")
                for k in kanji if kanjivg_filename(k.char) in names}
    # Tên thành phần: chữ trong bộ Kanji (âm HV + nghĩa đầu) trước, bảng 214 bộ thủ sau
    def short(m: str | None) -> str | None:
        """Nghĩa đầu tiên, bỏ phần trong ngoặc: 'phủ (đơn vị hành chính…), …' → 'phủ'."""
        if not m:
            return None
        bare = re.sub(r"\s*[(（][^)）]*[)）]?", "", m).strip() or m.strip("()（） ")
        return bare.replace(";", ",").split(",")[0].strip() or None

    names: dict[str, tuple[str | None, str | None]] = {}
    for r in radicals:
        for c in [r.char, *r.variants]:
            names[c] = (r.name_vi.upper(), short(r.meaning_vi.lower() if r.meaning_vi else None))
    for k in kanji:
        if k.han_viet or k.meaning_vi:
            names[k.char] = (k.han_viet[0] if k.han_viet else names.get(k.char, (None, None))[0], short(k.meaning_vi))
    strokes, rep = build_strokes(kanji, svgs, names)
    version = src.stem.split("-")[1]
    _write_json(paths.OUT_KANJI / "strokes.json", StrokeFile(
        source=f"KanjiVG {version} — Ulrich Apel, https://kanjivg.tagaini.net",
        license="CC BY-SA 3.0",
        kanji=strokes,
    ).model_dump(mode="json"))
    _write_json(paths.DATA_SCHEMA / "strokes.schema.json", StrokeFile.model_json_schema())
    _write_json(paths.ENRICH_VOCAB_AUTO.parent.parent / "strokes-report.json", rep.model_dump())
    print(f"OK — nét viết KanjiVG {version}: {rep.total}/{len(kanji)} chữ | thiếu {len(rep.missing)} "
          f"{''.join(rep.missing)} | lệch số nét với KANJIDIC2: {len(rep.count_mismatch)} "
          f"{' '.join(f'{c}{a}/{b}' for c, (a, b) in rep.count_mismatch.items())}")
    return 0


# ---------------------------------------------------------------- score-pdf


def _ensure_score(pdf: Path, force: bool):  # -> DocScore
    from jp_pipeline.extract.pdf_score import (
        SCORER_VERSION,
        DocScore,
        load_overrides,
        score_pdf,
    )
    from jp_pipeline.extract.pdf_to_md import sha256_file

    rel = _rel(pdf)
    score_path = _out_dir(pdf) / "score.json"
    sha = sha256_file(pdf)
    overrides = load_overrides(paths.ROUTE_OVERRIDES, rel)
    if not force and score_path.exists():
        cached = DocScore.model_validate(_read_json(score_path))
        if (
            cached.sha256 == sha
            and cached.scorer_version == SCORER_VERSION
            and cached.overrides == overrides
        ):
            return cached, False
    score = score_pdf(pdf, source=rel, sha256=sha, overrides=overrides)
    _write_json(score_path, score.model_dump())
    return score, True


def _update_routing_summary(scores: list) -> None:  # list[DocScore]
    summary: dict[str, dict[str, object]] = {}
    if paths.ROUTING_SUMMARY.exists():
        summary = {r["source"]: r for r in _read_json(paths.ROUTING_SUMMARY)}  # type: ignore[union-attr]
    for s in scores:
        summary[s.source] = {
            "source": s.source,
            "pages": s.pages,
            "counts": s.counts,
            "est_ai_tokens": s.est_ai_tokens,
            "scored_on": s.scored_on,
        }
    _write_json(paths.ROUTING_SUMMARY, [summary[k] for k in sorted(summary)])


def cmd_score_pdf(args: argparse.Namespace) -> int:
    pdfs = _match(_discover_pdfs(args.include_grammar), args.only)
    if not pdfs:
        print("Không có PDF nào khớp.")
        return 1
    done = []
    for idx, pdf in enumerate(pdfs, 1):
        score, fresh = _ensure_score(pdf, args.force)
        done.append(score)
        tag = "SCORE" if fresh else "SKIP "
        print(f"[{idx}/{len(pdfs)}] {tag} {score.source}")
    _update_routing_summary(done)
    print()
    return cmd_status(args)


# ---------------------------------------------------------------- status


def cmd_status(_: argparse.Namespace) -> int:
    """In bảng tóm tắt route — nguồn thông tin rẻ nhất cho AI về sources/."""
    if not paths.ROUTING_SUMMARY.exists():
        print("Chưa có routing.json — chạy: python -m jp_pipeline score-pdf")
        return 1
    rows = _read_json(paths.ROUTING_SUMMARY)
    hdr = f"{'source':<48} {'trang':>5} {'script':>6} {'hybrid':>6} {'ocr':>5} {'ai':>4} {'skip':>4} {'~token AI':>10}"
    print(hdr)
    print("-" * len(hdr))
    tot = {"pages": 0, "script": 0, "hybrid": 0, "ocr": 0, "ai": 0, "skip": 0, "tok": 0}
    for r in rows:  # type: ignore[union-attr]
        c = r["counts"]
        name = r["source"] if len(r["source"]) <= 48 else "…" + r["source"][-47:]
        print(
            f"{name:<48} {r['pages']:>5} {c['script']:>6} {c['hybrid']:>6} {c['ocr']:>5} "
            f"{c['ai']:>4} {c['skip']:>4} {r['est_ai_tokens']:>10,}"
        )
        tot["pages"] += r["pages"]
        tot["tok"] += r["est_ai_tokens"]
        for k in ("script", "hybrid", "ocr", "ai", "skip"):
            tot[k] += c[k]
    print("-" * len(hdr))
    print(
        f"{'TỔNG':<48} {tot['pages']:>5} {tot['script']:>6} {tot['hybrid']:>6} {tot['ocr']:>5} "
        f"{tot['ai']:>4} {tot['skip']:>4} {tot['tok']:>10,}"
    )
    return 0


# ---------------------------------------------------------------- extract-pdf


def cmd_extract_pdf(args: argparse.Namespace) -> int:
    from jp_pipeline.extract.pdf_to_md import EXTRACTOR_VERSION, extract_pdf

    pdfs = _match(_discover_pdfs(args.include_grammar), args.only)
    if not pdfs:
        print("Không có PDF nào khớp.")
        return 1

    manifest: dict[str, dict[str, object]] = {}
    if paths.EXTRACTED_MANIFEST.exists():
        manifest = {r["source"]: r for r in _read_json(paths.EXTRACTED_MANIFEST)}  # type: ignore[union-attr]

    failed: list[str] = []
    scores = []
    for idx, pdf in enumerate(pdfs, 1):
        score, rescored = _ensure_score(pdf, force=False)
        scores.append(score)
        out_md = _out_dir(pdf) / "content.md"
        prev = manifest.get(score.source)
        if (
            not args.force
            and not rescored
            and out_md.exists()
            and prev is not None
            and prev.get("sha256") == score.sha256
            and prev.get("extractor") == EXTRACTOR_VERSION
            and prev.get("counts") == score.counts
        ):
            print(f"[{idx}/{len(pdfs)}] SKIP  {score.source} (không đổi)")
            continue

        print(f"[{idx}/{len(pdfs)}] ...   {score.source}", flush=True)
        t0 = time.perf_counter()
        try:
            result = extract_pdf(
                pdf,
                score,
                sources_root=paths.SOURCES,
                extracted_root=paths.EXTRACTED,
                write_images=not args.no_images,
                on_progress=lambda d, t: print(f"        {d}/{t} trang", end="\r", flush=True),
            )
        except Exception as exc:  # noqa: BLE001 — ghi nhận lỗi từng file, chạy tiếp file khác
            print(f"        LỖI: {exc!r}")
            failed.append(score.source)
            continue

        out_md.parent.mkdir(parents=True, exist_ok=True)
        out_md.write_text(result.markdown, encoding="utf-8")
        manifest[score.source] = result.record.model_dump()
        _write_json(paths.EXTRACTED_MANIFEST, [manifest[k] for k in sorted(manifest)])

        r = result.record
        c = r.counts
        print(
            f"        script {c['script']}, hybrid {c['hybrid']}, ocr {c['ocr']}, "
            f"ai {c['ai']}, skip {c['skip']} | {r.images} ảnh — {time.perf_counter() - t0:.1f}s"
        )

    _update_routing_summary(scores)
    print(f"\nXong. Output: {paths.EXTRACTED.relative_to(paths.ROOT)}")
    if failed:
        print("Lỗi:\n" + "\n".join(f"  - {f}" for f in failed))
        return 1
    return 0


# ---------------------------------------------------------------- show


def cmd_show(args: argparse.Namespace) -> int:
    """In đúng các trang cần xem từ content.md — thay cho việc đọc cả file."""
    from jp_pipeline.extract.ai_queue import split_pages
    from jp_pipeline.extract.pdf_score import parse_page_spec

    pdf = _one_pdf(args.book)
    if pdf is None:
        return 1
    content = _out_dir(pdf) / "content.md"
    if not content.exists():
        print(f"Chưa trích: {_rel(pdf)} — chạy extract-pdf trước.")
        return 1
    pages = split_pages(content.read_text(encoding="utf-8"))
    budget = args.max_chars
    for p in parse_page_spec(args.page, max(pages) if pages else 0):
        block = f"<!-- page {p} -->\n{pages.get(p, '')}\n"
        if len(block) > budget:
            print(block[:budget] + "\n…(cắt bớt, tăng --max-chars nếu cần)")
            return 0
        print(block)
        budget -= len(block)
    return 0


# ---------------------------------------------------------------- export-queue


def cmd_export_queue(args: argparse.Namespace) -> int:
    from jp_pipeline.extract.ai_queue import build_queue
    from jp_pipeline.extract.pdf_score import (
        CHARS_PER_TOKEN,
        TOKENS_PER_PAGE_IMAGE,
        TOKENS_PER_PAGE_OUTPUT,
        parse_page_spec,
    )

    pdf = _one_pdf(args.book)
    if pdf is None:
        return 1
    score, _ = _ensure_score(pdf, force=False)
    routes = {r.strip() for r in args.route.split(",")}
    pages = parse_page_spec(args.pages, score.pages) if args.pages else None
    candidates = [
        s for s in score.page_scores if s.route in routes and (pages is None or s.page in pages)
    ]
    if args.limit and len(candidates) > args.limit:
        pages = [s.page for s in candidates[: args.limit]]
        print(f"Giới hạn {args.limit}/{len(candidates)} trang (dùng --limit để đổi).")

    content = _out_dir(pdf) / "content.md"
    avg_chars = sum(s.chars for s in candidates) // max(1, len(candidates))
    per_page = TOKENS_PER_PAGE_IMAGE + TOKENS_PER_PAGE_OUTPUT + avg_chars // CHARS_PER_TOKEN
    queue_dir = _out_dir(pdf) / "ai_queue"
    queue = build_queue(
        pdf,
        score,
        queue_dir=queue_dir,
        routes=routes,  # type: ignore[arg-type]
        pages=pages,
        content_md=content.read_text(encoding="utf-8") if content.exists() else "",
        est_tokens_per_page=per_page,
        max_edge_px=args.max_px,
    )
    _write_json(queue_dir / "queue.json", queue.model_dump())
    print(f"{len(queue.items)} trang → {queue_dir.relative_to(paths.ROOT)}")
    print(f"Ước tính ~{queue.est_tokens:,} token nếu AI xử lý toàn bộ hàng đợi này.")
    return 0


# ---------------------------------------------------------------- enrich-vocab


def cmd_enrich_vocab(_: argparse.Namespace) -> int:
    """sources/vocabulary + JMdict/KANJIDIC2/Unihan → pipeline/enrichment/vocabulary/_auto/."""
    from collections import Counter

    from jp_pipeline.dictionaries import load_jmdict, load_kanjidic, load_unihan_vi
    from jp_pipeline.transform.vocab_auto import SourceVocab, enrich_entry, learn_han_viet

    for p in (paths.DICT_JMDICT, paths.DICT_KANJIDIC, paths.DICT_UNIHAN):
        if not p.exists():
            print(f"Thiếu từ điển: {p.relative_to(paths.ROOT)} — xem docstring dictionaries.py")
            return 1
    print("Đọc từ điển (lần đầu ~15s, sau đó dùng cache)…", flush=True)
    jmdict = load_jmdict(paths.DICT_JMDICT, paths.DICT_INDEX / "jmdict.json")
    kanjidic = load_kanjidic(paths.DICT_KANJIDIC, paths.DICT_INDEX / "kanjidic2.json")
    unihan = load_unihan_vi(paths.DICT_UNIHAN, paths.DICT_INDEX / "unihan_vi.json")

    files = sorted(
        paths.SRC_VOCABULARY.glob("bai_*.json"), key=lambda p: int(p.stem.split("_")[1])
    )
    rows = [SourceVocab.model_validate(r) for f in files for r in _read_json(f)]  # type: ignore[union-attr]
    learned = learn_han_viet(rows)

    auto = [enrich_entry(r, jmdict, kanjidic, learned, unihan) for r in rows]
    ids = [a.id for a in auto]
    if len(set(ids)) != len(ids):
        print("LỖI: trùng ID sau khi chuẩn hóa.")
        return 1

    by_lesson: dict[int, list[dict[str, object]]] = {}
    for a in auto:
        by_lesson.setdefault(a.lesson, []).append(a.model_dump(exclude_defaults=True))
    for lesson, items in by_lesson.items():
        _write_json(paths.ENRICH_VOCAB_AUTO / f"lesson-{lesson:02d}.json", items)

    src_by_id = {r.id: r for r in rows}
    review = [
        {
            "id": a.id,
            "jp": src_by_id[a.legacy_id].jp,
            "vn": src_by_id[a.legacy_id].vn,
            "type_code": src_by_id[a.legacy_id].type_code,
            "kanji": a.kanji,
            **({"kanji_gloss": a.kanji_gloss} if a.kanji_gloss else {}),
            "flags": a.flags,
            **({"kanji_candidates": [c.model_dump() for c in a.kanji_candidates]} if a.kanji_candidates else {}),
            **({"han_viet_candidates": a.han_viet_candidates} if a.han_viet_candidates else {}),
        }
        for a in auto
        if any(
            f in ("kanji_ambiguous", "kanji_verify", "han_viet_ambiguous") or f.startswith("kanji_not")
            for f in a.flags
        )
    ]
    _write_json(paths.ENRICH_VOCAB_AUTO / "review.json", review)

    n = len(auto)
    ksrc = Counter(a.kanji_source for a in auto)
    hsrc = Counter(a.han_viet_source for a in auto)
    flags = Counter(f.split(":")[0] for a in auto for f in a.flags)
    print(f"\n{n} từ → {paths.ENRICH_VOCAB_AUTO.relative_to(paths.ROOT)}/lesson-XX.json")
    print(f"  kanji     : có sẵn {ksrc['source']}, bổ sung từ JMdict {ksrc['jmdict']}, không có {ksrc[None]}")
    print(
        f"  Hán-Việt  : có sẵn {hsrc['source']}, suy ra {hsrc['derived']}, Unihan {hsrc['unihan']}, "
        f"kết hợp {hsrc['mixed']}, chưa có {hsrc[None]}"
    )
    print(f"  cờ        : {dict(flags)}")
    print(f"  cần duyệt : {len(review)} mục → _auto/review.json")
    return 0


def cmd_apply_vocab_review(args: argparse.Namespace) -> int:
    """Gộp file quyết định duyệt vào enrichment/vocabulary/lesson-XX.json (không ghi đè trường khác)."""
    from jp_pipeline.transform.vocab_auto import AutoVocab
    from jp_pipeline.transform.vocab_review import apply_decision, parse_decisions

    decisions = parse_decisions(Path(args.file).read_text(encoding="utf-8"))
    auto: dict[str, AutoVocab] = {}
    for f in paths.ENRICH_VOCAB_AUTO.glob("lesson-*.json"):
        for r in _read_json(f):  # type: ignore[union-attr]
            a = AutoVocab.model_validate(r)
            auto[a.id] = a

    unknown = [d.id for d in decisions if d.id not in auto]
    if unknown:
        print(f"LỖI: ID không tồn tại trong _auto/: {unknown[:10]}")
        return 1

    by_lesson: dict[int, list] = {}
    for d in decisions:
        by_lesson.setdefault(auto[d.id].lesson, []).append(d)

    changed = 0
    for lesson, ds in sorted(by_lesson.items()):
        path = paths.ENRICH_VOCAB / f"lesson-{lesson:02d}.json"
        reviewed: dict[str, dict[str, object]] = _read_json(path) if path.exists() else {}  # type: ignore[assignment]
        for d in ds:
            reviewed[d.id] = apply_decision(reviewed.get(d.id, {}), auto[d.id], d, args.by)
            changed += 1
        _write_json(path, reviewed)
    print(f"Đã áp {changed} quyết định vào {len(by_lesson)} file {paths.ENRICH_VOCAB.relative_to(paths.ROOT)}/lesson-XX.json")
    return 0


def cmd_apply_pos_review(args: argparse.Namespace) -> int:
    """Áp quyết định từ loại (LL-NNN|CODE|ghi chú; '=' nhận đề xuất, '-' giữ gốc)."""
    from jp_pipeline.transform.vocab_auto import AutoVocab, SourceVocab
    from jp_pipeline.transform.vocab_review import apply_pos_decision, parse_pos_decisions

    decisions = parse_pos_decisions(Path(args.file).read_text(encoding="utf-8"))
    auto = {
        a.id: a
        for f in paths.ENRICH_VOCAB_AUTO.glob("lesson-*.json")
        for a in (AutoVocab.model_validate(r) for r in _read_json(f))  # type: ignore[union-attr]
    }
    src = {
        r.id: r
        for f in paths.SRC_VOCABULARY.glob("bai_*.json")
        for r in (SourceVocab.model_validate(x) for x in _read_json(f))  # type: ignore[union-attr]
    }
    unknown = [d.id for d in decisions if d.id not in auto]
    if unknown:
        print(f"LỖI: ID không tồn tại: {unknown[:10]}")
        return 1
    by_lesson: dict[int, list] = {}
    for d in decisions:
        by_lesson.setdefault(auto[d.id].lesson, []).append(d)
    try:
        for lesson, ds in sorted(by_lesson.items()):
            path = paths.ENRICH_VOCAB / f"lesson-{lesson:02d}.json"
            reviewed: dict[str, dict[str, object]] = _read_json(path) if path.exists() else {}  # type: ignore[assignment]
            for d in ds:
                a = auto[d.id]
                reviewed[d.id] = apply_pos_decision(
                    reviewed.get(d.id, {}), a, src[a.legacy_id].type_code, d, args.by
                )
            _write_json(path, reviewed)
    except ValueError as exc:
        print(f"LỖI: {exc}")
        return 1
    print(f"Đã áp {len(decisions)} quyết định từ loại vào {len(by_lesson)} bài.")
    return 0


def cmd_apply_meaning_review(args: argparse.Namespace) -> int:
    """Áp quyết định sửa nghĩa (LL-NNN|nghĩa mới|ghi chú) — file tên chứa '-meaning'."""
    from jp_pipeline.transform.vocab_review import (
        apply_kana_decision,
        apply_meaning_decision,
        parse_meaning_decisions,
    )

    is_kana = "-kana" in Path(args.file).stem
    apply = apply_kana_decision if is_kana else apply_meaning_decision

    decisions = parse_meaning_decisions(Path(args.file).read_text(encoding="utf-8"))
    lessons = {
        str(r["id"]): int(r["lesson"])  # type: ignore[call-overload]
        for f in paths.ENRICH_VOCAB_AUTO.glob("lesson-*.json")
        for r in _read_json(f)  # type: ignore[union-attr]
    }
    unknown = [d.id for d in decisions if d.id not in lessons]
    if unknown:
        print(f"LỖI: ID không tồn tại: {unknown[:10]}")
        return 1
    by_lesson: dict[int, list] = {}
    for d in decisions:
        by_lesson.setdefault(lessons[d.id], []).append(d)
    for lesson, ds in sorted(by_lesson.items()):
        path = paths.ENRICH_VOCAB / f"lesson-{lesson:02d}.json"
        reviewed: dict[str, dict[str, object]] = _read_json(path) if path.exists() else {}  # type: ignore[assignment]
        for d in ds:
            reviewed[d.id] = apply(reviewed.get(d.id, {}), d, args.by)
        _write_json(path, reviewed)
    print(f"Đã áp {len(decisions)} quyết định sửa {'kana' if is_kana else 'nghĩa'} vào {len(by_lesson)} bài.")
    return 0


def cmd_check_meanings(_: argparse.Namespace) -> int:
    """Lọc từ nghi sai nghĩa/kanji (đồng âm, kanji không khớp cách đọc) → _auto/meaning-check.json."""
    from jp_pipeline.dictionaries import load_jmdict
    from jp_pipeline.schemas import VocabLesson
    from jp_pipeline.transform.meaning_check import check_meanings

    entries = [
        e for f in sorted(paths.OUT_VOCABULARY.glob("lesson-*.json"))
        for e in VocabLesson.model_validate(_read_json(f)).entries
    ]
    jm = load_jmdict(paths.DICT_JMDICT, paths.DICT_INDEX / "jmdict.json")
    ok_file = paths.ENRICH_VOCAB / "meaning-check-ok.txt"  # ID đã soát, không lỗi → không hiện lại
    ok = {
        ln.split("|")[0].strip() for ln in ok_file.read_text(encoding="utf-8").splitlines()
        if ln.strip() and not ln.startswith("#")
    } if ok_file.exists() else set()
    all_sus = check_meanings(entries, jm)
    sus = [s for s in all_sus if s.id not in ok]
    print(f"(bỏ qua {len(all_sus) - len(sus)} mục đã soát trong {ok_file.name})")
    out = paths.ENRICH_VOCAB_AUTO / "meaning-check.json"
    _write_json(out, [s.model_dump() for s in sus])
    kinds: dict[str, int] = {}
    for s in sus:
        kinds[s.kind] = kinds.get(s.kind, 0) + 1
    print(f"{len(sus)} mục nghi vấn {kinds} / {len(entries)} từ → {out.relative_to(paths.ROOT)}")
    for s in sus:
        others = " ‖ ".join(f"{'/'.join(o.kanji)}: {'; '.join(o.gloss)}" for o in s.others)
        print(f"{s.id[3:]}|{s.kind[:4]}|{s.kanji}|{s.meaning_vi}|{'; '.join(s.gloss)}|{others}")
    return 0


def _find_zips(query: str | None) -> list[Path]:
    from jp_pipeline.extract.pdf_to_md import nfc

    zips = sorted(p for d in (paths.SRC_VOCABULARY, paths.SRC_KANJI) for p in d.glob("*.zip"))
    return [z for z in zips if not query or query.lower() in nfc(z.name).lower()]


def cmd_inspect_zip(args: argparse.Namespace) -> int:
    """Liệt kê nội dung zip trong sources/vocabulary|kanji (không giải nén) — bảng tóm tắt cho AI."""
    from jp_pipeline.extract.archive import inspect_zip

    zips = _find_zips(args.query)
    if not zips:
        print("Không thấy file zip nào khớp.")
        return 1
    for z in zips:
        s = inspect_zip(z)
        print(f"== {s.archive}: {len(s.members)} file, {s.total_size / 1e6:.1f} MB giải nén | {s.by_ext}")
        dirs: dict[str, list[int]] = {}
        for m in s.members:
            d = m.name.rsplit("/", 1)[0] if "/" in m.name else "."
            dirs.setdefault(d, []).append(m.size)
        for d, sizes in sorted(dirs.items()):
            print(f"  [{len(sizes):>3} file, {sum(sizes) / 1e3:>8.0f} KB] {d}/")
        if args.files:
            for m in s.members[: args.files]:
                print(f"    {m.size / 1e3:>8.1f} KB  {m.name}")
    return 0


def cmd_extract_zip(args: argparse.Namespace) -> int:
    """Giải nén zip an toàn vào sources/books/<level>/ (gitignored, score-pdf tự quét),
    rồi chuyển zip gốc vào sources/_archives/."""
    import shutil

    from jp_pipeline.extract.archive import extract_zip
    from jp_pipeline.extract.pdf_to_md import nfc

    zips = _find_zips(args.query)
    if not zips:
        print("Không thấy file zip nào khớp.")
        return 1
    dest = paths.SRC_BOOKS / args.level
    for z in zips:
        files = extract_zip(z, dest)
        print(f"{nfc(z.name)} → {dest.relative_to(paths.ROOT)}/ ({len(files)} file)")
        if not args.keep:
            paths.SRC_ARCHIVES.mkdir(parents=True, exist_ok=True)
            shutil.move(str(z), str(paths.SRC_ARCHIVES / nfc(z.name)))
            print(f"  zip gốc → {paths.SRC_ARCHIVES.relative_to(paths.ROOT)}/")
    return 0


def cmd_layout_dump(args: argparse.Namespace) -> int:
    """In span (x, y, cỡ chữ, đậm, text) của vài trang PDF — để thiết kế parser theo bố cục."""
    from jp_pipeline.extract.layout import page_spans

    pdfs = [p for p in _discover_pdfs() if args.query.lower() in _rel(p).lower()]
    if len(pdfs) != 1:
        print(f"'{args.query}' khớp {len(pdfs)} file — cần đúng 1:")
        for p in pdfs[:10]:
            print(f"  - {_rel(p)}")
        return 1
    lo, _, hi = args.page.partition("-")
    pages = list(range(int(lo), int(hi or lo) + 1))
    if len(pages) > 3:
        print("Tối đa 3 trang mỗi lần (tiết kiệm token).")
        return 1
    spans = page_spans(pdfs[0], pages, ocr=args.ocr, tessdata=paths.DICT_TESSDATA, tesseract_dir=paths.TESSERACT_DIR)
    for s in spans:
        print(f"p{s.page} x{s.x0:>5.0f}-{s.x1:<5.0f} y{s.y0:>5.0f} {s.size:>4.1f}{'B' if s.bold else ' '} {s.text}")
    return 0


def cmd_parse_n3(args: argparse.Namespace) -> int:
    """Phân tích PDF N3 (từ vựng theo bài) theo bố cục → sources/_extracted/books/N3/_parsed/ (gitignored,
    vì có câu ví dụ nguyên văn từ sách)."""
    import re as _re

    from jp_pipeline.dictionaries import load_jmdict
    from jp_pipeline.extract.layout import page_spans
    from jp_pipeline.transform.n3_vocab import parse_lesson

    out_dir = paths.EXTRACTED / "books" / "N3" / "_parsed"
    jm_index = load_jmdict(paths.DICT_JMDICT, paths.DICT_INDEX / "jmdict.json")
    known = set(jm_index) | {k for items in jm_index.values() for it in items for k in it.kanji}

    def is_word(text: str) -> bool:
        return text in known

    pdfs = [p for p in _discover_pdfs() if _re.search(r"N3/TỪ VỰNG/N3CB mới TV Bài \d+\.pdf$", _rel(p))]
    entries = []
    for pdf in sorted(pdfs, key=lambda p: int(_re.search(r"Bài (\d+)", _rel(p)).group(1))):  # type: ignore[union-attr]
        lesson = int(_re.search(r"Bài (\d+)", _rel(pdf)).group(1))  # type: ignore[union-attr]
        got = parse_lesson(page_spans(pdf), lesson, is_word)
        nos = [e.no for e in got]
        gaps = sorted(set(range(min(nos), max(nos) + 1)) - set(nos)) if nos else []
        flagged = sum(1 for e in got if e.flags)
        print(f"Bài {lesson:>2}: {len(got):>3} từ (số {min(nos) if nos else '-'}–{max(nos) if nos else '-'}) "
              f"| thiếu số: {gaps[:8]} | cờ: {flagged}")
        entries.extend(got)
    from jp_pipeline.transform.n3_vocab import check_with_jmdict

    entries = check_with_jmdict(entries, jm_index)  # type: ignore[arg-type]
    _write_json(out_dir / "vocab.json", [e.model_dump() for e in entries])
    print(f"Tổng {len(entries)} từ → {(out_dir / 'vocab.json').relative_to(paths.ROOT)}")

    from jp_pipeline.transform.n3_kanji import parse_lesson as parse_kanji_lesson

    kpdfs = [p for p in _discover_pdfs() if _re.search(r"N3/KANJI/N3CB mới Kanji Bài \d+\.pdf$", _rel(p))]
    kanji = []
    for pdf in sorted(kpdfs, key=lambda p: int(_re.search(r"Bài (\d+)", _rel(p)).group(1))):  # type: ignore[union-attr]
        lesson = int(_re.search(r"Bài (\d+)", _rel(pdf)).group(1))  # type: ignore[union-attr]
        kanji.extend(parse_kanji_lesson(page_spans(pdf), lesson))
    _write_json(out_dir / "kanji.json", [k.model_dump() for k in kanji])
    by_lesson: dict[int, int] = {}
    for k in kanji:
        by_lesson[k.lesson] = by_lesson.get(k.lesson, 0) + 1
    flagged = [k for k in kanji if k.flags]
    print(f"Kanji: {len(kanji)} chữ / {len(by_lesson)} bài {by_lesson} | cờ: {len(flagged)}")
    return 0


def _load_n3_vocab() -> list[dict[str, object]]:
    out: list[dict[str, object]] = []
    for f in sorted((paths.OUT_VOCABULARY / "n3").glob("lesson-*.json")):
        out.extend(_read_json(f)["entries"])  # type: ignore[index]
    return out


def cmd_n3_examples_pack(args: argparse.Namespace) -> int:
    """Gói gọn để AI viết câu ví dụ cho 1 bài N3 (chỉ từ chưa có câu)."""
    words = [w for w in _load_n3_vocab() if w["lesson"] == args.lesson and not w["examples"]]
    print(f"# N3 bài {args.lesson}: {len(words)} từ cần câu. Trả lời: NNN|<ruby>|<dịch>  (1 câu/từ)")
    print("# Ruby {漢字|かな} cho MỌI chữ Hán; [[…]] bao đúng từ đang học (được chia thể). Dùng từ N5–N4 + N3 bài 1–N.")
    print("# NNN|từ|cách đọc|từ loại|trợ từ|nghĩa")
    for w in words:
        print(f"{str(w['id'])[3:]}|{w['kanji'] or w['kana']}|{w['kana']}|{w['pos']['code']}|{w.get('particle') or ''}|"  # type: ignore[index]
              f"{str(w['meaning_vi'])[:40]}")
    return 0


def cmd_check_n3_examples(args: argparse.Namespace) -> int:
    """Kiểm tra câu ví dụ N3 (đã build vào data/vocabulary/n3/): cú pháp, từ đang học, furigana, phạm vi.
    Từ đã biết = toàn bộ Minna (N5–N4) + N3 bài 1…max_lesson."""
    from jp_pipeline.transform.examples import (
        check_example,
        kana_to_kanji_map,
        vocab_readings,
        word_forms,
    )

    minna, n3 = _load_data_vocab(), _load_n3_vocab()
    every = minna + n3
    forms = {str(w["id"]): word_forms(str(w["kana"]), w["kanji"], str(w["pos"]["code"])) for w in every}  # type: ignore[arg-type,index]
    readings = vocab_readings([(str(w["kana"]), w["kanji"]) for w in every])  # type: ignore[misc]
    k2k = kana_to_kanji_map([(str(w["kana"]), w["kanji"], str(w["pos"]["code"])) for w in every])  # type: ignore[misc,index]
    base: set[str] = set().union(*(forms[str(w["id"])] for w in minna))
    known_upto: dict[int, set[str]] = {}
    acc = set(base)
    for lesson in range(1, 51):
        acc |= set().union(*(forms[str(w["id"])] for w in n3 if w["lesson"] == lesson)) if n3 else set()
        known_upto[lesson] = set(acc)
    n_ex = n_err = n_warn = 0
    for w in n3:
        if args.lesson and w["lesson"] != args.lesson:
            continue
        for ex in w["examples"]:  # type: ignore[union-attr]
            n_ex += 1
            for i in check_example(ex["ruby"], forms[str(w["id"])], known_upto[ex["max_lesson"]], readings,  # type: ignore[index]
                                   w["kanji"], k2k, str(w["kana"])):  # type: ignore[arg-type]
                n_err += i.level == "E"
                n_warn += i.level == "W"
                print(f"{i.level} {ex['id']}: {i.msg}")  # type: ignore[index]
    print(f"\n{n_ex} câu — {n_err} lỗi, {n_warn} cảnh báo")
    return 1 if n_err else 0


def cmd_parse_kanji_ebooks(args: argparse.Namespace) -> int:
    """Danh sách Kanji theo bài từ Ebook Kanji N4 (lớp text) và N5 (ảnh → OCR Tesseract, có cache)
    → sources/_extracted/kanji/_parsed/ebook-kanji.json (gitignored)."""
    from jp_pipeline.dictionaries import load_kanjidic, load_unihan_vi
    from jp_pipeline.extract.layout import Span, page_spans
    from jp_pipeline.transform.kanji_ebook import no_diacritics, parse_ebook

    out_dir = paths.EXTRACTED / "kanji" / "_parsed"
    kd = load_kanjidic(paths.DICT_KANJIDIC, paths.DICT_INDEX / "kanjidic2.json")
    unihan = load_unihan_vi(paths.DICT_UNIHAN, paths.DICT_INDEX / "unihan_vi.json")
    from jp_pipeline.transform.vocab_auto import normalize_han_viet

    raw: dict[str, set[str]] = {}  # âm có dấu (chuẩn hóa) theo chữ
    kj = paths.OUT_KANJI / "kanji.json"
    if kj.exists():
        for k in _read_json(kj)["kanji"]:  # type: ignore[index]
            raw.setdefault(k["char"], set()).update(k["han_viet"])
    for c, vals in unihan.items():
        raw.setdefault(c, set()).update(normalize_han_viet(v.upper()) or "" for v in vals)
    for c, (h, _) in _hanviet_files().items():
        if h:
            raw.setdefault(c, set()).add(h)
    hv = {c: {no_diacritics(x) for x in xs if x} for c, xs in raw.items()}
    candidates = {
        c: (hv.get(c, set()), info.jlpt_old)
        for c, info in kd.items()
        if (info.jlpt_old is not None or (info.grade or 99) <= 6) and hv.get(c)
    }

    results = []
    for level, query, jlpt, ocr in (("N4", "Ebook Kanji N4", 3, False), ("N5", "EBOOK KANJI N5", 4, True)):
        if args.only and args.only.upper() != level:
            continue
        pdf = next((p for p in _discover_pdfs() if query.lower() in _rel(p).lower()), None)
        if pdf is None:
            print(f"{level}: không thấy PDF '{query}'")
            continue
        cache = out_dir / f"{level.lower()}-spans.json"
        if cache.exists() and not args.force:
            spans = [Span.model_validate(x) for x in _read_json(cache)]  # type: ignore[union-attr]
        else:
            print(f"{level}: trích {'OCR' if ocr else 'text'} {_rel(pdf)} …")
            spans = page_spans(pdf, ocr=ocr, tessdata=paths.DICT_TESSDATA, tesseract_dir=paths.TESSERACT_DIR)
            _write_json(cache, [x.model_dump() for x in spans])
        got, warnings = parse_ebook(spans, level, candidates, jlpt, raw)
        lessons: dict[int, list[str]] = {}
        for g in got:
            lessons.setdefault(g.lesson, []).append(g.char)
        print(f"{level}: {len(got)} chữ / {len(lessons)} bài | cờ {sum(1 for g in got if g.flags)} | bỏ {len(warnings)}")
        for les, chars in sorted(lessons.items()):
            print(f"  bài {les:>2}: {''.join(chars)}")
        for w in warnings[:15]:
            print(f"  ! {w}")
        results.extend(got)
    if not args.only:
        _write_json(out_dir / "ebook-kanji.json", [r.model_dump() for r in results])
    return 0


def _header_by(path: Path, default: str = "ai") -> str:
    """Đọc '# by: user|ai' trong 3 dòng đầu file."""
    head = path.read_text(encoding="utf-8").splitlines()[:3]
    return next((ln.split(":", 1)[1].strip() for ln in head if ln.lower().startswith("# by:")), default)


def cmd_apply_all_reviews(_: argparse.Namespace) -> int:
    """Áp TẤT CẢ file trong _decisions/ theo thứ tự tên (01-, 02-…). File tên chứa '-pos' là
    quyết định từ loại; người duyệt đọc từ dòng '# by: user|ai' (mặc định ai)."""
    files = sorted(paths.ENRICH_VOCAB_DECISIONS.glob("*.txt"))
    for f in files:
        by = _header_by(f)
        ns = argparse.Namespace(file=str(f), by=by)
        print(f"→ {f.name} (by {by})")
        if "-pos" in f.stem:
            rc = cmd_apply_pos_review(ns)
        elif "-meaning" in f.stem or "-kana" in f.stem:
            rc = cmd_apply_meaning_review(ns)
        else:
            rc = cmd_apply_vocab_review(ns)
        if rc:
            return rc
    return 0


# ---------------------------------------------------------------- câu ví dụ


def _load_data_vocab() -> list[dict[str, object]]:
    out: list[dict[str, object]] = []
    for f in sorted(paths.OUT_VOCABULARY.glob("lesson-*.json")):
        out.extend(_read_json(f)["entries"])  # type: ignore[index]
    return out


def cmd_examples_pack(args: argparse.Namespace) -> int:
    """In gói đầu vào gọn cho AI viết câu ví dụ của 1 bài (chỉ từ chưa có ví dụ)."""
    from jp_pipeline.transform.examples import needs_example

    words = [w for w in _load_data_vocab() if w["lesson"] == args.lesson]
    if not words:
        print(f"Không có dữ liệu bài {args.lesson} — chạy build trước.")
        return 1
    todo = [
        w for w in words
        if not w["examples"] and needs_example(str(w["pos"]["code"]), str(w["kana"]))  # type: ignore[index]
    ]
    print(f"# Bài {args.lesson}: {len(todo)}/{len(words)} từ cần câu ví dụ (bỏ qua cụm hội thoại trọn câu)")
    print(f"# Trả lời theo dạng: {args.lesson:02d}-NNN|<ruby>|<dịch tiếng Việt>   — 1 dòng / câu")
    print("# Ruby: {漢字|かな} cho MỌI chữ Hán; [[…]] bao đúng từ đang học (được chia thể).")
    print("# MỌI từ có kanji (kể cả từ đang học, kể cả khi giáo trình viết kana) → viết kanji + furigana.")
    print(f"# Chỉ dùng từ vựng của bài 1–{args.lesson} + ngữ pháp tương ứng; câu ngắn, tự nhiên.")
    print("# NNN|kana|kanji|hiển thị|từ loại|nghĩa")
    for w in todo:
        print(f"{str(w['id'])[6:]}|{w['kana']}|{w['kanji'] or ''}|{w['display']}|{w['pos']['code']}|{w['meaning_vi']}")  # type: ignore[index]
    return 0


def cmd_apply_examples(args: argparse.Namespace) -> int:
    """Gộp file câu ví dụ (LL-NNN|ruby|vi) vào enrichment/vocabulary/lesson-XX.json."""
    from jp_pipeline.transform.examples import RubyError, parse_ruby

    by = args.by or _header_by(Path(args.file))  # --by > dòng '# by:' trong file > ai
    known_ids = {str(w["id"]): int(w["lesson"]) for w in _load_data_vocab()}  # type: ignore[call-overload]
    grouped: dict[str, list[tuple[str, str]]] = {}
    errors: list[str] = []
    for n, raw in enumerate(Path(args.file).read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        # ruby cũng chứa "|" ({学生|がくせい}) → id = trước "|" đầu, vi = sau "|" cuối
        if line.count("|") < 2:
            errors.append(f"dòng {n}: cần 'LL-NNN|ruby|vi'")
            continue
        head, vi = line.rsplit("|", 1)
        vid_raw, ruby = head.split("|", 1)
        parts = [vid_raw.strip(), ruby.strip(), vi.strip()]
        vid = parts[0] if parts[0].startswith("mn-") else f"mn-{parts[0]}"
        if vid not in known_ids:
            errors.append(f"dòng {n}: ID không tồn tại {vid}")
            continue
        try:
            parse_ruby(parts[1])
        except RubyError as exc:
            errors.append(f"dòng {n} ({vid}): {exc}")
            continue
        grouped.setdefault(vid, []).append((parts[1], parts[2]))
    if errors:
        print("LỖI — không ghi gì:\n" + "\n".join(f"  - {e}" for e in errors[:30]))
        return 1

    by_lesson: dict[int, dict[str, list[tuple[str, str]]]] = {}
    for vid, exs in grouped.items():
        by_lesson.setdefault(known_ids[vid], {})[vid] = exs
    for lesson, items in sorted(by_lesson.items()):
        path = paths.ENRICH_VOCAB / f"lesson-{lesson:02d}.json"
        reviewed: dict[str, dict[str, object]] = _read_json(path) if path.exists() else {}  # type: ignore[assignment]
        for vid, exs in items.items():
            rec = dict(reviewed.get(vid, {}))
            rec["examples"] = [
                {"id": f"{vid}-e{i}", "ruby": ruby, "vi": vi, "max_lesson": lesson,
                 "source": "ai-draft", "review": "user" if by == "user" else "auto"}
                for i, (ruby, vi) in enumerate(exs, 1)
            ]
            reviewed[vid] = rec
        _write_json(path, reviewed)
    print(f"Đã ghi câu ví dụ cho {len(grouped)} từ ({sum(len(v) for v in grouped.values())} câu, by {by}).")
    return 0


def cmd_apply_all_examples(_: argparse.Namespace) -> int:
    """Áp lại MỌI file _examples/lesson-XX.txt; người duyệt đọc từ dòng '# by:' của từng file."""
    for f in sorted((paths.ENRICH_VOCAB / "_examples").glob("lesson-*.txt")):
        rc = cmd_apply_examples(argparse.Namespace(file=str(f), by=None))
        if rc:
            print(f"  ↑ lỗi ở {f.name}")
            return rc
    return 0


def cmd_check_examples(args: argparse.Namespace) -> int:
    """Kiểm tra câu ví dụ trong enrichment/ (cú pháp, từ đang học, furigana, phạm vi bài)."""
    from jp_pipeline.transform.examples import (
        check_example,
        kana_to_kanji_map,
        vocab_readings,
        word_forms,
    )

    vocab = _load_data_vocab()
    forms_by_id = {
        str(w["id"]): word_forms(str(w["kana"]), w["kanji"], str(w["pos"]["code"]))  # type: ignore[arg-type,index]
        for w in vocab
    }
    lesson_of = {str(w["id"]): int(w["lesson"]) for w in vocab}  # type: ignore[call-overload]
    readings = vocab_readings([(str(w["kana"]), w["kanji"]) for w in vocab])  # type: ignore[misc]
    kanji_by_id: dict[str, str | None] = {str(w["id"]): w["kanji"] for w in vocab}  # type: ignore[misc]
    kana_by_id = {str(w["id"]): str(w["kana"]) for w in vocab}
    k2k = kana_to_kanji_map([(str(w["kana"]), w["kanji"], str(w["pos"]["code"])) for w in vocab])  # type: ignore[misc,index]
    known_upto: dict[int, set[str]] = {}
    acc: set[str] = set()
    for lesson in range(1, 51):
        for vid, forms in forms_by_id.items():
            if lesson_of[vid] == lesson:
                acc |= forms
        known_upto[lesson] = set(acc)

    files = sorted(paths.ENRICH_VOCAB.glob("lesson-*.json"))
    if args.lesson:
        files = [f for f in files if f.stem == f"lesson-{args.lesson:02d}"]
    n_ex = n_err = n_warn = 0
    for f in files:
        for vid, rec in _read_json(f).items():  # type: ignore[union-attr]
            for ex in rec.get("examples", []):
                n_ex += 1
                issues = check_example(
                    ex["ruby"], forms_by_id[vid], known_upto[ex["max_lesson"]], readings, kanji_by_id[vid], k2k, kana_by_id[vid]
                )
                for i in issues:
                    n_err += i.level == "E"
                    n_warn += i.level == "W"
                    print(f"{i.level} {ex['id'][3:]}: {i.msg}")
    print(f"\n{n_ex} câu — {n_err} lỗi, {n_warn} cảnh báo")
    return 1 if n_err else 0


# ---------------------------------------------------------------- main


def main() -> int:
    # Console Windows mặc định cp1252 → in tiếng Việt/Nhật bị lỗi.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(prog="jp_pipeline")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("check", help="Kiểm tra sources/ đã đủ chưa").set_defaults(func=cmd_check)
    sub.add_parser("build", help="sources/ → data/").set_defaults(func=cmd_build)
    sub.add_parser("status", help="Bảng tóm tắt route các PDF").set_defaults(func=cmd_status)

    def pdf_filters(p: argparse.ArgumentParser) -> None:
        p.add_argument("--only", help="Lọc theo tên/đường dẫn, vd: kanji hoặc \"books/N5/*\"")
        p.add_argument("--force", action="store_true", help="Làm lại cả file không đổi")
        p.add_argument("--include-grammar", action="store_true", help="Gồm sources/grammar/pdf")

    p = sub.add_parser("score-pdf", help="Chấm điểm từng trang PDF → route")
    pdf_filters(p)
    p.set_defaults(func=cmd_score_pdf)

    p = sub.add_parser("extract-pdf", help="PDF → Markdown theo route (tự chấm điểm nếu thiếu)")
    pdf_filters(p)
    p.add_argument("--no-images", action="store_true", help="Không tách ảnh")
    p.set_defaults(func=cmd_extract_pdf)

    p = sub.add_parser("show", help="In vài trang từ content.md (tiết kiệm token)")
    p.add_argument("book", help="Một phần tên PDF, vd: \"kanji n4\"")
    p.add_argument("--page", required=True, help="vd: 21 hoặc 20-22,30")
    p.add_argument("--max-chars", type=int, default=6000)
    p.set_defaults(func=cmd_show)

    p = sub.add_parser("export-queue", help="Render trang hybrid/ai thành ảnh cho AI")
    p.add_argument("book", help="Một phần tên PDF")
    p.add_argument("--route", default="hybrid,ai", help="vd: hybrid,ai hoặc ocr")
    p.add_argument("--pages", help="Chỉ các trang này, vd: 20-30")
    p.add_argument("--limit", type=int, default=10, help="Tối đa số trang (mặc định 10)")
    p.add_argument("--max-px", type=int, default=1568, help="Cạnh dài ảnh (px); nhỏ hơn = ít token hơn (chữ lớn: ~1100)")
    p.set_defaults(func=cmd_export_queue)

    p = sub.add_parser("enrich-vocab", help="Bổ sung kanji/Hán-Việt/ID cho từ vựng (0 token)")
    p.set_defaults(func=cmd_enrich_vocab)

    p = sub.add_parser("apply-vocab-review", help="Áp file quyết định duyệt vào enrichment/vocabulary/")
    p.add_argument("file", help="File quyết định: LL-NNN|kanji|han_viet|ghi chú")
    p.add_argument("--by", default="ai", help="Người duyệt: ai | user (mặc định ai)")
    p.set_defaults(func=cmd_apply_vocab_review)

    sub.add_parser(
        "apply-all-reviews", help="Áp mọi file _decisions/ theo thứ tự (đọc '# by:' trong file)"
    ).set_defaults(func=cmd_apply_all_reviews)

    p = sub.add_parser("apply-pos-review", help="Áp quyết định từ loại (LL-NNN|CODE|ghi chú)")
    p.add_argument("file")
    p.add_argument("--by", default="ai", help="ai | user (mặc định ai)")
    p.set_defaults(func=cmd_apply_pos_review)

    p = sub.add_parser("examples-pack", help="Gói đầu vào gọn để AI viết câu ví dụ cho 1 bài")
    p.add_argument("lesson", type=int)
    p.set_defaults(func=cmd_examples_pack)

    p = sub.add_parser("apply-examples", help="Gộp file câu ví dụ (LL-NNN|ruby|vi) vào enrichment/")
    p.add_argument("file")
    p.add_argument("--by", default=None, help="ai | user (mặc định: đọc '# by:' trong file, không có → ai)")
    p.set_defaults(func=cmd_apply_examples)
    sub.add_parser(
        "apply-all-examples", help="Áp lại mọi file _examples/ (đọc '# by:' từng file)"
    ).set_defaults(func=cmd_apply_all_examples)
    p = sub.add_parser("layout-dump", help="In span kèm tọa độ/cỡ chữ của ≤3 trang PDF (thiết kế parser)")
    p.add_argument("query")
    p.add_argument("--page", required=True, help="vd 2 hoặc 2-3")
    p.add_argument("--ocr", action="store_true", help="OCR trang bằng Tesseract (trang scan / ảnh)")
    p.set_defaults(func=cmd_layout_dump)
    sub.add_parser("parse-n3", help="Phân tích PDF từ vựng N3 theo bố cục → _extracted/books/N3/_parsed/").set_defaults(
        func=cmd_parse_n3
    )
    p = sub.add_parser("n3-examples-pack", help="Gói đầu vào để AI viết câu ví dụ cho 1 bài N3")
    p.add_argument("lesson", type=int)
    p.set_defaults(func=cmd_n3_examples_pack)
    p = sub.add_parser("check-n3-examples", help="Kiểm tra câu ví dụ N3 (sau build)")
    p.add_argument("--lesson", type=int)
    p.set_defaults(func=cmd_check_n3_examples)
    p = sub.add_parser("kanji-stories-todo", help="Chữ Kanji chưa có mẹo nhớ (kèm thành phần)")
    p.add_argument("--offset", type=int, default=0)
    p.add_argument("--limit", type=int, default=200)
    p.set_defaults(func=cmd_kanji_stories_todo)
    p = sub.add_parser("kanji-examples-todo", help="Từ ví dụ Kanji (JMdict) chưa có nghĩa tiếng Việt")
    p.add_argument("--offset", type=int, default=0)
    p.add_argument("--limit", type=int, default=300)
    p.set_defaults(func=cmd_kanji_examples_todo)
    p = sub.add_parser("parse-kanji-ebooks", help="Kanji theo bài từ Ebook Kanji N4 (text) / N5 (OCR)")
    p.add_argument("--only", help="N4 hoặc N5")
    p.add_argument("--force", action="store_true", help="trích / OCR lại, bỏ cache")
    p.set_defaults(func=cmd_parse_kanji_ebooks)
    p = sub.add_parser("inspect-zip", help="Liệt kê nội dung zip trong sources/ (không giải nén)")
    p.add_argument("query", nargs="?", help="lọc theo tên file zip")
    p.add_argument("--files", type=int, default=0, help="in tối đa N tên file")
    p.set_defaults(func=cmd_inspect_zip)
    p = sub.add_parser("extract-zip", help="Giải nén zip an toàn → sources/books/<level>/")
    p.add_argument("query", nargs="?", help="lọc theo tên file zip")
    p.add_argument("--level", required=True, help="thư mục cấp độ trong books/, vd N3")
    p.add_argument("--keep", action="store_true", help="giữ zip tại chỗ (mặc định chuyển vào _archives/)")
    p.set_defaults(func=cmd_extract_zip)
    sub.add_parser(
        "check-meanings", help="Lọc từ nghi sai nghĩa/kanji bằng JMdict (đồng âm…)"
    ).set_defaults(func=cmd_check_meanings)
    p = sub.add_parser("apply-meaning-review", help="Áp quyết định sửa nghĩa (LL-NNN|nghĩa|ghi chú)")
    p.add_argument("file")
    p.add_argument("--by", default="ai", help="ai | user")
    p.set_defaults(func=cmd_apply_meaning_review)

    p = sub.add_parser("check-examples", help="Kiểm tra câu ví dụ (cú pháp, furigana, phạm vi bài)")
    p.add_argument("--lesson", type=int)
    p.set_defaults(func=cmd_check_examples)

    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
