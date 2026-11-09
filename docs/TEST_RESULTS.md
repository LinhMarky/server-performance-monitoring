# Kết quả kiểm tra thực tế

Ngày thực hiện: **09/11/2026** (Asia/Ho_Chi_Minh). Đây là kiểm thử chức năng và khả năng triển khai, **không phải báo cáo benchmark tải chính thức**.

## Môi trường đã chạy

- Host macOS Apple Silicon; Docker Desktop Engine 29.2.1, Compose Plugin v5.0.2, engine Linux aarch64.
- Container Web: `node:24.14.1-bookworm-slim`, Node v24.14.1, user `node`, uid/gid 1000, Express 5.2.1, pg 8.20.0.
- PostgreSQL: `postgres:17.9-bookworm`.
- Web image cục bộ `student-performance-web:1.0.0`; hai service `web`, `db` healthy.
- HTTP host `127.0.0.1:3000`, DB chỉ cổng nội bộ. Không ép AMD64, không cấu hình giới hạn CPU/RAM.
- Quy mô chính N=200.000. Database SQL test riêng N=1.000; database restore test riêng N=200.000. Cả hai DB kiểm thử tạm đã được xóa sau khi hoàn tất.

## Kết quả

| Kiểm tra đã thực thi | Kết quả |
|---|---|
| Cú pháp 16 file JavaScript và cú pháp các script Bash | PASS |
| npm install/lockfile và npm ci trong Docker | PASS; 82 package cài, audit tại thời điểm chạy báo 0 vulnerability |
| Test Backend bằng Node 24 (`node --test`) | 5/5 PASS: query duy nhất/tham số hóa; validation; lỗi DB và phục hồi; lỗi 500 an toàn; mã benchmark các quy mô; config |
| `docker compose config --quiet` | PASS |
| Docker build và up --wait trên ARM64 | PASS; Web non-root, hai healthcheck hoạt động |
| Seed mặc định trên PostgreSQL thật | PASS: 200.000 students, 40 subjects, 1.200.000 grades |
| SQL validate-data toàn bộ dữ liệu | PASS: mã duy nhất/đúng quy luật, email, 6 môn khác nhau/sinh viên, điểm/công thức/học kỳ, FK, trạng thái index |
| Functional HTTP check | 8/8 nhóm PASS, cả trước và sau rebuild/recreate |
| 106 mã benchmark trong phạm vi | PASS: tất cả trả đúng mã và ID, các timing thực không âm |
| Phân trang | PASS: trang 1/2 không trùng, trang cuối và trang rỗng đúng, limit tối đa 100, đầu vào sai trả 400 |
| Search missing/invalid/injection | PASS: 404/400 như tài liệu, số lượng dữ liệu không đổi |
| Bảng điểm và GPA | PASS với sinh viên đầu/giữa/cuối: đúng 6 môn, điểm theo seed, GPA theo tín chỉ |
| Frontend và tài nguyên static qua HTTP | PASS: `/`, CSS, JS, favicon trả 200; GET host localhost cũng 200 |
| PostgreSQL dừng thực tế | PASS: health và search trả 503 với JSON an toàn |
| PostgreSQL chạy lại, cùng container Web | PASS: health/search trở lại 200, không restart/recreate Web trong phép kiểm tra này |
| Restart cả hai container | PASS: SQL validate vẫn đủ dữ liệu và BASELINE |
| Down không -v, up --build, recreate container | PASS: dữ liệu còn nguyên; bảng điểm SV0000001 trước/sau giống nhau từng byte JSON; validate và 8 nhóm functional PASS |
| Seed lần hai không reset (DB tạm) | PASS: từ chối ghi đè dữ liệu hiện có |
| Index create/validate/drop (DB tạm) | PASS: dữ liệu sinh viên có cùng fingerprint trước/sau, drop xác nhận BASELINE |
| Reset sai N (DB tạm) | PASS: từ chối, dữ liệu và index hiện có vẫn nguyên |
| Reset rõ ràng từ OPTIMIZED (DB tạm) | PASS: bỏ index, sinh dữ liệu xác định, fingerprint bằng dữ liệu ban đầu |
| CHECK điểm và FOREIGN KEY (DB tạm) | PASS: từ chối điểm 11 và bản ghi orphan |
| pg_dump custom format, pg_restore vào DB tạm | PASS: restore đủ 200.000/40/1.200.000 dòng, toàn bộ validate-data PASS |

