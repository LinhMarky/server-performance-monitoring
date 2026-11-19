# Danh mục hồ sơ nộp – Đề tài 20

Đối chiếu với "Hồ sơ nộp chung cho mọi đề" và phiếu giao đề 20. Tải các mục dưới đây lên Drive giảng viên cung cấp.

| Yêu cầu của thầy | File / vị trí | Trạng thái |
|---|---|---|
| Báo cáo 12–18 trang nội dung chính (yêu cầu, giả định, kiến trúc, triển khai, kiểm thử, đánh giá, tài liệu tham khảo; phụ lục cấu hình) | `Lớp_Nhóm_DeTai20_BaoCaoNhom.docx` (+ .pdf), 21 trang gồm bìa, mục lục, phụ lục | Cần điền lớp, nhóm, họ tên, MSSV, mục 13 và 15 |
| Sơ đồ hệ thống, bảng tài nguyên/IP/quyền | Báo cáo nhóm mục 4; `hinh/so_do_he_thong.png`; repo `docs/so_do_he_thong.png` | Xong |
| Cấu hình, script, mã nguồn cần thiết | Repo GitHub `LinhMarky/server-performance-monitoring`, nhánh `codex/student-academic-management` (`load-test/`, `monitoring/`, `results/`) | Xong |
| README ghi phiên bản, cách dựng lại, cách chạy kiểm thử, họ tên + MSSV | Repo `README.md` (mục "Thành viên nhóm", "Phiên bản", "Dựng lại và chạy kiểm thử") | Cần điền họ tên, MSSV |
| Bảng kiểm thử: đầu vào, thao tác, mong đợi, thực tế, đạt/chưa đạt, bằng chứng có dấu thời gian | Báo cáo nhóm mục 7 (KT1.1–KT3.5) | Xong |
| Dữ liệu đo gốc | `DE20_du_lieu_goc.zip` (11,5 MB; đọc `DOC_TRUOC.txt` bên trong) | Xong |
| Video demo 5–7 phút | `video/DE20_Video_Demo.mp4` (6:34, không có tiếng, chú thích trên màn hình) | Có thể lồng tiếng thuyết minh |
| Phiếu đóng góp cá nhân (nhiệm vụ, file tạo ra, bằng chứng, lỗi đã xử lý) | `Lop_Nhom_DeTai20_{1..4}_BaoCaoCaNhan_SV{1..4}.docx` (+ .pdf), theo mẫu `Mau bao cao ca nhan.docx` | Mỗi người tự điền phần tự làm / được hỗ trợ / AI |
| Nêu nguồn mã và cách sử dụng AI | Báo cáo nhóm mục 15; mục 9 mỗi báo cáo cá nhân | Cần nhóm xác nhận, ghi rõ |
| Bằng chứng KT1–KT3 | Repo `results/` (kt1_truoc.txt, kt1_sau.txt, nhat_ky_do.csv, bieu_do/), dữ liệu gốc | Xong |
| Câu hỏi chuẩn bị | Báo cáo nhóm mục 11 | Xong |

## Trước khi nộp

1. Thay mọi chỗ `[...]`, `SV1 (họ tên)`, `msv: 1` bằng thông tin thật (báo cáo nhóm, 4 báo cáo cá nhân, README repo).
2. Mỗi thành viên sửa mục 2, 7, 9 trong báo cáo cá nhân cho đúng phần mình thực sự làm.
3. Mở báo cáo nhóm trong Word → chuột phải vào mục lục → Update Field.
4. Đổi tên file theo mẫu `Lop_Nhom_DeTai_MSSV_BaoCaoCaNhan.docx`, xuất lại PDF nếu cần.
5. Tạo lại báo cáo từ số liệu (nếu sửa nội dung trong script): `cd tao_docx && node bao_cao_nhom.js && node bao_cao_ca_nhan.js`.

## Trước buổi bảo vệ

- Server hiện **có index** (trạng thái sau cải tiến). Muốn demo lại cả trước/sau: `bash scripts/db.sh drop-index` trước buổi demo.
- Video có thể quay lại bằng `video/quay_video.ps1` (chạy lệnh thật trên server, khoảng 7 phút, không chạm máy khi quay).
- Mỗi người tập: trình bày phần mình, mở minh chứng, thực hiện một thao tác (xem mục 8 báo cáo cá nhân "Nội dung có thể giải thích và thao tác").
- Sau khi chấm xong: Stop EC2 trên AWS Console, cất kỹ file `de20-server-key.pem`.
