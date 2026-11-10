# JP — Học từ vựng, Kanji & Ngữ pháp tiếng Nhật (N5–N4)

Website học tiếng Nhật cá nhân dành cho người Việt, bám theo giáo trình **みんなの日本語** (50 bài, trình độ N5–N4).
Toàn bộ là trang HTML tĩnh, host miễn phí trên **GitHub Pages**. Không cần VPS, không cần backend.

## Mục đích

- Gom các tài liệu học đang nằm rải rác (JSON từ vựng, Markdown ngữ pháp, PDF, file nghe, Excel) về **một nguồn dữ liệu chuẩn hóa**.
- Từ nguồn dữ liệu đó, **tự động sinh ra trang web học tập** gồm:
  - **Từ vựng**: tra theo bài, xem dạng bảng hoặc flashcard, lọc theo từ loại.
  - **Kanji**: âm On/Kun, âm Hán-Việt, thứ tự nét, bộ thủ, các từ vựng có chứa chữ đó.
  - **Ngữ pháp**: mẫu câu, giải thích và ví dụ theo từng bài.
  - **Trợ số từ & cách đếm**.
  - **Ôn tập**: lặp lại ngắt quãng (SRS, kiểu Anki) và quiz trắc nghiệm.
- Dùng tốt trên điện thoại, cài được như app (PWA) và học được khi không có mạng.
- Tiến độ học lưu trên trình duyệt (`localStorage`), không cần đăng nhập.

## Cách hoạt động

```
sources/  ──(Python pipeline)──▶  data/  ──(Astro build)──▶  HTML tĩnh  ──▶  GitHub Pages
dữ liệu thô                       dữ liệu chuẩn                web học tập
```

1. **sources/**: tài liệu gốc (JSON, MD, PDF, xlsx, audio).
2. **pipeline/** (Python): trích xuất, chuẩn hóa, liên kết Từ ↔ Kanji ↔ Ngữ pháp, rồi kiểm tra dữ liệu.
3. **data/**: dữ liệu đã chuẩn hóa, được commit lên git.
4. **web/** (Astro): đọc `data/` và sinh ra từng trang HTML.
5. **GitHub Actions**: tự build và deploy mỗi khi push.

## Công nghệ

| Phần | Công nghệ |
|------|-----------|
| Xử lý dữ liệu | Python 3.12, Pydantic, PyMuPDF, openpyxl |
| Frontend | Astro, TypeScript, Preact (phần tương tác), Tailwind CSS |
| Tìm kiếm | Pagefind (tìm kiếm tĩnh) |
| Offline | PWA (`@vite-pwa/astro`) |
| Hosting | GitHub Pages + GitHub Actions |

## Bắt đầu

> Đang trong giai đoạn khởi tạo. Các lệnh dưới đây sẽ dùng được khi `pipeline/` và `web/` được dựng xong.

```bash
# 1. Sinh dữ liệu
cd pipeline
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -e .
python -m jp_pipeline build     # sources/ → data/

# 2. Chạy web
cd ../web
npm install
npm run dev                     # http://localhost:4321
```

## Nguồn dữ liệu & bản quyền

- Từ vựng và ngữ pháp: tổng hợp cá nhân theo giáo trình みんなの日本語.
- Kanji: [KANJIDIC2](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project) và [KanjiVG](https://kanjivg.tagaini.net/) (CC BY-SA 3.0).
- Từ điển: [JMdict](https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project) — Electronic Dictionary Research and Development Group (CC BY-SA 4.0).
- Âm Hán-Việt: [Unicode Unihan Database](https://www.unicode.org/charts/unihan.html) (trường `kVietnamese`, Unicode License).
- Sách PDF và file nghe có bản quyền **chỉ dùng cá nhân trên máy**, không đưa lên repo public.
