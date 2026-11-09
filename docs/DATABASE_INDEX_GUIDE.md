# Hướng dẫn thí nghiệm Index cho thành viên tối ưu

Đây là thí nghiệm chủ động về B-tree index trên mã sinh viên; không phải sự cố bất ngờ hay lỗi bảo mật. Website không tự áp dụng tối ưu. **Chưa tạo index trước khi nhóm đo xong BASELINE chính thức.** Chỉ kiểm thử chức năng create/drop trên DB thử riêng hoặc trước khi chốt điều kiện và trả về BASELINE ngay.

## 1. Ghi nhận điều kiện

Ghi commit nguồn, image/digest (`docker compose images`), Docker/PostgreSQL/Node version, CPU/RAM/disk VPS, STUDENT_COUNT, DB_POOL_MAX, timeouts, dataset mã, workload, warm-up, cách thu thập số liệu. Không chia sẻ bản `docker compose config` chưa che mật khẩu; dùng `.env.example` và ghi riêng các giá trị không bí mật.

```bash
bash scripts/db.sh stats
bash scripts/db.sh validate
bash scripts/functional-check.sh
mkdir -p test-results
bash scripts/db.sh explain -v code=SV0199999 > test-results/explain-baseline.txt
```

Mã mặc định trên phù hợp N=200.000. Với N khác, dùng mã gần cuối nằm trong dataset, ví dụ `SV0099999` cho N=100.000. Hoặc dùng cùng `SV0000001` để xem ảnh hưởng vị trí đầu bảng; không chỉ chọn mã đầu để đánh giá toàn hệ thống.

`validate` mặc định kiểm tra STUDENT_COUNT từ **container db đang chạy**. Nếu seed bằng `--count`, truyền `-v student_count=...` đúng giá trị, hoặc cập nhật .env và `docker compose up -d` trước khi bắt đầu nhóm đo.

Đọc execution plan thật: có thể gặp Seq Scan, Parallel Seq Scan/Gather khi chưa có index phù hợp. Xem `Rows Removed by Filter`, `Buffers: shared hit/read`, Planning/Execution Time. LIMIT 1 có thể kết thúc sớm. Không khẳng định kiểu plan hay mức tăng tốc trước khi chạy; không tắt enable_seqscan, không thay đổi planner settings để ép kết quả.

## 2. Sau khi nhóm đã đo xong BASELINE

Lưu phản hồi search để đối chiếu trường `data` (các trường timing sẽ thay đổi). Dừng tải trước khi DDL vì CREATE INDEX thông thường cần khóa trên bảng.

```bash
bash scripts/db.sh create-index
bash scripts/db.sh validate -v expected_mode=optimized
bash scripts/db.sh explain -v code=SV0199999 > test-results/explain-optimized.txt
bash scripts/db.sh stats
bash scripts/functional-check.sh
```

Index có thể được dùng qua Index Scan, Bitmap Scan hoặc kế hoạch khác do planner chọn. File create chỉ thêm B-tree; không chạy ANALYZE lại ở bước này vì seed đã ANALYZE và dữ liệu không đổi. `stats` in kích thước `idx_students_code`. Không gọi các lệnh nặng validate/stats/EXPLAIN đồng thời với workload đo.

Nhóm tự chạy lại workload và các lượt lặp đã thống nhất. Giữ cùng dataset, thứ tự/phân bố mã, tỷ lệ hit/miss, concurrency, thời lượng, warm-up và phương pháp thống kê. Cache PostgreSQL/OS, mức độ nóng bộ nhớ, các tác vụ nền, vị trí mã trong heap, pool và tải đều có thể ảnh hưởng kết quả. Không bịa hoặc dự đoán chắc chắn tăng tốc bao nhiêu lần.

## 3. Quay về BASELINE, giữ nguyên dữ liệu

```bash
bash scripts/db.sh drop-index
bash scripts/db.sh validate
bash scripts/db.sh explain -v code=SV0199999
```

Không cần reset/seed/restart. DROP chỉ bỏ `idx_students_code`; nếu còn index students ngoài PK, kiểm tra thủ công và chưa gọi là BASELINE.

## Không thay đổi trong phép so sánh

Backend/SQL, Node workers, pool/timeouts, dữ liệu, CPU/RAM, image, planner/PostgreSQL config, cache tầng app. Không warm-up bên này mà bỏ bên kia. Không dùng health, stats hay transcript thay search. Nếu 200.000 chưa thể hiện khác biệt rõ, chọn 500.000 hoặc 1.000.000 **trước** khi chốt phép đo, seed lại và sinh lại mã; không tăng dữ liệu giữa hai trạng thái.
