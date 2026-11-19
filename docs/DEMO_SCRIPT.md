# ĐỀ TÀI 20: KỊCH BẢN DEMO TỪNG BƯỚC

Tài liệu cho cả nhóm. Ghi từng câu lệnh theo đúng thứ tự demo, mỗi lệnh có ba phần: **chạy ở đâu**, **để làm gì**, **kết quả mong đợi**.

- Server: AWS EC2 t3.small (Sydney), IP `3.26.226.194`, user `ubuntu`
- Ứng dụng: Node.js + PostgreSQL 17 trong Docker, 200.000 sinh viên, 1.200.000 bản ghi điểm
- Cải tiến: thêm B-tree index `idx_students_code` trên cột `students.student_code`
- Thời lượng: khoảng 15 phút + hỏi đáp

> Nếu EC2 bị Stop rồi bật lại, IP public có thể đổi. Khi đó thay `3.26.226.194` trong tài liệu này, trong `test.js` và `chay_do.ps1`.

---

## Ký hiệu nơi chạy lệnh

| Ký hiệu | Nghĩa |
|---|---|
| **[PS]** | PowerShell trên laptop Windows |
| **[PS-k6]** | PowerShell trên laptop, đứng ở thư mục `load-test` |
| **[EC2]** | Terminal đã SSH vào server, đứng ở thư mục `~/server-performance-monitoring` |
| **[Web]** | Trình duyệt |

---

## PHẦN 0: CHUẨN BỊ (làm trước giờ demo)

### 0.1. SSH vào server

**[PS]**
```powershell
cd <thư mục chứa de20-server-key.pem>
ssh -i de20-server-key.pem ubuntu@3.26.226.194
```
Sau khi vào được server:

**[EC2]**
```bash
cd ~/server-performance-monitoring
```

- **Để làm gì:** mở một cửa sổ điều khiển server. Các lệnh KT1, EXPLAIN và tạo index đều chạy ở đây.
- **Kết quả mong đợi:** dấu nhắc `ubuntu@ip-...:~/server-performance-monitoring$`.

### 0.2. Kiểm tra các container đang chạy

**[EC2]**
```bash
docker compose ps
docker compose -f ~/monitoring/docker-compose.yml ps
```

- **Để làm gì:** chắc chắn web, database và bộ giám sát (node-exporter, Prometheus, Grafana) đều đang chạy trước khi demo.
- **Kết quả mong đợi:** `web` và `db` ở trạng thái `Up (healthy)`. `node-exporter`, `prometheus` và `grafana` ở trạng thái `Up`.

### 0.3. Đưa server về trạng thái gốc (xóa index)

**[EC2]**
```bash
bash scripts/db.sh drop-index
bash scripts/db.sh validate
```

- **Để làm gì:** sau buổi đo, server đang có index. Muốn demo cả trước lẫn sau thì phải xóa index để quay về trạng thái chậm ban đầu. Dữ liệu không bị mất, không cần seed lại.
- **Kết quả mong đợi:** dòng `NOTICE: PASS: 200000 students, 40 subjects, 1200000 grades; ... indexes (baseline).` Chữ `baseline` nghĩa là chưa có index.

### 0.4. Mở Grafana

**[PS]**, mở cửa sổ PowerShell **thứ hai** và để nguyên suốt buổi:
```powershell
cd <thư mục chứa de20-server-key.pem>
ssh -i de20-server-key.pem -N -L 3001:127.0.0.1:3001 ubuntu@3.26.226.194
```
**[Web]** Mở `http://localhost:3001` → **Dashboards** → **Node Exporter Full**. Góc trên bên phải chọn **Last 5 minutes** và refresh **5s**.

