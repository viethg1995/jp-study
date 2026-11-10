"""Xử lý file zip trong sources/ (tải từ Google Drive…) — dữ liệu KHÔNG tin cậy.

- inspect: liệt kê nội dung (không giải nén) → AI đọc bảng tóm tắt thay vì mở file.
- extract: giải nén vào sources/_extracted/_zip/<tên>/ (gitignored), chặn zip-slip, chuẩn hóa NFC.
Chạy CLI bằng `python -I -X utf8 -m jp_pipeline …` (CLAUDE.md: file không tin cậy).
"""

from __future__ import annotations

import unicodedata
import zipfile
from collections import Counter
from pathlib import Path, PurePosixPath

from pydantic import BaseModel

MAX_TOTAL_BYTES = 2_000_000_000  # chặn zip bomb: tổng dung lượng giải nén tối đa 2GB


class ZipMember(BaseModel):
    name: str  # đường dẫn trong zip (NFC, '/')
    size: int
    ext: str


class ZipSummary(BaseModel):
    archive: str
    members: list[ZipMember]
    total_size: int
    by_ext: dict[str, int]


def _decode_name(info: zipfile.ZipInfo) -> str:
    """Tên file trong zip: cờ UTF-8 → giữ; không có cờ → zipfile đã decode cp437, thử đổi sang utf-8."""
    name = info.filename
    if not info.flag_bits & 0x800:
        try:
            name = name.encode("cp437").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
    return unicodedata.normalize("NFC", name)


def _safe_rel(name: str) -> PurePosixPath | None:
    """Đường dẫn tương đối an toàn (không tuyệt đối, không '..'); None nếu nguy hiểm."""
    p = PurePosixPath(name.replace("\\", "/"))
    if p.is_absolute() or any(part in ("..", "") for part in p.parts) or ":" in p.parts[0]:
        return None
    return p


def inspect_zip(path: Path) -> ZipSummary:
    members: list[ZipMember] = []
    with zipfile.ZipFile(path) as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            name = _decode_name(info)
            ext = PurePosixPath(name).suffix.lower() or "(none)"
            members.append(ZipMember(name=name, size=info.file_size, ext=ext))
    by_ext = Counter(m.ext for m in members)
    return ZipSummary(
        archive=unicodedata.normalize("NFC", path.name),
        members=sorted(members, key=lambda m: m.name),
        total_size=sum(m.size for m in members),
        by_ext=dict(by_ext.most_common()),
    )


def extract_zip(path: Path, dest: Path) -> list[Path]:
    """Giải nén an toàn → danh sách file đã ghi. Lỗi nếu có tên nguy hiểm hoặc vượt MAX_TOTAL_BYTES."""
    written: list[Path] = []
    with zipfile.ZipFile(path) as zf:
        infos = [i for i in zf.infolist() if not i.is_dir()]
        total = sum(i.file_size for i in infos)
        if total > MAX_TOTAL_BYTES:
            raise ValueError(f"zip quá lớn khi giải nén: {total} bytes")
        for info in infos:
            rel = _safe_rel(_decode_name(info))
            if rel is None:
                raise ValueError(f"tên file nguy hiểm trong zip: {info.filename!r}")
            target = dest.joinpath(*rel.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(info) as src, target.open("wb") as out:
                out.write(src.read())
            written.append(target)
    return written
