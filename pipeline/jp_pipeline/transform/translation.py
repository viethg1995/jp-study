"""Đề luyện dịch: enrichment/translation/exercises/*.json → TranslationFile (data/translation.json).

Hàm thuần — I/O ở cli.py. Lỗi (sai schema, trùng id, id lệch bài) → ValueError, pipeline dừng.
"""

from __future__ import annotations

from pydantic import ValidationError

from jp_pipeline.schemas import TranslationExercise, TranslationFile


def build_translation(docs: dict[str, object]) -> TranslationFile:
    """docs: {tên file: nội dung JSON (danh sách đề)}. Trả file đã sắp theo id."""
    errors: list[str] = []
    exercises: list[TranslationExercise] = []
    for name, raw in sorted(docs.items()):
        if not isinstance(raw, list):
            errors.append(f"{name}: phải là mảng đề")
            continue
        for i, item in enumerate(raw):
            try:
                ex = TranslationExercise.model_validate(item)
            except ValidationError as e:
                errors.append(f"{name}[{i}]: {e.errors()[0]['loc']} — {e.errors()[0]['msg']}")
                continue
            if ex.id[2:4] != f"{ex.lesson:02d}":
                errors.append(f"{name}: {ex.id} lệch bài (lesson={ex.lesson})")
            exercises.append(ex)

    seen: set[str] = set()
    for ex in exercises:
        if ex.id in seen:
            errors.append(f"trùng id {ex.id}")
        seen.add(ex.id)
    if errors:
        raise ValueError("; ".join(errors[:20]))
    return TranslationFile(exercises=sorted(exercises, key=lambda e: e.id))