- **Để làm gì:** Grafana chỉ nghe trong nội bộ server, không mở ra Internet. Lệnh `ssh -N -L` tạo đường hầm để cổng 3001 trên laptop chuyển tới cổng 3001 trên server. Cửa sổ này đứng yên, không hiện gì, là bình thường.
- **Kết quả mong đợi:** vào thẳng dashboard, không cần đăng nhập. Thấy các ô CPU Busy, Sys Load, RAM Used.
- Muốn chỉnh dashboard thì đăng nhập bằng `admin`. Mật khẩu lưu ở `~/monitoring/.env` trên server.

### 0.5. Kiểm tra server trả lời được từ mạng phòng demo

**[PS]**
```powershell
curl.exe http://3.26.226.194:3000/api/health
```

- **Để làm gì:** chắc chắn mạng của phòng demo truy cập được server ở Sydney trước khi bắt đầu.
- **Kết quả mong đợi:** `{"status":"ok","database":"connected"}`.

### 0.6. Mở sẵn cửa sổ chạy k6

**[PS]**, cửa sổ PowerShell **thứ ba**:
```powershell
cd <thư mục repo>\load-test
k6 version
```

- **Để làm gì:** đứng sẵn ở thư mục có `test.js` để lúc demo chỉ việc dán lệnh.
- **Kết quả mong đợi:** `k6 v2.4.0`.

---

## PHẦN 1: BÀI TOÁN VÀ THIẾT KẾ PHÉP ĐO (0:00 – 3:30), chiếu slide

Không chạy lệnh. Trình bày:

- **Bài toán:** web tra cứu sinh viên chậm khi nhiều người dùng cùng lúc.
- **Kiến trúc:** laptop chạy k6 → Internet → EC2 Sydney (Node.js + PostgreSQL). Prometheus, Grafana và `monitor.sh` thu tài nguyên server.
- **Thiết kế đo:**

| Yếu tố | Giá trị cố định | Vì sao |
|---|---|---|
| Tác vụ | `GET /api/students/search?code=...` | Thao tác người dùng hay làm nhất, và đang chậm nhất |
| Tập mã | 106 mã rải đều SV0000001 → SV0200000 | Tra mã đầu bảng thì PostgreSQL tìm thấy ngay và dừng, nhanh giả tạo |
| Mức tải | 10 / 50 / 200 VU | Chọn từ pilot 10/25/50/100/200: rảnh, bắt đầu chậm, quá tải |
| Một lần đo | 30s khởi động + 120s đo, nghỉ 1s giữa 2 request | Bỏ giai đoạn khởi động để số liệu ổn định |
| Lặp | 3 lần mỗi mức, xen kẽ 10 → 50 → 200 | Tính được trung bình và độ lệch chuẩn, tránh dồn sai lệch vào một mức |

Mở `test.js` cho thầy xem nếu được hỏi. Các phần chính:
- `options`: kịch bản tăng VU, gồm khởi động và đo.
- Hàm `default`: việc mỗi VU lặp lại: chọn mã ngẫu nhiên, gọi API, kiểm tra trả về đúng mã, ghi `db_query_ms`, nghỉ 1 giây.
- `setup`: kiểm tra server còn sống trước khi đo.

---

## PHẦN 2: KT1, CHỨC NĂNG ĐÚNG Ở TẢI THẤP (3:30 – 4:30)

### 2.1. Tra thử trên web

**[Web]** Mở `http://3.26.226.194:3000`, gõ mã `SV0150000` vào ô tra cứu.

- **Để làm gì:** cho thầy thấy hệ thống thật đang chạy và trả đúng hồ sơ, bảng điểm.
- **Kết quả mong đợi:** hiện hồ sơ sinh viên SV0150000 và bảng điểm 6 môn.

### 2.2. Kiểm tra chức năng tự động

**[EC2]**
```bash
bash scripts/functional-check.sh
```

- **Để làm gì:** đây là **KT1**. Trước khi đo hiệu năng phải chắc hệ thống trả đúng dữ liệu. Script kiểm tra 8 nhóm chức năng, gồm health, số lượng dữ liệu, phân trang, tra đủ 106 mã dùng để đo, mã không tồn tại trả 404, chặn SQL injection, bảng điểm và GPA.
- **Kết quả mong đợi:** 8 dòng `PASS ...` và dòng cuối `8 functional groups passed ... No index or data was changed.`

