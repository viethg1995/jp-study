"""Hợp đồng dữ liệu cho data/ — nguồn chuẩn duy nhất (CLAUDE.md rule 3).

Web phải có type/zod tương ứng. JSON Schema được xuất ra data/_schema/ mỗi lần build
để web kiểm tra đồng bộ. Đổi schema → tăng SCHEMA_VERSION.
"""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

SCHEMA_VERSION = 4  # v4: thêm sách N3 (book, id n3-NNN, particle/transitivity/variants/antonyms/related)
# v3: provenance "user" + provenance.meaning, senses[], kanji phải chứa chữ Hán
# v2: pos.code theo bộ mã chuẩn + nhãn chuẩn, provenance.pos

# user = người nhập/duyệt giá trị khác gốc; ai-draft = AI tự quyết, chờ duyệt
Provenance = Literal["source", "jmdict", "derived", "unihan", "mixed", "ai-draft", "user", "none"]

# Bộ mã từ loại chuẩn → nhãn tiếng Việt chuẩn. Nhãn LUÔN sinh từ mã (không lấy từ dữ liệu gốc).
# Thêm mã mới: thêm ở đây + web/src/content.config.ts + màu ở web/src/components/WordCard.astro.
POS_LABELS: dict[str, str] = {
    "N": "Danh từ",
    "PN": "Danh từ riêng",
    "Pro": "Đại từ",
    "V1": "Động từ nhóm 1",
    "V2": "Động từ nhóm 2",
    "V3": "Động từ nhóm 3",
    "Ai": "Tính từ い",
    "An": "Tính từ な",
    "Adv": "Trạng từ",
    "Det": "Từ chỉ định (連体詞)",
    "Conj": "Từ nối",
    "Int": "Thán từ",
    "QW": "Nghi vấn từ",
    "QP": "Đại từ nghi vấn",
    "Pre": "Tiền tố",
    "Suf": "Hậu tố",
    "Cnt": "Lượng từ",
    "Phr": "Cụm từ",
    "Conv": "Cụm từ hội thoại",
    "Greet": "Cụm từ chào hỏi",
}


def pos_label(code: str) -> str:
    """'Pro/Phr' → 'Đại từ / Cụm từ'. Mã lạ → ValueError."""
    parts = code.split("/")
    bad = [p for p in parts if p not in POS_LABELS]
    if bad:
        raise ValueError(f"mã từ loại không hợp lệ: {bad} (hợp lệ: {sorted(POS_LABELS)})")
    return " / ".join(POS_LABELS[p] for p in parts)
ReviewStatus = Literal["auto", "ai", "user"]  # chưa ai duyệt | AI đã duyệt | người đã duyệt

VOCAB_ID = re.compile(r"^(mn-\d{2}-\d{3}|n3-\d{3})$")  # Minna mn-LL-NNN · N3 n3-NNN (số thứ tự sách)
Book = Literal["minna", "n3"]
KANJI_ID = re.compile(r"^k-.$")
CJK = re.compile(r"[㐀-䶿一-鿿豈-﫿々]")
# Cú pháp ruby: {漢字|かな} có furigana; [[...]] bao quanh từ đang học
RUBY_SEGMENT = re.compile(r"\{[^{}|]+\|[^{}|]+\}")


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class PartOfSpeech(_Strict):
    code: str = Field(description="Mã chuẩn trong POS_LABELS (có thể ghép bằng '/', vd 'Pro/Phr')")
    label: str = Field(description="Nhãn tiếng Việt chuẩn, sinh từ code bằng pos_label()")

    @field_validator("code")
    @classmethod
    def _code(cls, v: str) -> str:
        pos_label(v)
        return v

    @classmethod
    def of(cls, code: str) -> PartOfSpeech:
        return cls(code=code, label=pos_label(code))


class VocabExample(_Strict):
    id: str = Field(description="mn-LL-NNN-eK")
    ruby: str = Field(description="Câu tiếng Nhật, cú pháp {漢字|かな} và [[từ đang học]]")
    vi: str = Field(description="Bản dịch tiếng Việt")
    max_lesson: int = Field(ge=1, le=50, description="Câu chỉ dùng từ vựng từ bài 1 đến bài này")
    source: Literal["ai-draft", "tatoeba", "user"]
    review: ReviewStatus

    @field_validator("ruby")
    @classmethod
    def _has_target(cls, v: str) -> str:
        if v.count("[[") != 1 or v.count("]]") != 1:
            raise ValueError("ruby phải chứa đúng một cặp [[…]] đánh dấu từ đang học")
        return v


