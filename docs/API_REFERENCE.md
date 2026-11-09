# REST API — bàn giao người viết k6

Base URL cục bộ: `http://localhost:3000`. Trên VPS thay bằng địa chỉ/port đã được quản trị viên cho phép. API chỉ đọc, JSON UTF-8; không yêu cầu token vì chỉ chứa dữ liệu demo. Không dùng với dữ liệu nhạy cảm trên Internet.

Tất cả `/api/*` trả `Cache-Control: no-store`, không ETag. Các ID và điểm được trả dạng JSON number. Cột BIGINT chỉ được chuyển sang number với phạm vi dữ liệu demo tối đa 1.000.000 sinh viên. Không ghi log thành công từng request.

## GET /api/health

Kiểm tra kết nối thật bằng `SELECT 1`. HTTP 200:

```json
{"status":"ok","database":"connected"}
```

DB không sẵn sàng: HTTP 503, `{"status":"error","database":"disconnected"}`. Health không xác nhận dữ liệu đã seed; dùng stats/validate để kiểm tra. **Không dùng health làm endpoint benchmark chính.**

## GET /api/stats

Đọc COUNT từ ba bảng, HTTP 200:

```json
{"total_students":200000,"total_subjects":40,"total_grades":1200000}
```

Số trong ví dụ ứng với seed mặc định. Bảng trống trả 0; không giả lập dữ liệu. Không đưa stats vào vòng lặp tải tìm kiếm.

## GET /api/students?page=1&limit=20

`page`: mặc định 1, số nguyên 1–1.000.000. `limit`: mặc định 20, số nguyên 1–100. Sai phạm vi, số thập phân, tham số lặp đều trả 400; không âm thầm tải tất cả dữ liệu. Thứ tự tăng dần theo `id`. Backend chỉ truy vấn tối đa `limit+1` dòng, trả tối đa `limit` dòng. Không cung cấp total/total_pages để tránh COUNT lặp.

```json
{
  "success": true,
  "data": [{"id":1,"student_code":"SV0000001","full_name":"Nguyễn Minh An","class_name":"D21CNTT01","major":"Công nghệ thông tin","enrollment_year":2021,"email":"sv0000001@example.test"}],
  "pagination":{"page":1,"limit":20,"has_next":true,"has_previous":false}
}
```

Ví dụ rút gọn còn một dòng. Trang quá cuối trả 200, `data:[]`, `has_next:false`; trang trước vẫn có thể truy cập.

## GET /api/students/search?code=SV0150000 — endpoint benchmark chính

`code` bắt buộc là chuỗi khớp `^SV\d{7}$`, phân biệt hoa/thường. Không nhận nhiều `code` trong cùng request. Đúng định dạng chưa chắc tồn tại: phạm vi đã seed là `SV0000001` đến `SV` + STUDENT_COUNT có 7 chữ số.

SQL cố định, BASELINE và OPTIMIZED giống hệt:

```sql
SELECT id, student_code, full_name, class_name, major, enrollment_year, email
FROM students
WHERE student_code = $1
LIMIT 1;
```

HTTP 200:

```json
{
  "success":true,
  "data":{"id":1,"student_code":"SV0000001","full_name":"Nguyễn Minh An","class_name":"D21CNTT01","major":"Công nghệ thông tin","enrollment_year":2021,"email":"sv0000001@example.test"},
  "performance":{"db_query_ms":12.5,"api_processing_ms":14.2}
}
```

Số đo chỉ minh họa cấu trúc, không phải kết quả benchmark. Khi chạy, mỗi request đo mới bằng `performance.now()`. `Server-Timing` cũng chứa `db;dur=...` và `app;dur=...`.

| Trường | Định nghĩa |
|---|---|
| db_query_ms | Khoảng thời gian `await pool.query(...)`, bao gồm chờ pool, truyền/nhận với DB và driver xử lý kết quả. Không phải SQL engine time thuần. |
| api_processing_ms | Từ middleware đầu vào Express đến khi chuẩn bị gửi JSON, bao gồm validate và query; chưa bao gồm hoàn tất serialize/gửi body qua mạng. |
| Thời gian trình duyệt | UI đo từ trước fetch đến sau đọc JSON; bao gồm mạng và parse phản hồi. Không nằm trong response API. |
| EXPLAIN execution time | Số đo PostgreSQL engine, xem `database/explain.sql`; không tương đương HTTP latency. |

