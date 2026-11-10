"""Áp quyết định duyệt (kanji / Hán-Việt) vào enrichment/vocabulary/lesson-XX.json.

Định dạng file quyết định (mỗi dòng):  LL-NNN | kanji | han_viet | ghi chú
  "-"  → không có (kanji: từ viết kana; han_viet: để trống vì chưa chắc)
  "="  → giữ giá trị trong _auto/
Dòng trống và dòng bắt đầu bằng "#" bị bỏ qua.
"""

from __future__ import annotations

import re

from pydantic import BaseModel

from jp_pipeline.transform.vocab_auto import AutoVocab

KEEP, NONE = "=", "-"


def merge_by(old: object, reviewer: str) -> str:
    """Người duyệt tổng của mục: user ghi đè ai; ai KHÔNG hạ cấp user."""
    return "user" if "user" in (old, reviewer) else reviewer


def _changed_by(reviewer: str) -> str:
    """Nguồn của giá trị KHÁC gốc/đề xuất: người duyệt → 'user', AI → 'ai-draft' (chờ duyệt)."""
    return "user" if reviewer == "user" else "ai-draft"


class MeaningDecision(BaseModel):
    id: str
    meaning: str
    note: str


def parse_meaning_decisions(text: str) -> list[MeaningDecision]:
    """Dòng: LL-NNN | nghĩa mới | ghi chú   (file tên chứa '-meaning')."""
    out: list[MeaningDecision] = []
    for n, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.split("|")]
        if len(parts) < 2 or not parts[1]:
            raise ValueError(f"Dòng {n}: cần 'id|nghĩa': {raw!r}")
        vid = parts[0] if parts[0].startswith("mn-") else f"mn-{parts[0]}"
        out.append(MeaningDecision(id=vid, meaning=parts[1], note=parts[2] if len(parts) > 2 else ""))
    return out


def apply_meaning_decision(current: dict[str, object], d: MeaningDecision, reviewer: str) -> dict[str, object]:
    rec = dict(current)
    rec["meaning_vi"], rec["meaning_source"] = d.meaning, _changed_by(reviewer)
    rev = dict(rec.get("review") or {})  # type: ignore[call-overload]
    rev.setdefault("status", "reviewed")
    rev["by"] = merge_by(rev.get("by"), reviewer)
    rec["review"] = {**rev, "meaning_by": reviewer, **({"meaning_note": d.note} if d.note else {})}
    return rec


def apply_kana_decision(current: dict[str, object], d: MeaningDecision, reviewer: str) -> dict[str, object]:
    """Sửa kana gõ sai trong nguồn (ヨロッパ → ヨーロッパ). Cùng cú pháp file với quyết định nghĩa."""
    if re.search(r"[㐀-鿿]", d.meaning):
        # chặn nhầm file: giá trị cột 2 của file kanji/Hán-Việt bị hiểu là kana (tên file lỡ chứa "-kana")
        raise ValueError(f"{d.id}: kana mới chứa chữ Hán ({d.meaning!r}) — file này có đúng là file sửa kana?")
    rec = dict(current)
    rec["kana"] = d.meaning
    rev = dict(rec.get("review") or {})  # type: ignore[call-overload]
    rev.setdefault("status", "reviewed")
    rev["by"] = merge_by(rev.get("by"), reviewer)
    rec["review"] = {**rev, "kana_by": reviewer, **({"kana_note": d.note} if d.note else {})}
    return rec


class Decision(BaseModel):
    id: str  # mn-LL-NNN
    kanji: str  # giá trị thô: "=", "-" hoặc chữ
    han_viet: str
    note: str


def parse_decisions(text: str) -> list[Decision]:
    out: list[Decision] = []
    for n, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.split("|")]
        if len(parts) < 3:
            raise ValueError(f"Dòng {n}: cần ít nhất 3 cột 'id|kanji|han_viet': {raw!r}")
        vid = parts[0] if parts[0].startswith("mn-") else f"mn-{parts[0]}"
        out.append(Decision(id=vid, kanji=parts[1], han_viet=parts[2], note=parts[3] if len(parts) > 3 else ""))
    return out