class VocabProvenance(_Strict):
    kanji: Provenance | None
    han_viet: Provenance | None
    pos: Literal["source", "jmdict", "ai-draft", "user"] = Field(
        description="source = như dữ liệu gốc; jmdict = sửa theo JMdict; ai-draft = AI quyết định; user = người duyệt"
    )
    meaning: Literal["source", "ai-draft", "user"] = Field(
        description="Nguồn của meaning_vi: source = như dữ liệu gốc; ai-draft / user = đã sửa"
    )


class Sense(_Strict):
    text: str = Field(description="Nghĩa (không kèm ngữ cảnh) — dùng cho quiz, tìm kiếm")
    context: str | None = Field(description="Ngữ cảnh dùng, từ [ … ] cuối nghĩa gốc, vd 'điện thoại' trong 'gọi [điện thoại]'")


class VocabEntry(_Strict):
    id: str = Field(description="mn-LL-NNN (Minna) | n3-NNN (N3) — khóa localStorage, KHÔNG được đổi")
    legacy_id: str = Field(description="ID gốc trong nguồn (Minna: lessonL_N · N3: n3cb-NNN)")
    book: Book = "minna"
    lesson: int = Field(ge=1, le=50)
    kana: str = Field(description="Cách viết kana như giáo trình (có thể kèm ～)")
    kanji: str | None = Field(description="Dạng kanji; null nếu từ viết bằng kana")
    display: Literal["kanji", "kana"] = Field(description="Giáo trình viết dạng nào → mặc định hiển thị")
    han_viet: str | None = Field(description="Âm Hán-Việt viết hoa, vd 'HỘI XÃ VIÊN'")
    meaning_vi: str = Field(description="Nghĩa hiển thị đầy đủ (giữ [ngữ cảnh]); chỗ trống viết '～'")
    senses: list[Sense] = Field(description="meaning_vi tách theo ';' — mỗi nghĩa tách phần ngữ cảnh cuối")
    pos: PartOfSpeech
    kanji_refs: list[str] = Field(description="ID kanji (k-字) theo thứ tự xuất hiện, không trùng")
    same_word: list[str] = Field(
        description="ID các mục cùng kana + kanji ở bài khác (thường là nghĩa/cách dùng mới) — liên kết 2 chiều"
    )
    examples: list[VocabExample] = []
    particle: str | None = Field(default=None, description="Trợ từ đi kèm (が, を, が/を…) — N3")
    transitivity: str | None = Field(default=None, description="(自) tự động từ / (他) tha động từ — N3")
    variants: list[str] = Field(default=[], description="Cách viết khác: 降りる/下りる — N3")
    antonyms: list[str] = Field(default=[], description="Từ trái nghĩa (対) — N3")
    related: list[str] = Field(default=[], description="Từ/cụm liên quan (高齢化社会…) — N3")
    provenance: VocabProvenance
    review: ReviewStatus

    @field_validator("id")
    @classmethod
    def _vid(cls, v: str) -> str:
        if not VOCAB_ID.match(v):
            raise ValueError(f"id không đúng dạng mn-LL-NNN / n3-NNN: {v!r}")
        return v

    @field_validator("kanji")
    @classmethod
    def _kanji_has_cjk(cls, v: str | None) -> str | None:
        if v is not None and not CJK.search(v):
            raise ValueError(f"kanji phải chứa ít nhất một chữ Hán (không có thì để null): {v!r}")
        return v

    @field_validator("kanji_refs")
    @classmethod
    def _krefs(cls, v: list[str]) -> list[str]:
        bad = [k for k in v if not KANJI_ID.match(k)]
        if bad or len(set(v)) != len(v):
            raise ValueError(f"kanji_refs không hợp lệ hoặc trùng: {v}")
        return v

    @field_validator("meaning_vi", "kana")
    @classmethod
    def _non_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("không được rỗng")
        return v


class VocabLesson(_Strict):
    schema_version: int = SCHEMA_VERSION
    book: Book = "minna"
    lesson: int = Field(ge=1, le=50)
    entries: list[VocabEntry]


# ---------------------------------------------------------------- Kanji & bộ thủ