---

## PHẦN 3: DEMO TẢI CAO Ở TRẠNG THÁI GỐC (4:30 – 7:00)

Chia màn hình: k6 bên trái, Grafana bên phải.

**[PS-k6]**
```powershell
k6 run -e VUS=200 -e WARMUP=10s -e DURATION=60s test.js
```

- **Để làm gì:** tạo 200 người dùng ảo cùng tra cứu trong khoảng 70 giây để thầy thấy server chậm thế nào khi chưa có index.
  - `-e VUS=200`: 200 người dùng ảo
  - `-e WARMUP=10s`: 10 giây tăng dần số người (demo nên rút ngắn so với 30s khi đo thật)
  - `-e DURATION=60s`: giữ 200 người trong 60 giây
  - Không có `--out csv`, nên lệnh này **không ghi file** và không làm lẫn số liệu chính thức.
- **Chỉ trên Grafana:** ô **CPU Busy** tăng lên gần 100%, **Sys Load** tăng.
- **Kết quả mong đợi khi k6 chạy xong:**
  - `db_query_ms avg` khoảng **1,8 s**
  - `http_req_duration avg` khoảng **2 s**
  - `http_reqs` khoảng **57/s**
  - `http_req_failed` 0%
- **Câu cần nói:** "Đây là lần chạy minh họa. Số liệu chính thức là 9 lần đo đã làm, nhóm sẽ trình bày ở phần thống kê."
- Nếu mạng phòng demo yếu: giảm xuống `-e VUS=100`.

---

## PHẦN 4: TÌM NÚT THẮT CÓ BẰNG CHỨNG (7:00 – 8:30)

**[EC2]**
```bash
bash scripts/db.sh explain -v code=SV0199999
```

- **Để làm gì:** `EXPLAIN ANALYZE` cho thấy PostgreSQL thực sự làm gì khi tìm một sinh viên. Đây là bằng chứng trực tiếp cho nút thắt.
- **Kết quả mong đợi, chỉ vào 3 dòng:**
  - `Parallel Seq Scan on students`: quét **toàn bộ bảng**, không có index để tra.
  - `Rows Removed by Filter: 66666` (× 3 luồng): đọc gần 200.000 dòng chỉ để lấy 1 dòng.
  - `Execution Time: ~119 ms` cho một lần tìm.
- **Ghép ba bằng chứng lại:**
  1. **EXPLAIN:** mỗi lần tìm đều quét toàn bảng.
  2. **CPU:** lên **100%** suốt thời gian đo ở 200 VU (cả 3 lần đo), trong khi steal bằng 0, tức là CPU bận thật chứ không bị AWS giới hạn.
  3. **Thông lượng chạm trần:** tăng từ 100 lên 200 VU mà thông lượng chỉ tăng từ 53 lên 57 req/s, còn độ trễ tăng gấp 3.

  Kết luận: **nút thắt là CPU, do Seq Scan.**

---

## PHẦN 5: CẢI TIẾN, ĐỔI ĐÚNG MỘT YẾU TỐ (8:30 – 9:30)

### 5.1. Tạo index

**[EC2]**
```bash
bash scripts/db.sh create-index
```

- **Để làm gì:** tạo B-tree index `idx_students_code` trên cột `student_code`. Đây là **yếu tố duy nhất** nhóm thay đổi. Code, cấu hình PostgreSQL, dữ liệu và cấu hình EC2 giữ nguyên.
- **Kết quả mong đợi:** `CREATE INDEX` (khoảng 1 giây với 200.000 dòng).

### 5.2. Xác nhận index đã có

**[EC2]**
```bash
bash scripts/db.sh validate -v expected_mode=optimized
```

- **Để làm gì:** kiểm tra dữ liệu vẫn nguyên vẹn và index đã được tạo đúng.
- **Kết quả mong đợi:** `PASS: 200000 students, ... indexes (optimized)`.

