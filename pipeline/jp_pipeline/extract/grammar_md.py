"""Mục ngữ pháp từ sources/grammar/md/{N5,N4}/baiLL.md → {g-LL-N: GrammarSection}.

Dùng để kiểm câu ví dụ trích từ bài ngữ pháp (từ nối: source "grammar") có thật trong nguồn — không dựng
lại ruby (furigana trong md nằm ở dòng riêng, cách quãng, không ghép tự động được).

Hàm thuần — I/O ở cli.py.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

_HEADING = re.compile(r"^##\s+(\d+)\.\s*(.+?)\s*$")
_FILE = re.compile(r"^bai(\d+)\.md$")
_CJK = re.compile(r"[㐀-䶿一-鿿々]")
_KANA = re.compile(r"[ぁ-ゖァ-ヺー]")
_LATIN = re.compile(r"[A-Za-zÀ-ỹ]")
# dòng furigana: chỉ kana / số / dấu cách, có ít nhất 1 dấu cách (các cụm cách quãng)
_FURI = re.compile(r"^[ぁ-ゖァ-ヺー0-9０-９\s]+$")


@dataclass(frozen=True)
class GrammarSection:
    id: str  # g-LL-N
    lesson: int
    title: str
    ja_text: str  # nối mọi dòng tiếng Nhật của mục (bỏ dòng furigana, dòng tiếng Việt), đã chuẩn hóa


def norm_ja(s: str) -> str:
    """NFKC, bỏ mọi khoảng trắng — so khớp câu với nguồn (md có dấu cách giữa các cụm)."""
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", s))


def _is_ja_line(line: str) -> bool:
    s = line.strip()
    if not s or _LATIN.search(s):
        return False
    if _FURI.match(s) and " " in s:
        return False
    return bool(_CJK.search(s) or _KANA.search(s))


def parse_grammar_md(file_name: str, text: str) -> list[GrammarSection]:
    """Một file baiLL.md → các mục `## N. tiêu đề` (bỏ mục 'Nội dung')."""
    m = _FILE.match(file_name)
    if not m:
        raise ValueError(f"tên file ngữ pháp không đúng dạng baiLL.md: {file_name}")
    lesson = int(m.group(1))
    out: list[GrammarSection] = []
    cur: tuple[int, str] | None = None
    lines: list[str] = []

    def flush() -> None:
        if cur is not None:
            ja = norm_ja("".join(x for x in lines if _is_ja_line(x)))
            out.append(GrammarSection(id=f"g-{lesson:02d}-{cur[0]}", lesson=lesson, title=cur[1], ja_text=ja))

    for line in text.splitlines():
        h = _HEADING.match(line)
        if h:
            flush()
            cur, lines = (int(h.group(1)), h.group(2)), []
        elif line.startswith("## "):
            flush()
            cur, lines = None, []
        elif cur is not None:
            lines.append(line)
    flush()
    return out


def grammar_sections(files: list[tuple[str, str]]) -> dict[str, GrammarSection]:
    """[(tên file, nội dung)] → {g-LL-N: mục}. Mục trùng id (md đánh số lặp) → giữ mục đầu, nối thêm chữ của mục sau."""
    out: dict[str, GrammarSection] = {}
    for name, text in files:
        for s in parse_grammar_md(name, text):
            if s.id in out:
                old = out[s.id]
                out[s.id] = GrammarSection(id=old.id, lesson=old.lesson, title=old.title, ja_text=old.ja_text + s.ja_text)
            else:
                out[s.id] = s
    return out