KANJI_SCHEMA_VERSION = 8  # v8: n3_lessons (mọi bài Kanji N3 có chữ + thứ tự trong bài, theo bảng tổng hợp đầu bài)
# v7: story (mẹo nhớ), components (thành phần KanjiVG trong strokes.json)
# v6: examples (từ ví dụ chia Âm On / Âm Kun, ≥5/chữ)
# v5: n4_order, n5_order (thứ tự chữ trong bài như sách)
# v4: n4_lesson, n5_lesson (ebook Kanji theo cấp)
# v3: n3_lesson, first_lesson tùy chọn, Hán-Việt từ sách N3
# v2: meaning_vi_source
HanVietSource = Literal["vocab", "n3book", "ai-draft", "user", "unihan"]  # ai-draft/user: enrichment/kanji/hanviet/
MeaningSource = Literal["ai-draft", "user"]


class Radical(_Strict):
    number: int = Field(ge=1, le=214, description="Số thứ tự bộ thủ Khang Hy")
    char: str = Field(description="Chữ bộ thủ (dạng chính)")
    variants: list[str] = Field(description="Dạng biến thể, vd 龍 → ['龙']")
    strokes: int = Field(ge=1, le=17)
    name_vi: str = Field(description="Tên Hán-Việt, vd 'Nhân'")
    meaning_vi: str | None = Field(description="Nghĩa tiếng Việt (null nếu nguồn bỏ trống)")


class RadicalFile(_Strict):
    schema_version: int = KANJI_SCHEMA_VERSION
    source: str
    radicals: list[Radical]


ReadingType = Literal["on", "kun"]


class KanjiExample(_Strict):
    word: str = Field(min_length=1, description="Từ (dạng chữ Hán), vd 学生")
    kana: str = Field(min_length=1, description="Cách đọc cả từ, hiragana/katakana")
    reading_type: ReadingType | None = Field(description="Chữ đang xét đọc theo âm On hay Kun (null: âm đặc biệt/không xác định)")
    reading: str | None = Field(description="Cách đọc của riêng chữ đang xét trong từ (hiragana), vd がく")
    meaning_vi: str | None = Field(description="Nghĩa tiếng Việt (null: chưa dịch — web hiện meaning_en)")
    meaning_vi_source: Literal["vocab", "ai-draft", "user"] | None
    meaning_en: str | None = Field(description="Nghĩa tiếng Anh JMdict (null với từ giáo trình)")
    vocab_id: str | None = Field(pattern=r"^(mn-\d{2}-\d{3}|n3-\d{3})$", description="Từ trong giáo trình → link thẻ")
    source: Literal["vocab", "jmdict"]


class KanjiLessonRef(_Strict):
    lesson: int = Field(ge=1, le=50, description="Số bài")
    order: int = Field(ge=1, le=20, description="Thứ tự chữ trong bài (như sách)")


