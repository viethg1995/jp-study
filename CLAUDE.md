# CLAUDE.md — JP Learning Site

Website tĩnh học tiếng Nhật (từ vựng, Kanji, ngữ pháp, trợ số từ) cho người Việt, theo giáo trình **みんなの日本語** N5–N4 (50 bài).
Hosting miễn phí trên **GitHub Pages**: **không có backend, không có VPS, không có database server**.
Trạng thái từng hạng mục: [plan/STATUS.md](plan/STATUS.md) — cập nhật khi hoàn thành.

## Kiến trúc: luồng dữ liệu một chiều

```
sources/ ──▶ pipeline/ (Python) ──▶ data/ ──▶ web/ (Astro) ──▶ HTML tĩnh ──▶ GitHub Pages
```

- Mỗi tầng **chỉ đọc output của tầng ngay trước nó**. `web/` không bao giờ đọc `sources/`.
- `sources/` là dữ liệu thô, **không sửa tay**. Muốn sửa dữ liệu thì sửa trong pipeline (rule, mapping, file override), không sửa thẳng `data/`.
- `data/` là output của pipeline, **được commit lên git**. GitHub Actions **chỉ build `web/`** và không chạy pipeline, vì PDF và audio có bản quyền không có trên GitHub.

| Thư mục | Vai trò |
|---|---|
| `sources/` | Dữ liệu thô: `vocabulary/`, `grammar/`, `counters/`, `kanji/`, `tracking/`; gitignored: `books/`, `audio/`, `dictionaries/`, `_archives/`, `_extracted/` (sinh bởi pipeline) |
| `pipeline/jp_pipeline/` | `paths.py` (mọi hằng số đường dẫn), `schemas.py` (hợp đồng `data/`), `extract/`, `transform/`, `enrich/`, `validate.py`, `cli.py` |
| `pipeline/enrichment/` | Lớp bổ sung/duyệt dữ liệu (commit) |
| `data/` | Output chuẩn hóa: `_schema/`, `vocabulary/`, `kanji/`, `grammar/`, `counters.json` |
| `web/` | Astro + TypeScript + Preact island + Tailwind |
| `plan/` | Kế hoạch, thiết kế, trạng thái |

Môi trường: Windows 11, Python 3.12 (venv `pipeline/.venv`, Pydantic v2, PyMuPDF), Node 22.

## ⛔ Truy cập `sources/` (BẮT BUỘC)

`sources/` chứa ~1.500 trang PDF + ~280MB audio. **Mọi truy cập phải đi qua pipeline.** Nghiêm cấm:

- Đọc trực tiếp PDF, audio, video, zip trong `sources/` (Read, Grep, hay script tự viết như `python -c "fitz.open(...)"`).
- Xem ảnh trong `sources/` **ngoài** `ai_queue/`; AI chỉ đọc ảnh **sau khi user duyệt ước tính token**, tối đa 10 trang/lượt.
- Đọc nguyên file `content.md` > 40KB, hoặc `cat` / `Get-Content` cả file đó — dùng `show "<tên>" --page N`.
- Liệt kê đệ quy toàn bộ `sources/` — dùng `python -m jp_pipeline status`.

Ngoại lệ: dữ liệu lõi nhỏ (`sources/vocabulary/*.json`, `sources/grammar/md/*.md`) đọc trực tiếp được, chỉ đọc file cần dùng.
Quy trình chi tiết: `.claude/rules/pdf-extract.md`.

## Luật cốt lõi

1. **Không backend.** Mọi tính năng chạy client-side hoặc sinh lúc build. Cần server → nói rõ và đề xuất dịch vụ free (vd Cloudflare Workers).
2. **ID cố định, ghi cứng trong data**, không bao giờ sinh từ vị trí mảng. Từ vựng Minna `mn-01-003`, N3 `n3-001` (số thứ tự sách), Kanji `k-日`, Ngữ pháp `g-01-2`, Trợ số từ `c-{slug}`. ID là khóa `localStorage` (tiến độ SRS) — đổi ID phải kèm migration.
3. **Schema là hợp đồng.** `pipeline/jp_pipeline/schemas.py` là nguồn chuẩn; zod ở `web/src/lib/schemas.ts` phải đồng bộ (gate `check:schema`). Pipeline phải **fail** khi dữ liệu không qua validate, không lặng lẽ bỏ qua.
4. **Bản quyền.** Không commit `sources/books/`, `sources/audio/`, `*.pdf`, `*.mp3`, `*.m4a`, `*.mp4` (phải có trong `.gitignore`). Bản public chỉ dùng dữ liệu tự tổng hợp, KANJIDIC2/KanjiVG (credit CC BY-SA), audio TTS.
5. **Không bịa dữ liệu tiếng Nhật.** Không tự điền nghĩa, cách đọc, âm Hán-Việt, ví dụ khi không có nguồn. Dữ liệu AI sinh phải đánh dấu `"source": "ai-draft"`; không chắc → `null`, không đoán.
6. **Liên kết hai chiều** (Từ vựng ↔ Kanji ↔ Bài ↔ Ngữ pháp) tính trong pipeline, ghi vào `data/`. Web chỉ đọc, không tính lúc runtime.
7. **localStorage:** chỉ truy cập qua `web/src/lib/storage.ts`; key có prefix `jp:` và phải đăng ký trong bảng ở `.claude/rules/web.md` (gate `check:storage`).

