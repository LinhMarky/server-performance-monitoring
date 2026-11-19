# Demo ngắn gọn – Đề tài 20

> `ubuntu@ip-...$` = đang ở **server**. `PS C:\...>` = đang ở **laptop**. Nhìn trước khi gõ.

## Chuẩn bị (trước giờ demo)

| Cửa sổ | Lệnh | Để làm gì |
|---|---|---|
| 1 (laptop) | `cd <thu-muc-du-an>`<br>`ssh -i de20-server-key.pem ubuntu@<IP-EC2>`<br>`cd ~/server-performance-monitoring` | Vào server để gõ lệnh database |
| 2 (laptop) | `cd <thu-muc-du-an>`<br>`ssh -i de20-server-key.pem -N -L 3001:127.0.0.1:3001 ubuntu@<IP-EC2>` | Đường hầm để xem Grafana. Đứng yên là đúng, **không đóng** |
| 3 (laptop) | `cd <thu-muc-du-an>\DE20_kiem_thu_tai` | Chỗ chạy k6 |
| 1 (server) | `bash scripts/db.sh drop-index` | Xóa index để server về trạng thái **chưa tối ưu** |

Trình duyệt mở 2 tab:
- **Grafana:** `localhost:3001/d/rYdddlPWk/node-exporter-full?orgId=1&from=now-5m&to=now&refresh=5s`
- **Web:** `<IP-EC2>:3000`, tra `SV0199999` → database khoảng **30 ms**

## Các bước demo

| Bước | Cửa sổ | Lệnh | Để làm gì / kết quả đúng |
|---|---|---|---|
| 1 | Báo cáo (Hình 1) | — | Giới thiệu bài toán và sơ đồ hệ thống |
| 2 | VS Code (`test.js`) | — | Giải thích cách đo: 106 mã, khởi động 30 s, đo 120 s, 3 mức × 3 lần |
| 3 | 1 | `bash scripts/functional-check.sh` | **KT1:** kiểm tra chức năng đúng trước khi đo → 8 dòng `PASS` |
| 4 | 3 + Grafana | `k6 run -e VUS=200 -e WARMUP=10s -e DURATION=40s test.js` | **Đo khi chưa có index:** CPU khoảng 100%, `db_query_ms` khoảng 1,8 s, `http_reqs` khoảng 58/s |
| 5 | 1 | `bash scripts/db.sh explain -v code=SV0199999` | **Tìm nút thắt:** thấy `Seq Scan` (quét cả 200.000 dòng), khoảng 30 ms |
| 6 | 1 | `bash scripts/db.sh create-index`<br>rồi chạy lại lệnh explain ở bước 5 | **Cải tiến:** tạo index → `Index Scan`, dưới 1 ms. Tra lại trên web → dưới 1 ms |
| 7 | 3 + Grafana | Bấm mũi tên lên để chạy lại lệnh k6 ở bước 4 | **Đo sau cải tiến:** CPU thấp, `db_query_ms` khoảng 3 ms, `http_reqs` khoảng 147/s |
| 8 | 1 | `bash scripts/functional-check.sh` | **KT3:** kiểm tra chức năng không đổi → vẫn 8 dòng `PASS` |
| 9 | Báo cáo mục 9.2 | — | Số chính thức ở 200 người: 60 → 166 lượt/s, 2.280 → 191 ms, CPU 100% → 7% |
| 10 | — | — | Đánh đổi (index tốn 6 MB, ghi chậm hơn chút), giới hạn, kết luận |

## Đọc kết quả k6 ở đâu

Cuối output, mục **CUSTOM** → `db_query_ms avg=`; mục **HTTP** → `http_req_duration avg=` và `http_reqs` (lấy số trước `/s`).

## Nếu có sự cố

- k6 báo lỗi kết nối, hoặc Grafana không vào được → chạy lại lệnh ở cửa sổ 2.
- k6 báo vài yêu cầu lỗi mà `min=0s` → lỗi mạng của laptop, không phải lỗi server.
- Mạng hỏng hẳn → chiếu `video\DE20_Video_Demo.mp4`.
- CPU trên Grafana vẫn cao sau khi k6 dừng → cửa sổ 1 gõ `top`, tìm tiến trình lạ (ví dụ `bash` bị bỏ rơi), `kill -9 <PID>`.
- `phan_tich.py` báo `Invalid argument` / `Permission denied` → đóng ảnh biểu đồ (Photos) và `tong_hop.xlsx` (Excel) rồi chạy lại.