class KanjiEntry(_Strict):
    id: str = Field(description="k-字 — khóa localStorage, KHÔNG được đổi")
    char: str
    han_viet: list[str] = Field(description="Âm Hán-Việt viết hoa, âm dùng nhiều nhất trước")
    han_viet_source: HanVietSource | None
    meaning_vi: str | None = Field(description="Nghĩa tiếng Việt — null khi chưa có nguồn (rule 5)")
    meaning_vi_source: MeaningSource | None = Field(
        description="ai-draft = AI viết nháp, chờ duyệt; user = người đã duyệt; null khi meaning_vi null"
    )
    meanings_en: list[str] = Field(description="Nghĩa tiếng Anh (KANJIDIC2)")
    on: list[str] = Field(description="Âm On (katakana)")
    kun: list[str] = Field(description="Âm Kun (hiragana, '.' tách okurigana)")
    strokes: int | None
    grade: int | None = Field(description="Cấp lớp giáo dục Nhật (KANJIDIC2)")
    jlpt_old: int | None = Field(description="JLPT thang cũ 1–4 của KANJIDIC2 (4 ≈ N5, 3 ≈ N4)")
    radical: int | None = Field(description="Số bộ thủ → radicals.json")
    first_lesson: int | None = Field(ge=1, le=50, description="Bài Minna đầu tiên có chữ này (null: chỉ có ở N3)")
    n3_lesson: int | None = Field(default=None, ge=1, le=50, description="Bài Kanji N3 dạy chữ này (null: không có trong N3)")
    n4_lesson: int | None = Field(default=None, ge=1, le=50, description="Bài Ebook Kanji N4 dạy chữ này")
    n5_lesson: int | None = Field(default=None, ge=1, le=50, description="Bài Ebook Kanji N5 dạy chữ này")
    n4_order: int | None = Field(default=None, ge=1, le=20, description="Thứ tự chữ trong bài Ebook Kanji N4")
    n5_order: int | None = Field(default=None, ge=1, le=20, description="Thứ tự chữ trong bài Ebook Kanji N5")
    n3_lessons: list[KanjiLessonRef] = Field(default_factory=list, description="Mọi bài Kanji N3 có chữ này (1 chữ có thể dạy ở 2 bài, vd 個: 1 và 21), tăng dần; n3_lesson = bài đầu")
    vocab_refs: list[str] = Field(description="ID từ vựng chứa chữ này (mn-LL-NNN, n3-NNN), Minna trước")
    examples: list[KanjiExample] = Field(default_factory=list, description="Từ ví dụ: từ giáo trình trước, bổ sung JMdict cho đủ ≥5")
    story: str | None = Field(default=None, description="Mẹo nhớ (câu chuyện gợi hình từ thành phần) — không phải từ nguyên")
    story_source: Literal["ai-draft", "user"] | None = None

    @field_validator("id")
    @classmethod
    def _kid(cls, v: str) -> str:
        if not KANJI_ID.match(v):
            raise ValueError(f"id không đúng dạng k-字: {v!r}")
        return v


class KanjiFile(_Strict):
    schema_version: int = KANJI_SCHEMA_VERSION
    kanji: list[KanjiEntry]


class KanjiStroke(_Strict):
    d: str = Field(min_length=1, description="SVG path (viewBox 0 0 109 109), theo thứ tự viết")
    type: str | None = Field(description="Kiểu nét KanjiVG, vd '㇐' (null nếu nguồn bỏ trống)")
    num: list[float] = Field(min_length=2, max_length=2, description="Vị trí đặt số thứ tự nét (x, y)")


class KanjiComponent(_Strict):
    char: str = Field(min_length=1, description="Thành phần như viết trong chữ, vd 亻")
    original: str | None = Field(description="Dạng gốc nếu là biến thể, vd 亻 → 人")
    strokes: list[int] = Field(min_length=1, description="Số thứ tự nét (từ 1) thuộc thành phần")
    name_vi: str | None = Field(description="Tên Hán-Việt (bộ thủ hoặc âm Hán-Việt), vd 'Nhân'")
    meaning_vi: str | None = Field(description="Nghĩa ngắn, vd 'người'")


class KanjiStrokes(_Strict):
    id: str = Field(pattern=r"^k-.$", description="Trùng id trong kanji.json")
    char: str = Field(min_length=1, max_length=1)
    strokes: list[KanjiStroke] = Field(min_length=1)
    components: list[KanjiComponent] = Field(default_factory=list, description="Thành phần cấp 1 (KanjiVG); chữ đơn → []")


class StrokeFile(_Strict):
    schema_version: int = KANJI_SCHEMA_VERSION
    source: str
    license: str
    kanji: list[KanjiStrokes]


# ── Chia thể ──────────────────────────────────────────────────────────────────────────────────────
CONJ_SCHEMA_VERSION = 2  # v2: aliases (từ trùng ở bài khác → cùng trang chia thể)

ConjKind = Literal["V1", "V2", "V3", "Ai", "An", "N"]
ConjGroup = Literal["verb", "adj-i", "adj-na", "noun"]


class ConjRule(_Strict):
    kind: Literal["V", "V1", "V2", "V3", "Ai", "An", "N"] = Field(description="V = chung cho cả 3 nhóm động từ")
    text: str = Field(description="Quy tắc (tiếng Việt), tính từ thể ます / dạng gốc")
    examples: list[str] = Field(description="vocab_id của từ minh họa (có trong entries)")


class ConjFormDef(_Strict):
    id: str = Field(description="Mã thể, duy nhất trong nhóm (nai, te, past…)")
    group: ConjGroup
    name_vi: str
    name_ja: str
    lesson: int | None = Field(ge=1, le=50, description="Bài みんなの日本語 học thể này; null = ngoài giáo trình")
    use_vi: str = Field(description="Dùng để làm gì")
    rules: list[ConjRule]