### 5.3. EXPLAIN lại

**[EC2]**
```bash
bash scripts/db.sh explain -v code=SV0199999
```

- **Để làm gì:** so sánh trực tiếp với Phần 4 để thấy cách PostgreSQL tìm dữ liệu đã đổi.
- **Kết quả mong đợi:** `Index Scan using idx_students_code on students`, `Execution Time` **khoảng 0,08 ms** (so với khoảng 119 ms lúc trước), chỉ đọc 4 trang dữ liệu thay vì 3.351.
- **Câu cần nói:** "Giống tra mục lục sách thay vì lật từng trang."

### 5.4. KT1 lần 2

**[EC2]**
```bash
bash scripts/functional-check.sh
```

- **Để làm gì:** chứng minh thêm index **không làm sai chức năng**. Dữ liệu trả về giống hệt trước, chỉ nhanh hơn. Đây là một phần của KT3.
- **Kết quả mong đợi:** vẫn `8 functional groups passed`.

---

## PHẦN 6: DEMO SAU CẢI TIẾN (9:30 – 11:00)

**[PS-k6]**, chạy **đúng lệnh** như Phần 3:
```powershell
k6 run -e VUS=200 -e WARMUP=10s -e DURATION=60s test.js
```

- **Để làm gì:** cùng tải 200 người, cùng thời lượng, chỉ khác là đã có index, để thầy so trực tiếp với Phần 3.
- **Chỉ trên Grafana:** CPU Busy thấp hẳn so với lần chạy ở Phần 3, cả hai lần đều thấy trong khung "Last 5 minutes".
- **Kết quả mong đợi:**
  - `db_query_ms avg` giảm từ khoảng 1,8 s xuống **khoảng 4 ms**
  - `http_reqs` tăng từ khoảng 57/s lên **khoảng 150/s**
  - `http_req_duration avg` giảm từ khoảng 2 s xuống **khoảng 190 ms**, gần mức nền của đường mạng tới Sydney
  - (Số k6 in ra lúc demo hơi thấp hơn bảng chính thức vì có tính cả 10 giây khởi động.)

---

## PHẦN 7: THỐNG KÊ KT2, KT3 VÀ ĐÁNH ĐỔI (11:00 – 13:30), chiếu slide

Không chạy lệnh trong lúc demo. Số liệu và biểu đồ lấy từ kết quả đã tạo sẵn bằng lệnh sau.

**[PS-k6]**, chạy **trước** buổi demo:
```powershell
py -3.13 phan_tich.py
```

