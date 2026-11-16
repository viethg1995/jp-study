"""Luyện dịch: enrichment/translation/{exercises,passages}/*.json → TranslationFile (data/translation.json).

- exercises/lesson-LL.json: câu đơn Việt/Anh → Nhật (id t-LL-NN).
- passages/nX.json: đoạn văn song ngữ theo câu (id p-nX-NNN), dùng cho 2 chiều Nhật ↔ Việt.
  File nguồn không có ja_text — pipeline sinh từ ja (bỏ ruby).

Hàm thuần — I/O ở cli.py. Lỗi (sai schema, ruby sai, trùng id, id lệch bài/cấp) → ValueError, pipeline dừng.
"""

from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from jp_pipeline.schemas import TranslationExercise, TranslationFile, TranslationPassage
from jp_pipeline.transform.examples import RubyError, parse_ruby, surface


def _first_error(e: ValidationError) -> str:
    err = e.errors()[0]
    return f"{err['loc']} — {err['msg']}"


def _build_exercises(docs: dict[str, object], errors: list[str]) -> list[TranslationExercise]:
    out: list[TranslationExercise] = []
    for name, raw in sorted(docs.items()):
        if not isinstance(raw, list):
            errors.append(f"{name}: phải là mảng đề")
            continue
        for i, item in enumerate(raw):
            try:
                ex = TranslationExercise.model_validate(item)
            except ValidationError as e:
                errors.append(f"{name}[{i}]: {_first_error(e)}")
                continue
            if ex.id[2:4] != f"{ex.lesson:02d}":
                errors.append(f"{name}: {ex.id} lệch bài (lesson={ex.lesson})")
            out.append(ex)
    return out


def _ruby_text(ruby: object, where: str) -> str:
    """Kiểm cú pháp ruby (mọi chữ Hán có furigana, không có [[…]]) → chữ thường."""
    if not isinstance(ruby, str):
        raise RubyError(f"{where}: phải là chuỗi")
    try:
        return surface(parse_ruby(ruby, targets=0))
    except RubyError as e:
        raise RubyError(f"{where}: {e}") from e


def _build_passages(docs: dict[str, object], errors: list[str]) -> list[TranslationPassage]:
    out: list[TranslationPassage] = []
    for name, raw in sorted(docs.items()):
        if not isinstance(raw, list):
            errors.append(f"{name}: phải là mảng đoạn văn")
            continue
        for i, item in enumerate(raw):
            where = f"{name}[{i}]"
            if not isinstance(item, dict):
                errors.append(f"{where}: phải là object")
                continue
            data: dict[str, Any] = dict(item)
            try:
                _ruby_text(data.get("title_ja"), f"{where}.title_ja")
                sents = data.get("sentences")
                if isinstance(sents, list):
                    filled: list[object] = []
                    for j, s in enumerate(sents):
                        if isinstance(s, dict):
                            if "ja_text" in s:
                                raise RubyError(f"{where}.sentences[{j}]: không ghi ja_text (pipeline tự sinh)")
                            s = {**s, "ja_text": _ruby_text(s.get("ja"), f"{where}.sentences[{j}].ja")}
                        filled.append(s)
                    data["sentences"] = filled
                p = TranslationPassage.model_validate(data)
            except RubyError as e:
                errors.append(str(e))
                continue
            except ValidationError as e:
                errors.append(f"{where}: {_first_error(e)}")
                continue
            if name != f"{p.level}.json":
                errors.append(f"{name}: {p.id} (level={p.level}) phải nằm trong {p.level}.json")
            out.append(p)
    return out


def build_translation(exercise_docs: dict[str, object], passage_docs: dict[str, object] | None = None) -> TranslationFile:
    """docs: {tên file: nội dung JSON (mảng)}. Trả file đã sắp theo id."""
    errors: list[str] = []
    exercises = _build_exercises(exercise_docs, errors)
    passages = _build_passages(passage_docs or {}, errors)

    seen: set[str] = set()
    for item_id in [e.id for e in exercises] + [p.id for p in passages]:
        if item_id in seen:
            errors.append(f"trùng id {item_id}")
        seen.add(item_id)
    if errors:
        raise ValueError("; ".join(errors[:20]))
    return TranslationFile(
        exercises=sorted(exercises, key=lambda e: e.id),
        passages=sorted(passages, key=lambda p: p.id),
    )
