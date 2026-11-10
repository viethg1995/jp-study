"""Chia file câu ví dụ bổ sung (LL-NNN|ruby|vi, nhiều bài) và nối vào _examples/lesson-LL.txt.

Dùng: python -I scripts/append_examples.py <file> [--header "ghi chú"]
Bỏ qua ID đã có trong file bài (không ghi trùng).
"""

import argparse
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EX_DIR = ROOT / "enrichment" / "vocabulary" / "_examples"
LINE = re.compile(r"^(\d{2})-\d{3}\|")


def main() -> int:
    import sys

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # console Windows cp1252
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("--header", default="Bổ sung (PN gán nhầm / mẫu có ～)")
    args = ap.parse_args()

    by_lesson: dict[str, list[str]] = {}
    for raw in Path(args.file).read_text(encoding="utf-8").splitlines():
        m = LINE.match(raw.strip())
        if m:
            by_lesson.setdefault(m.group(1), []).append(raw.strip())

    added = 0
    for lesson, lines in sorted(by_lesson.items()):
        path = EX_DIR / f"lesson-{lesson}.txt"
        text = path.read_text(encoding="utf-8") if path.exists() else ""
        existing = {ln.split("|", 1)[0] for ln in text.splitlines() if LINE.match(ln)}
        new = [ln for ln in lines if ln.split("|", 1)[0] not in existing]
        if new:
            block = f"# --- {args.header} ---\n" + "\n".join(new) + "\n"
            path.write_text(text.rstrip("\n") + "\n" + block, encoding="utf-8")
            added += len(new)
            print(f"lesson-{lesson}.txt +{len(new)}")
    print(f"Tổng: +{added} câu")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