- **Để làm gì:** đọc 18 file k6 và 18 file monitor trong `ket_qua_tho\`, bỏ phần khởi động, tính từng chỉ số, rồi tính trung bình, độ lệch chuẩn (SD) và hệ số biến thiên (CV) theo mức tải, so sánh trước/sau và vẽ biểu đồ.
- **File đưa vào slide** (trong `ket_qua_phan_tich\`):

| File | Dùng cho | Nội dung |
|---|---|---|
| `tong_hop.xlsx`, tab `truoc_sau` | KT3 | Bảng TB ± SD trước/sau từng mức, kết luận có cải thiện hay không |
| `kt2_*.png` | KT2 | Biểu đồ theo giây: thông lượng, p95, CPU của từng lần đo |
| `so_sanh_*.png` | KT3 | Cột TB ± SD trước/sau |

- **Quy tắc kết luận:** chỉ nói "cải thiện" khi khoảng TB ± SD trước và sau **không chồng nhau** (n = 3). CV dưới 10% nghĩa là các lần đo ổn định.

### Kết quả chính thức (đo ngày 19/11/2026, TB ± SD, n = 3, đã bỏ 30s khởi động)

| Chỉ số | Mức | Trước (không index) | Sau (có index) | Thay đổi | Kết luận |
|---|---|---|---|---|---|
| Thông lượng (req/s) | 10 VU | 7,05 ± 0,38 | 8,16 ± 0,08 | +16% | Cải thiện |
| | 50 VU | 34,5 ± 1,0 | 40,4 ± 0,7 | +17% | Cải thiện |
| | 200 VU | 60,2 ± 0,7 | **165,7 ± 0,3** | **+175%** | Cải thiện |
| `db_query_ms` TB | 10 VU | 74,7 ± 6,0 ms | 0,73 ± 0,09 ms | −99,0% | Cải thiện |
| | 50 VU | 128,9 ± 13,7 ms | 1,65 ± 0,36 ms | −98,7% | Cải thiện |
| | 200 VU | 1.992 ± 30 ms | **4,13 ± 0,49 ms** | **−99,8%** | Cải thiện |
| Độ trễ TB | 10 VU | 408 ± 80 ms | 208 ± 9 ms | −49% | Cải thiện |
| | 50 VU | 434 ± 45 ms | 216 ± 26 ms | −50% | Cải thiện |
| | 200 VU | 2.280 ± 34 ms | **191 ± 3 ms** | **−92%** | Cải thiện |
| Độ trễ p95 | 10 VU | 715 ± 406 ms | 366 ± 38 ms | −49% | Chưa đủ bằng chứng |
| | 50 VU | 693 ± 250 ms | 424 ± 161 ms | −39% | Chưa đủ bằng chứng |
| | 200 VU | 2.570 ± 38 ms | 324 ± 19 ms | −87% | Cải thiện |
| CPU bận TB | 10 VU | 20,6 ± 2,0% | 2,5 ± 0,0% | −88% | Cải thiện |
| | 50 VU | 67,4 ± 3,3% | 4,1 ± 0,9% | −94% | Cải thiện |
| | 200 VU | 100 ± 0% | **7,2 ± 0,3%** | −93% | Cải thiện |
| Tỷ lệ lỗi | mọi mức | 0% | 0% (3 request lỗi / hơn 68.000 ở 200 VU) | | Không đổi |

**Cách đọc:**
- Ở 200 VU, server chuyển từ **quá tải** (CPU 100%, mỗi lần tra chờ khoảng 2,3 s) sang **dư sức** (CPU 7%, khoảng 190 ms, phần lớn là đường mạng). Thông lượng gần chạm mức tối đa lý thuyết: 200 VU / (0,19 s + 1 s nghỉ) ≈ 168 req/s.
- Ở 10 và 50 VU, thông lượng chỉ tăng khoảng 16–17% vì server chưa quá tải. Mỗi VU vẫn nghỉ 1 giây giữa 2 lần tra nên thông lượng bị giới hạn bởi think time, không phải bởi server.
- **p95 ở 10 và 50 VU "chưa đủ bằng chứng"**: p95 phụ thuộc nhiều vào mạng VN ↔ Sydney, các lần đo dao động mạnh (CV 36–57%), nên khoảng TB ± SD trước/sau chồng nhau. Nên nói thẳng điều này khi trình bày. Đây là điểm cộng cho phần phản biện.
- Steal luôn ≤ 0,2%: EC2 không bị hết CPU credit trong lúc đo.
- Có 1 lần đo bị loại (`sau_50vu_lan2` lúc 12:56) do lỗi mạng phía laptop: k6 báo lỗi, trong khi CPU server rảnh và ít kết nối TCP. Lần đó đã được đo lại. Bằng chứng ở `results/LY_DO_loai_bo.txt`.

### Xem dung lượng index (cho phần đánh đổi)

**[EC2]**
```bash
bash scripts/db.sh stats
```

- **Để làm gì:** cho thấy index tốn bao nhiêu dung lượng, đây là cái giá phải trả.
- **Đánh đổi của index:**
  - tốn thêm dung lượng đĩa
  - thêm, sửa hoặc xóa sinh viên chậm hơn một chút vì phải cập nhật index
  - chỉ có ích cho truy vấn lọc đúng cột đó

  Hệ thống tra cứu nhiều, ghi ít như thế này nên đánh đổi đáng giá.

---

## PHẦN 8: HẠN CHẾ VÀ KẾT LUẬN (13:30 – 15:00), chiếu slide

- Độ trễ HTTP gồm khoảng 230 ms mạng VN ↔ Sydney, nên nhóm dùng `db_query_ms` để đánh giá phần server.
- t3.small là máy burstable dùng CPU credit. Nhóm theo dõi steal trong mọi lần đo, và steal luôn gần 0%.
- Prometheus và Grafana chạy cùng máy, tốn khoảng 125 MB RAM. Chúng chạy suốt cả trước lẫn sau nên phần tốn này như nhau.
- Chỉ đo một loại truy vấn trong 120 giây. Tải thật đa dạng hơn.

**Kết luận:** nút thắt là CPU do Seq Scan trên bảng 200.000 dòng. Thêm một index làm truy vấn nhanh hơn nhiều lần và server chịu được tải cao hơn.

---

## PHỤ LỤC A: CÁCH ĐO CHÍNH THỨC (nếu thầy hỏi "các em đo thế nào")

Mỗi lần đo chính thức gồm 3 bước, lặp 18 lần.

**[EC2]**, bật ghi tài nguyên mỗi giây (tên file theo tên lần đo):
```bash
cd ~/do_dac && ~/monitor.sh truoc_50vu_lan1_mon.csv
```
- **Để làm gì:** ghi CPU (us/sy/id/wa/steal), RAM, swap, đĩa, kết nối TCP, mạng, load mỗi giây kèm epoch, để ghép với k6 theo thời gian (KT2).

**[PS-k6]**, chạy một lần đo:
```powershell
.\chay_do.ps1 -TrangThai truoc -VUS 50 -Lan 1
```
- **Để làm gì:** kiểm tra server sống, chạy k6 (30s khởi động + 120s đo), lưu kết quả `ket_qua_tho\truoc_50vu_lan1_k6.csv` và ghi một dòng vào `nhat_ky_do.csv` (epoch bắt đầu/kết thúc, máy khách, ghi chú).

**[EC2]**, dừng monitor bằng **Ctrl+C**, rồi **[PS-k6]** tải file về:
```powershell
scp -i <đường dẫn>\de20-server-key.pem ubuntu@3.26.226.194:~/do_dac/truoc_50vu_lan1_mon.csv ket_qua_tho\
```

Thứ tự: 9 lần `truoc` (10 → 50 → 200, lặp 3 vòng, nghỉ 60s giữa các lần) → `db.sh create-index` → KT1 lần 2 → 9 lần `sau` cùng thứ tự → `phan_tich.py`.

---

## PHỤ LỤC B: SAU BUỔI DEMO

**[EC2]**, nếu cần đưa về trạng thái gốc:
```bash
bash scripts/db.sh drop-index && bash scripts/db.sh validate
```

**[EC2]**, tắt bộ giám sát nếu không dùng nữa (số liệu Prometheus vẫn giữ):
```bash
cd ~/monitoring && docker compose down
```

Sau đó Stop EC2 trên AWS Console để không bị tính tiền, và cất kỹ hoặc xóa file `de20-server-key.pem`.

---

## PHỤ LỤC C: XỬ LÝ SỰ CỐ

| Sự cố | Xử lý |
|---|---|
| Không SSH được / mạng phòng lỗi | Chiếu video dự phòng và ảnh trong slide. Phát wifi từ điện thoại. |
| Grafana không mở | Kiểm tra cửa sổ đường hầm (0.4) còn chạy. Chạy lại lệnh `ssh -N -L ...`. |
| k6 báo lỗi nhiều | Giảm xuống `-e VUS=100`. Nói rõ đây là lần minh họa. |
| Quên xóa index trước demo | Chạy `bash scripts/db.sh drop-index` ngay trước Phần 3. |
| Số liệu demo khác bảng chính thức | Giải thích biến thiên giữa các lần đo, chỉ vào SD và CV. |