## Rule theo lĩnh vực

Các file dưới tự nạp khi đụng file khớp `paths:`. Nếu task chạm lĩnh vực đó mà chưa nạp → **đọc file rule trước khi làm**.

| Khi làm việc với | Đọc |
|---|---|
| Trích PDF, route, ai_queue | `.claude/rules/pdf-extract.md` |
| Kanji/Hán-Việt/từ loại từ vựng, file `_decisions/` | `.claude/rules/vocab-enrichment.md` |
| Câu ví dụ, cú pháp ruby `{漢字\|かな}` | `.claude/rules/vocab-examples.md` |
| `data/kanji/`, bộ thủ | `.claude/rules/kanji.md` |
| Dữ liệu N3 (zip, parser theo bố cục, `data/vocabulary/n3/`) | `.claude/rules/n3.md` |
| `web/` (Astro, zod, localStorage) | `.claude/rules/web.md` |

## Gate (kiểm tra cứng — phải pass)

| Gate | Chặn gì | Chạy |
|---|---|---|
| Hook `guard-sources.mjs` + `deny` trong `.claude/settings.json` | Đọc trực tiếp `sources/` trái luật | tự động; kiểm thử: `node .claude/hooks/test-guard.mjs` |
| Validate Pydantic trong `build` | Dữ liệu sai schema → không ghi `data/`, exit 1 | `python -m jp_pipeline build` |
| `check-examples` | Lỗi **E** câu ví dụ (phải về 0) | `python -m jp_pipeline check-examples --lesson N` |
| `pytest` | Hồi quy pipeline | `cd pipeline && pytest` |
| `check:schema` | zod (`web/src/lib/schemas.ts`) lệch JSON Schema Pydantic (`data/_schema/`): trường, kiểu, nullable, enum, const | `cd web && npm run check:schema` |
| `check:storage` | Dùng `localStorage` ngoài `lib/storage.ts`, key thiếu `jp:`, key chưa đăng ký | `cd web && npm run check:storage` |
| `astro check` + build | Lỗi type/zod/build web — phải pass trước khi push (đã gồm 2 gate trên) | `cd web && npm run build` |

## Coding conventions

- **Python:** type hints đầy đủ; truyền model Pydantic, không truyền `dict` thô. Mỗi bước là hàm thuần; I/O file chỉ ở `cli.py`. Không hardcode path ngoài `paths.py`. File luôn `encoding="utf-8"`; JSON `ensure_ascii=False, indent=2`, key ổn định. Đọc file không tin cậy bằng `python -I -X utf8`. Đổi logic chấm điểm PDF → tăng `SCORER_VERSION`.
- **Chung:** nội dung hiển thị và tài liệu viết **tiếng Việt**; tên biến, hàm, file viết tiếng Anh. Tên file data `kebab-case`, số bài pad 2 chữ số (`lesson-01.json`).

## Tiết kiệm token

- Ưu tiên `Grep` (có `head_limit`) và `Read` có `offset/limit` thay vì đọc cả file.
- Lọc output dài của shell (`| tail`, `| grep -v`), không in log progress.
- Không đọc lại file vừa ghi/sửa; không mở `score.json` lớn — dùng `status`.

## Lệnh chính

```bash
cd pipeline && .venv\Scripts\activate
python -m jp_pipeline build      # sources + enrichment → data/
python -m jp_pipeline check      # kiểm tra sources/ đủ chưa
python -m jp_pipeline status     # bảng tóm tắt route PDF + ước tính token AI
```

Lệnh chuyên biệt (score/extract/show/export-queue, enrich-vocab, apply-*, examples-*) nằm trong file rule tương ứng.
