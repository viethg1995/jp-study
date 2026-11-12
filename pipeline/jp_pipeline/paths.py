"""Đường dẫn chuẩn của dự án. Mọi module dùng các hằng số này, không hardcode path."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

SOURCES = ROOT / "sources"
DATA = ROOT / "data"

SRC_VOCABULARY = SOURCES / "vocabulary"
SRC_GRAMMAR_MD = SOURCES / "grammar" / "md"
SRC_COUNTERS = SOURCES / "counters"
SRC_KANJI = SOURCES / "kanji"
SRC_AUDIO = SOURCES / "audio"
SRC_TRACKING = SOURCES / "tracking"
SRC_BOOKS = SOURCES / "books"
SRC_GRAMMAR_PDF = SOURCES / "grammar" / "pdf"

# Từ điển mở (tải về, gitignored) + index cache
SRC_DICT = SOURCES / "dictionaries"
DICT_JMDICT = SRC_DICT / "jmdict" / "JMdict_e.gz"
DICT_KANJIDIC = SRC_DICT / "kanjidic2" / "kanjidic2.xml.gz"
DICT_UNIHAN = SRC_DICT / "unihan" / "Unihan.zip"
DICT_KANJIVG = SRC_DICT / "kanjivg"  # kanjivg-YYYYMMDD-main.zip (CC BY-SA 3.0) — lấy bản mới nhất
DICT_INDEX = SRC_DICT / "_index"
DICT_TESSDATA = SRC_DICT / "tessdata"  # jpn.traineddata (tessdata_best) cho OCR
TESSERACT_DIR = Path(r"C:\Program Files\Tesseract-OCR")  # cài qua winget UB-Mannheim.TesseractOCR

# Lớp bổ sung dữ liệu (commit). _auto/ do script sinh (ghi đè được);
# file ngoài _auto/ do người/AI duyệt — script KHÔNG BAO GIỜ ghi đè.
ENRICH_VOCAB = ROOT / "pipeline" / "enrichment" / "vocabulary"
ENRICH_KANJI = ROOT / "pipeline" / "enrichment" / "kanji"
ENRICH_CONJ = ROOT / "pipeline" / "enrichment" / "conjugation"  # forms.json: quy tắc chia thể
# counters.json (bảng trợ số từ), numbers.json (số đếm), sound-rules.json (biến âm), examples/*.txt (câu ví dụ)
ENRICH_COUNTERS = ROOT / "pipeline" / "enrichment" / "counters"
# exercises/lesson-LL.json: đề luyện dịch (người soạn/duyệt) → data/translation.json
ENRICH_TRANSLATION = ROOT / "pipeline" / "enrichment" / "translation"
ENRICH_VOCAB_AUTO = ENRICH_VOCAB / "_auto"
ENRICH_VOCAB_DECISIONS = ENRICH_VOCAB / "_decisions"  # áp theo thứ tự tên file: 01-, 02-…

# Kết quả trích xuất trung gian (PDF → Markdown). Có bản quyền nên gitignored.
EXTRACTED = SOURCES / "_extracted"
SRC_ARCHIVES = SOURCES / "_archives"  # zip/rar gốc — chỉ lưu trữ (gitignored)
EXTRACTED_MANIFEST = EXTRACTED / "manifest.json"
ROUTING_SUMMARY = EXTRACTED / "routing.json"  # tóm tắt route theo từng PDF — AI đọc file này

# Ghi đè route thủ công: {"books/N5/Nhập môn.pdf": {"1-10": "script", "21": "ai"}}
PIPELINE_CONFIG = ROOT / "pipeline" / "config"
ROUTE_OVERRIDES = PIPELINE_CONFIG / "route_overrides.json"

OUT_VOCABULARY = DATA / "vocabulary"
OUT_KANJI = DATA / "kanji"
OUT_GRAMMAR = DATA / "grammar"
OUT_COUNTERS = DATA / "counters.json"
OUT_CONJUGATION = DATA / "conjugation.json"
OUT_TRANSLATION = DATA / "translation.json"
DATA_SCHEMA = DATA / "_schema"  # JSON Schema xuất từ schemas.py — web dùng để kiểm tra đồng bộ
