# Bàn giao nhóm — Đề tài 20

Website, database và Docker đã tách khỏi công việc benchmark/monitoring. Bắt đầu bằng README, kết quả kiểm thử tại `docs/TEST_RESULTS.md`. Chỉ dữ liệu giả lập, không dữ liệu sinh viên thật.

## 1. Người phụ trách Linux, Docker và Grafana

- Bắt đầu bằng [bốn bước cho máy Linux trong README](../README.md#linux-quickstart). Phần [cấu tạo Web](../README.md#architecture) giải thích mỗi thư mục/file làm gì; chỉ cần sửa `.env` để triển khai thông thường. Node và PostgreSQL chạy trong container.
- Hướng dẫn cài Docker cụ thể dành cho Ubuntu 22.04/24.04 LTS; dùng được trên máy cá nhân, máy ảo hoặc VPS. Nếu là bản Linux khác, dùng hướng dẫn Docker tương ứng trước khi chạy Compose.
- Service `web`: một tiến trình Node.js/Express, container port 3000; host port `WEB_PORT` (mặc định 3000), bind mặc định localhost. Bật truy cập máy phát tải bằng WEB_BIND_ADDRESS và firewall như `DEPLOY_UBUNTU.md`.
- Service `db`: PostgreSQL, DNS `db`, port 5432 trong mạng Docker, không publish. Named volume `<project>_postgres_data` chứa dữ liệu; mount SQL chỉ đọc.
- Không cố định container_name. Xác định tên thực bằng `docker compose ps`; thường `<project>-web-1`, `<project>-db-1`. `docker compose top` xem tiến trình Node và postgres. Các kết nối Web có `application_name=student-academic-web`.
- File cần chỉnh theo máy Linux: `.env` riêng (mật khẩu, bind/port, N, pool). Không chỉnh Dockerfile/SQL/frontend/backend để đổi đường dẫn máy.
- Khởi động: `docker compose up -d --build --wait`; seed: `bash scripts/seed.sh`; kiểm tra: `bash scripts/functional-check.sh`, `bash scripts/db.sh validate`.
- Log: `docker compose logs --tail=100 web db`; theo dõi `docker compose logs -f web`; health: `/api/health`.
- Số liệu phù hợp: CPU, RSS/memory, disk IOPS/latency/space, network, container restart, HTTP throughput/error/latency từ công cụ tải, số connection DB, active queries/waits từ PostgreSQL. `docker stats --no-stream` là kiểm tra nhanh, không thay hệ thống thu thập chính thức.
- App không cài Prometheus/Grafana/exporter, không có `/metrics`. Người phụ trách monitoring tự tích hợp riêng; giữ phương pháp và overhead như nhau trong hai trạng thái. Healthcheck định kỳ vẫn chạy giống nhau trước/sau.
- Backup/restore xem README. Git không chứa volume; chuyển máy phải seed lại hoặc restore.
- Nếu mở ngay trên máy Linux, dùng localhost. Nếu gửi địa chỉ cho máy khác cùng mạng, dùng IP LAN của máy Linux và cấu hình bind/firewall; nếu là VPS, dùng public IP. Không gửi localhost cho người chạy k6 trên máy khác.

## 2. Người phụ trách k6

- Benchmark chính: **GET `/api/students/search?code=SV0150000`**.
- Mã có dạng `SV` + 7 chữ số, đúng phạm vi N đã seed; dùng `benchmark-data/student-codes.json`. File mặc định có 106 mã phân bố từ 1 tới 200.000. `seed.sh` sinh lại file theo số lượng DB thực; chuyển file này sang máy chạy tải.
- HTTP 200: `success:true`, `data` là hồ sơ, `performance:{db_query_ms,api_processing_ms}`. Validate code trả về bằng code gửi, timing số không âm. Chi tiết JSON và lỗi xem `API_REFERENCE.md`.
- `SV9999999` là mã đúng định dạng nhưng không có trong quy mô hỗ trợ: HTTP 404, `STUDENT_NOT_FOUND`. Đầu vào sai/SQL injection: 400. DB gián đoạn: 500/503 tùy loại lỗi.
- Không dùng health làm benchmark chính; không gọi stats/COUNT, transcript hoặc tải giao diện trong mỗi lượt search. Không chỉ chọn mã đầu bảng: LIMIT 1 kết thúc Seq Scan sớm.
- HTTP latency gồm nhiều lớp; `db_query_ms` ở Node bao gồm pool/network/driver. SQL engine time dùng EXPLAIN, không đánh đồng ba thước đo.
- Cố định workload, tập mã, tỷ lệ hit/miss, thời lượng, warm-up, pool, timeout, số worker, image và tài nguyên. Không seed/đổi index khi có tải.
- Nhóm tự thiết kế ba mức tải và các phép lặp trước/sau; không có script k6/Locust hay kết quả 18 lượt benchmark trong bàn giao này.

## 3. Người phụ trách tối ưu

- Schema: `students(id PK, student_code, ...)`, `subjects(id PK, credits, ...)`, `grades(id PK, student_id FK, subject_id FK, scores, semester)`.
- Mặc định **BASELINE**: students chỉ có PK id; không UNIQUE/student_code index. `grades(student_id)` có index cố định. Việc thiếu index là kịch bản thí nghiệm có kiểm soát, không phải sự cố bảo mật của hệ thống thật. Production nên có ràng buộc duy nhất phù hợp.
- Đầu vào SQL: `database/explain.sql`, `create-index.sql`, `drop-index.sql`, `database-stats.sql`, `validate-data.sql`.
- Trước tối ưu: `bash scripts/db.sh validate`, `bash scripts/db.sh explain -v code=SV0199999`.
- **Sau khi đo BASELINE xong**: `bash scripts/db.sh create-index`; xác nhận bằng `bash scripts/db.sh validate -v expected_mode=optimized`; EXPLAIN lại; `bash scripts/db.sh stats` xem dung lượng index.
- Chỉ đổi B-tree `idx_students_code`, không thay Backend, SQL, pool, workers, dữ liệu, planner/config PostgreSQL hay tài nguyên VPS.
- Kiểm tra `data` của API search trước/sau giống nhau; timing có thể khác. Không hứa trước tăng tốc bao nhiêu lần; đọc plan thực tế.
- Trả về BASELINE: `bash scripts/db.sh drop-index`, `bash scripts/db.sh validate`. Không cần seed lại.

Chi tiết các điều kiện cache/warm-up và cách đọc plan nằm trong `DATABASE_INDEX_GUIDE.md`.
