// Câu chào ở trang chủ — mỗi lần vào trang hiện ngẫu nhiên một cặp (không JS: hiện cặp đầu).
// jp dùng cú pháp ruby {漢字|かな} như câu ví dụ; chỉ dùng từ vựng / ngữ pháp N5–N4.

export interface Quote {
  vi: string; // khẩu hiệu tiếng Việt
  jp: string; // câu tiếng Nhật (ruby)
  jpVi: string; // nghĩa câu tiếng Nhật
}

export const QUOTES: Quote[] = [
  { vi: "Rảnh thì học, không rảnh thì cũng phải học", jp: "こんにちは！お{元気|げんき}ですか。", jpVi: "Xin chào! Bạn có khỏe không?" },
  { vi: "Mỗi ngày một chút, rồi sẽ thành thạo", jp: "{毎日|まいにち}{少|すこ}しずつ{頑張|がんば}りましょう。", jpVi: "Mỗi ngày cố gắng một chút nhé." },
  { vi: "Học hôm nay, nói được ngày mai", jp: "{一緒|いっしょ}に{日本語|にほんご}を{勉強|べんきょう}しましょう！", jpVi: "Cùng học tiếng Nhật nào!" },
  { vi: "Chậm mà chắc", jp: "{継続|けいぞく}は{力|ちから}なり。", jpVi: "Kiên trì là sức mạnh." },
  { vi: "Sai thì sửa, đừng sợ sai", jp: "{間違|まちが}えても{大丈夫|だいじょうぶ}です。", jpVi: "Sai cũng không sao đâu." },
  { vi: "Hôm nay đã học từ mới chưa?", jp: "{今日|きょう}も{新|あたら}しい{言葉|ことば}を{覚|おぼ}えましょう。", jpVi: "Hôm nay cũng nhớ thêm từ mới nhé." },
  { vi: "Mỗi ngày một chữ Hán", jp: "{一日|いちにち}に{一|ひと}つ{漢字|かんじ}を{覚|おぼ}えましょう。", jpVi: "Mỗi ngày nhớ một chữ Hán nhé." },
  { vi: "Ước mơ cần hành động", jp: "{夢|ゆめ}のために{今日|きょう}も{勉強|べんきょう}します。", jpVi: "Hôm nay tôi cũng học vì ước mơ." },
];