HTTP 404 khi đúng định dạng nhưng không có dữ liệu:

```json
{"success":false,"data":null,"error":{"code":"STUDENT_NOT_FOUND","message":"Không tìm thấy sinh viên với mã này."},"performance":{"db_query_ms":12.5,"api_processing_ms":14.2}}
```

Kiểm tra response trong workload: status 200, `success===true`, `data.student_code` bằng mã gửi, ID bằng phần số, các trường performance là số không âm. Dùng `benchmark-data/student-codes.json` (JSON array, 106 mã ở quy mô mặc định). Generator lấy ít nhất 100 điểm phân bố đều từ đầu đến cuối và bổ sung các mốc; `seed.sh` cập nhật file bằng số bản ghi thực tế sau commit. Không tăng/giảm tập mã trong phép so sánh.

`SV9999999` luôn không tồn tại trong quy mô hỗ trợ tối đa 1.000.000. Tách workload mã không tồn tại khỏi workload hit; không trộn tỷ lệ khác nhau giữa hai trạng thái. Mã đầu bảng thường kết thúc Seq Scan sớm do LIMIT 1, vì vậy không chỉ dùng `SV0000001` cho cả workload.

## GET /api/students/:studentCode/transcript

Validate như search. HTTP 200 có dạng:

```json
{
  "success":true,
  "data":{
    "student":{"id":1,"student_code":"SV0000001","full_name":"Nguyễn Minh An","class_name":"D21CNTT01","major":"Công nghệ thông tin","enrollment_year":2021,"email":"sv0000001@example.test"},
    "grades":[{"subject_code":"MH001","subject_name":"Cơ sở dữ liệu","credits":3,"semester":"2025-2026-HK2","midterm_score":1.7,"final_score":2.3,"total_score":2.06}],
    "summary":{"total_subjects":6,"total_credits":16,"gpa_10":5.04}
  }
}
```

Ví dụ grades rút gọn còn một môn; summary là tổng của đủ sáu môn của SV0000001 trong seed này. Điểm tổng kết = `round(midterm*0.4 + final*0.6, 2)`. GPA = tổng điểm tổng kết nhân tín chỉ chia tổng tín chỉ, làm tròn 2 chữ số; là **thang 10**, không chuyển thang 4. Nếu sinh viên chưa có điểm, grades rỗng, 0 tín chỉ, GPA null. Không dùng transcript làm benchmark tìm kiếm chính vì có thêm JOIN và tính tổng.

## Lỗi chung

| HTTP | error.code | Tình huống |
|---|---|---|
| 400 | INVALID_STUDENT_CODE | Thiếu/sai/lặp tham số code |
| 400 | INVALID_PAGINATION | page/limit sai |
| 404 | STUDENT_NOT_FOUND | Sinh viên chưa tồn tại |
| 404 | NOT_FOUND | Endpoint API không tồn tại |
| 503 | DATABASE_UNAVAILABLE | Kết nối DB gián đoạn, quá tải hoặc statement timeout |
| 500 | INTERNAL_ERROR | Lỗi khác, ví dụ schema thiếu |

Body lỗi có `success:false,error:{code,message}`; không stack trace, SQL hoặc password. Search 404 có thêm data null và performance; lỗi validate/DB không có performance. Express 5 bắt lỗi async. Server tiếp tục phục vụ sau lỗi DB. Khi thử benchmark phải kiểm đếm HTTP error, không xem response 503 nhanh là hiệu năng tốt.

Không endpoint quản trị DB, không body POST, không cache search, không delay giả, không COUNT trong search. Giữ nguyên pool, các timeout, số worker, image, dữ liệu, cấu hình VPS và workload trước/sau. Nhóm tự chọn ba mức tải và số lần lặp; dự án không chứa k6/Locust.