class ConjGroupDef(_Strict):
    id: ConjGroup
    name_vi: str
    intro_vi: list[str] = Field(description="Đoạn giới thiệu: cách nhận biết nhóm, gốc để chia")


class ConjValue(_Strict):
    form: str = Field(description="ConjFormDef.id")
    kana: str
    ruby: str = Field(description="Cú pháp {漢字|かな}; từ viết kana thì giống kana")
    rule: str = Field(description="Quy tắc đã áp dụng cho từ này, vd 'き → か + ない'")
    irregular: bool


class ConjEntry(_Strict):
    vocab_id: str = Field(description="ID từ vựng (mn-LL-NNN | n3-NNN)")
    book: Book
    lesson: int = Field(ge=1, le=50)
    kind: ConjKind
    kana: str = Field(description="Dạng gốc: thể ます (động từ), dạng い, gốc bỏ な, danh từ")
    ruby: str
    meaning_vi: str
    han_viet: str | None
    aliases: list[str] = Field(default=[], description="vocab_id các mục trùng (cùng loại + gốc) ở bài khác — dùng chung trang này")
    forms: list[ConjValue] = Field(description="Theo thứ tự ConjFormDef của nhóm; thể không dùng được thì vắng")


class ConjugationFile(_Strict):
    schema_version: int = CONJ_SCHEMA_VERSION
    groups: list[ConjGroupDef]
    forms: list[ConjFormDef]
    entries: list[ConjEntry]


# ── Số đếm & trợ số từ ────────────────────────────────────────────────────────────────────────────
COUNTER_SCHEMA_VERSION = 2  # v2: số đếm chia tab; NumberReading.display (chuỗi) thay value — có thập phân, phân số, %, số âm

# Nhóm biến âm theo âm đầu của trợ số từ — quyết định cách đọc 1, 3, 6, 8, 10, 100…
#   h: は行 (本, 匹, 杯, 分) · k: か行 (個, 回, 階, 軒) · s: さ行 (冊, 歳, 足) · t: た行 (着)
#   none: không biến âm (枚, 台, 人…) · native: số đếm thuần Nhật (～つ) · special: lịch (日, 月)
SoundGroup = Literal["h", "k", "s", "t", "none", "native", "special"]
CounterCategory = Literal["general", "people", "animals", "objects", "place", "time", "date", "frequency", "money", "age", "order"]
COUNTER_ID = re.compile(r"^c-[a-z0-9]+(-[a-z0-9]+)*$")
COUNTER_EXAMPLE_ID = re.compile(r"^(c-[a-z0-9]+(-[a-z0-9]+)*|num)-e\d{2}$")
KANA = re.compile(r"^[ぁ-ゖー]+$")


class CounterReading(_Strict):
    n: int = Field(ge=1, description="Số được đếm (1–10 bắt buộc; thêm 11, 14, 20, 100, 1000, 10000…)")
    kana: str = Field(description="Cách đọc chuẩn (hiragana)")
    alt: list[str] = Field(description="Cách đọc khác cũng đúng (hiragana)")
    irregular: bool = Field(description="Bất quy tắc — không suy ra được từ quy tắc biến âm của nhóm")
    note: str | None = Field(description="Ghi chú ngắn cho ô này (tiếng Việt)")

    @field_validator("kana")
    @classmethod
    def _kana(cls, v: str) -> str:
        if not KANA.match(v):
            raise ValueError(f"cách đọc phải là hiragana: {v!r}")
        return v

    @field_validator("alt")
    @classmethod
    def _alt(cls, v: list[str]) -> list[str]:
        bad = [a for a in v if not KANA.match(a)]
        if bad:
            raise ValueError(f"cách đọc khác phải là hiragana: {bad}")
        return v


class CounterQuestion(_Strict):
    kana: str = Field(description="なんぼん, いくつ… (hiragana)")
    alt: list[str]
    note: str | None


