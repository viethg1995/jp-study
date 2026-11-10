"""Đổi từ viết kana → {漢字|かな} trong file câu ví dụ (chỉ phần NGOÀI ruby/[[…]] đã có furigana).

Dùng sau khi `check-n3-examples` / `check-examples` báo lỗi E "viết kanji + furigana" lặp lại.
Bảng KANA_TO_RUBY chỉ gồm từ có kanji trong bộ từ vựng (luật: mọi từ có kanji phải viết kanji + furigana).
Chạy: python -I -X utf8 scripts/kanjify_examples.py <file.txt> [...]
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

KANA_TO_RUBY: dict[str, str] = {
    "きれい": "{綺麗|きれい}",
    "よく": "{良|よ}く",
    "たくさん": "{沢山|たくさん}",
    "すぐ": "{直|す}ぐ",
    "いろいろ": "{色々|いろいろ}",
    "あきらめ": "{諦|あきら}め",
    "あなた": "{貴方|あなた}",
    "おもちゃ": "{玩具|おもちゃ}",
    "みかん": "{蜜柑|みかん}",
    "りんご": "{林檎|りんご}",
    "うれしい": "{嬉|うれ}しい",
    "におい": "{匂|にお}い",
    "たばこ": "{煙草|たばこ}",
    "かばん": "{鞄|かばん}",
    "おいし": "{美味|おい}し",
    "ひも": "{紐|ひも}",
    "はさみ": "{鋏|はさみ}",
}
# Phần đã có ruby {…|…} giữ nguyên; chỉ thay trong đoạn văn bản thường.
TOKEN = re.compile(r"(\{[^{}]*\})")


def kanjify(ruby: str) -> str:
    parts = TOKEN.split(ruby)
    for i, part in enumerate(parts):
        if part.startswith("{"):
            continue
        for kana, rb in KANA_TO_RUBY.items():
            part = part.replace(kana, rb)
        parts[i] = part
    return "".join(parts)


def main(files: list[str]) -> int:
    for name in files:
        p = Path(name)
        out, changed = [], 0
        for line in p.read_text(encoding="utf-8").splitlines():
            if line.startswith("#") or line.count("|") < 2:
                out.append(line)
                continue
            head, vi = line.rsplit("|", 1)
            no, ruby = head.split("|", 1)
            new = kanjify(ruby)
            changed += new != ruby
            out.append(f"{no}|{new}|{vi}")
        p.write_text("\n".join(out) + "\n", encoding="utf-8")
        print(f"{p.name}: đổi {changed} câu")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