Functional check không tạo index hay sửa dữ liệu. Script database-check chỉ thay đổi database tạm vừa tạo; database demo chính **chưa từng được tạo idx_students_code** trong quá trình này.

## Execution plan quan sát được

Database chính N=200.000, code `SV0199999`: `Limit → Gather → Parallel Seq Scan on students`. Có hai worker PostgreSQL được planner tự chọn; không chỉnh planner hoặc số worker PostgreSQL. Đây là kết quả EXPLAIN một lần cho kiểm tra kỹ thuật, không phải thống kê hiệu năng.

Database tạm N=1.000, cùng code `SV0000999` trước/sau:

- BASELINE: `Seq Scan on students`.
- Sau lệnh create-index kiểm thử rõ ràng: `Index Scan using idx_students_code`.
- Sau drop: validate chỉ còn PK students; dữ liệu không đổi.

Không suy ra hệ số tăng tốc từ hai phép kiểm tra khác quy mô, không dùng thời gian trên Mac làm kết quả VPS. Phép so sánh chính thức trên cùng dataset của nhóm vẫn phải thực hiện riêng.

## Dữ liệu đối chiếu và log

SV0000001: Nguyễn Minh An, D21CNTT01, 6 môn, 16 tín chỉ, GPA thang 10 **5,04**. API trả GPA dạng number `5.04`.

Log cục bộ trong `test-results/` (được gitignore/dockerignore): `functional-check.log`, `final-functional-check.log`, `database-check.log`, `explain-baseline.txt`, `outage.txt`, `recovery.txt`, `validate-after-restart.txt`, `validate-after-recreate.txt`, `transcript-before.json`, `transcript-after.json`, `restore-validation.txt`, `backup-list.txt`, `restore-check.dump`. Backup này chỉ chứa dữ liệu demo của lần kiểm tra, không cần commit.

## Giới hạn xác minh

- Chưa kiểm tra thao tác/render giao diện bằng trình duyệt hoặc screenshot desktop/mobile: công cụ trả `Local browser use is disabled in Work settings`. Đã kiểm tra cú pháp JS và việc phục vụ HTML/CSS/JS, nhưng không coi đó là kiểm thử thị giác hoặc end-to-end trình duyệt.
- Chưa triển khai lên Ubuntu VPS hay build/chạy native AMD64. Hướng dẫn Ubuntu dựa trên tài liệu Docker chính thức và các lệnh Compose đã chạy trên Docker Linux ARM64.
- Chưa seed thực tế các quy mô 100.000/300.000/500.000/1.000.000; đã kiểm tra generator mã ở các quy mô này. SQL seed được thực thi ở N=1.000 và N=200.000.
- Không chạy k6/Locust, 18 lượt benchmark, Prometheus/Grafana/exporter hoặc thống kê tải; đúng ranh giới bàn giao.

## Chạy lại kiểm tra

Từ thư mục dự án đang chạy, không có workload benchmark:

```bash
node scripts/check-source.js
npm --prefix backend test
docker compose config --quiet
bash scripts/db.sh validate
bash scripts/functional-check.sh
bash scripts/database-check.sh
```

Hai lệnh Node đầu cần Node 24 và dependencies đã cài bằng `npm --prefix backend ci --ignore-scripts`. Các script Docker không yêu cầu Node ở host. Với N khác, dùng `-v student_count=N` cho validate và `bash scripts/functional-check.sh http://127.0.0.1:3000 N` nếu env chưa đồng bộ. Database-check luôn dùng database tạm N=1.000, không thay đổi N của demo.