class PosDecision(BaseModel):
    id: str
    code: str  # "=" nhận đề xuất _auto | "-" giữ mã gốc | mã mới
    note: str


def parse_pos_decisions(text: str) -> list[PosDecision]:
    """Dòng: LL-NNN | CODE | ghi chú."""
    out: list[PosDecision] = []
    for n, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.split("|")]
        if len(parts) < 2:
            raise ValueError(f"Dòng {n}: cần 'id|code': {raw!r}")
        vid = parts[0] if parts[0].startswith("mn-") else f"mn-{parts[0]}"
        out.append(PosDecision(id=vid, code=parts[1], note=parts[2] if len(parts) > 2 else ""))
    return out


def apply_pos_decision(
    current: dict[str, object], auto: AutoVocab, source_code: str, d: PosDecision, reviewer: str
) -> dict[str, object]:
    from jp_pipeline.schemas import pos_label

    rec = dict(current)
    if d.code == KEEP:
        if not auto.pos_suggested:
            raise ValueError(f"{d.id}: '=' nhưng _auto không có đề xuất từ loại")
        rec["pos_code"], rec["pos_source"] = auto.pos_suggested, "jmdict"
    elif d.code == NONE:
        rec["pos_code"], rec["pos_source"] = source_code, "source"
    else:
        pos_label(d.code)  # kiểm tra mã hợp lệ
        same = d.code == auto.pos_suggested
        rec["pos_code"], rec["pos_source"] = d.code, ("jmdict" if same else _changed_by(reviewer))
    # Ghi người duyệt từ loại riêng (pos_by) — KHÔNG ghi đè "by" của lần duyệt kanji/Hán-Việt
    rev = dict(rec.get("review") or {})  # type: ignore[call-overload]
    rev.setdefault("status", "reviewed")
    rev["by"] = merge_by(rev.get("by"), reviewer)
    rec["review"] = {**rev, "pos_by": reviewer, **({"pos_note": d.note} if d.note else {})}
    return rec


def apply_decision(current: dict[str, object], auto: AutoVocab, d: Decision, reviewer: str) -> dict[str, object]:
    """Trả về bản ghi đã duyệt mới (không đụng tới các trường khác như examples)."""
    rec = dict(current)

    # "=" → KHÔNG đụng tới trường: không ghi, cũng không xóa. Chưa ai quyết → _auto chảy qua;
    # đã có quyết định ở file trước (apply-all-reviews áp chồng theo thứ tự) → giữ nguyên.
    if d.kanji == KEEP:
        pass
    elif d.kanji == NONE:
        rec["kanji"], rec["kanji_source"] = None, "none"
    else:
        rec["kanji"] = d.kanji
        rec["kanji_source"] = auto.kanji_source if d.kanji == auto.kanji else _changed_by(reviewer)

    final_kanji = rec.get("kanji", auto.kanji)
    if final_kanji is None:
        rec["han_viet"], rec["han_viet_source"] = None, None
    elif d.han_viet == KEEP:
        pass
    elif d.han_viet == NONE:
        rec["han_viet"], rec["han_viet_source"] = None, None
    else:
        rec["han_viet"] = d.han_viet.upper()
        same = d.han_viet.upper() == (auto.han_viet or "")
        rec["han_viet_source"] = auto.han_viet_source if same else _changed_by(reviewer)

    # Gộp (không thay) để giữ pos_by/pos_note của lần duyệt từ loại
    old = {k: v for k, v in dict(rec.get("review") or {}).items() if k not in ("note",)}  # type: ignore[call-overload]
    # AI duyệt sau KHÔNG hạ cấp mục user đã duyệt (giá trị AI vừa đổi vẫn mang nguồn "ai-draft")
    by = merge_by(old.get("by"), reviewer)
    rec["review"] = {**old, "status": "reviewed", "by": by, **({"note": d.note} if d.note else {})}
    return rec