class CounterExample(_Strict):
    id: str = Field(description="c-{slug}-eNN | num-eNN — ghi cứng, không sinh từ vị trí")
    ruby: str = Field(description="Câu tiếng Nhật, cú pháp {漢字|かな}; [[…]] bao cụm số + trợ số từ")
    vi: str
    source: Literal["ai-draft", "user"]
    review: ReviewStatus

    @field_validator("id")
    @classmethod
    def _eid(cls, v: str) -> str:
        if not COUNTER_EXAMPLE_ID.match(v):
            raise ValueError(f"id ví dụ không đúng dạng c-slug-eNN / num-eNN: {v!r}")
        return v

    @field_validator("ruby")
    @classmethod
    def _target(cls, v: str) -> str:
        if v.count("[[") != 1 or v.count("]]") != 1:
            raise ValueError("ruby phải chứa đúng một cặp [[…]]")
        return v


class NumberReading(_Strict):
    display: str = Field(description="Số viết theo kiểu Nhật: 10,000 · 2.5 · 1/2 · 50% · -5 · 090-1234-5678 · 第1")
    kanji: str = Field(description="Cách viết chữ Hán / cách viết trong câu, vd 三百, 2分の1")
    kana: str
    alt: list[str]
    irregular: bool = Field(description="Biến âm / ngoại lệ cần học thuộc")
    note: str | None


class NumberSection(_Strict):
    id: str
    title_vi: str
    intro_vi: list[str]
    items: list[NumberReading]


class NumberTab(_Strict):
    id: str = Field(description="basic | hundreds | large | fraction | other")
    label: str = Field(description="Nhãn tab ngắn")
    sections: list[NumberSection]
    examples: list[CounterExample] = Field(description="Câu ví dụ của tab (id num-eNN)")


class NumberSystem(_Strict):
    intro_vi: list[str]
    tabs: list[NumberTab]


class SoundRule(_Strict):
    group: SoundGroup
    name_vi: str
    summary_vi: str = Field(description="Một dòng: 1, 6, 8, 10 → っ …")
    rule_vi: list[str]
    counters: list[str] = Field(description="ID trợ số từ thuộc nhóm (pipeline tính)")


class Counter(_Strict):
    id: str = Field(description="c-{slug} — khóa localStorage, KHÔNG được đổi")
    char: str = Field(description="Trợ số từ (chữ Hán hoặc kana), vd 本, つ, か月")
    kana: str = Field(description="Cách đọc gốc, vd ほん")
    name_vi: str = Field(description="Tên ngắn: 'Vật dài, thon'")
    use_vi: str = Field(description="Dùng để đếm gì")
    items_vi: list[str] = Field(description="Ví dụ vật được đếm: bút, chai, cây…")
    category: CounterCategory
    lesson: int | None = Field(ge=1, le=50, description="Bài みんなの日本語 có trợ số từ này trong từ vựng; null = ngoài danh sách từ")
    vocab_refs: list[str] = Field(description="ID từ vựng ～X tương ứng (mn-LL-NNN)")
    kanji_refs: list[str] = Field(description="ID kanji (k-字) trong trợ số từ")
    sound_group: SoundGroup
    sound_note_vi: str = Field(description="Biến âm của riêng trợ số từ này")
    readings: list[CounterReading] = Field(description="Bảng cách đọc, tăng dần theo n; có đủ 1–10")
    question: CounterQuestion = Field(description="Từ để hỏi số lượng: なんぼん, いくつ…")
    large_vi: list[str] = Field(description="Cách đếm hàng chục, trăm, nghìn, vạn với trợ số từ này")
    notes_vi: list[str]
    examples: list[CounterExample] = Field(min_length=10)

    @field_validator("id")
    @classmethod
    def _cid(cls, v: str) -> str:
        if not COUNTER_ID.match(v):
            raise ValueError(f"id không đúng dạng c-slug: {v!r}")
        return v

    @field_validator("vocab_refs")
    @classmethod
    def _vrefs(cls, v: list[str]) -> list[str]:
        bad = [x for x in v if not VOCAB_ID.match(x)]
        if bad:
            raise ValueError(f"vocab_refs không hợp lệ: {bad}")
        return v

    @field_validator("kanji_refs")
    @classmethod
    def _krefs(cls, v: list[str]) -> list[str]:
        bad = [k for k in v if not KANJI_ID.match(k)]
        if bad or len(set(v)) != len(v):
            raise ValueError(f"kanji_refs không hợp lệ hoặc trùng: {v}")
        return v


class CounterFile(_Strict):
    schema_version: int = COUNTER_SCHEMA_VERSION
    numbers: NumberSystem
    sound_rules: list[SoundRule]
    counters: list[Counter]
