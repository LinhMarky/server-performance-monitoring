# HƯỚNG DẪN DEMO TỪNG BƯỚC – ĐỀ TÀI 20

Tài liệu cầm tay cho cả nhóm khi demo trực tiếp với thầy. Mỗi bước ghi: **ai làm**, **gõ ở cửa sổ nào**, **lệnh**, **kết quả đúng trông như thế nào**, **câu nói**. Các con số "kết quả đúng" là số đã đo thật ngày 19/11/2026. Khi demo số có thể lệch một chút, đó là bình thường.

Tổng thời gian: khoảng 15 phút trình bày, sau đó hỏi đáp.

---

## Mẹo quan trọng nhất: đang ở máy nào?

Nhìn **đầu dòng** (dấu nhắc) trước khi gõ:

| Dấu nhắc trông như | Đang ở | Chỉ gõ các lệnh |
|---|---|---|
| `ubuntu@ip-172-31-33-109:~/server-performance-monitoring$` (chữ xanh) | **Server EC2** | `bash scripts/...`, `docker ...` |
| `PS C:\Users\...>` | **Laptop** | `ssh ...`, `k6 ...`, `py ...` |

Lỗi hay gặp: đã ở trên server rồi mà còn gõ `ssh ...`, máy sẽ hỏi `yes/no`. Gõ `no` hoặc Ctrl+C để hủy.

---

## PHẦN A. CHUẨN BỊ (30 phút trước giờ bảo vệ)

### A1. Mở 3 cửa sổ PowerShell trên laptop

Mở PowerShell, gõ lần lượt để mở từng cửa sổ (hoặc mở 3 cửa sổ rồi gõ từng lệnh vào từng cái).

**Cửa sổ 1 – SSH vào server** (SV2, SV3 dùng):
```powershell
cd <thu-muc-du-an>
ssh -i de20-server-key.pem ubuntu@<IP-EC2>
```
Sau khi vào được server (thấy dấu nhắc `ubuntu@ip-...`), gõ tiếp:
```bash
cd ~/server-performance-monitoring
```

**Cửa sổ 2 – Đường hầm Grafana** (để nguyên suốt buổi, **không đóng**):
```powershell
cd <thu-muc-du-an>
ssh -i de20-server-key.pem -N -L 3001:127.0.0.1:3001 ubuntu@<IP-EC2>
```
Cửa sổ này đứng yên, không hiện gì là đúng.

**Cửa sổ 3 – Chạy k6** (SV1, SV4 dùng):
```powershell
cd <thu-muc-du-an>\DE20_kiem_thu_tai
```

> Phóng to chữ trong cả 3 cửa sổ (Ctrl + lăn chuột lên) để thầy đọc được.

### A2. Đưa server về trạng thái gốc (BẮT BUỘC)

Server sau đợt đo đang **có index**. Phải xóa đi để demo được cả trước lẫn sau.

**Cửa sổ 1:**
```bash
bash scripts/db.sh drop-index && bash scripts/db.sh validate
```
**Kết quả đúng:** dòng cuối kết thúc bằng **`indexes (baseline).`**

### A3. Mở trình duyệt 2 tab

**Tab 1 – Grafana:**
1. Gõ `localhost:3001` → vào thẳng, không cần đăng nhập.
2. **Dashboards** (biểu tượng 4 ô vuông bên trái) → **Node Exporter Full**.
3. Góc trên phải: chọn khung thời gian **Last 5 minutes**, tự làm mới **5s**.

**Kết quả đúng:** thấy đồng hồ CPU Busy, Sys Load, RAM Used; biểu đồ CPU Basic gần như phẳng (server rảnh).

**Tab 2 – Trang web:**
1. Gõ `<IP-EC2>:3000`.
2. Menu trái **Tra cứu sinh viên** → gõ `SV0199999` → **Tra cứu**.

**Kết quả đúng:** hồ sơ **Đặng Hải Dũng**, lớp D23KHMT10. Ô **Thời gian phản hồi → Truy vấn Database khoảng 20–120 ms** (lần thử 19/11: **32,27 ms**).

### A4. Mở sẵn tài liệu dự phòng

- `Ho_so_nop\Lớp_Nhóm_DeTai20_BaoCaoNhom.docx` (dùng ở bước 9).
- `Ho_so_nop\video\DE20_Video_Demo.mp4` (chiếu nếu mạng hỏng).
- Cắm sạc laptop, tắt thông báo, tắt chế độ ngủ.

---

## PHẦN B. TRÌNH TỰ DEMO

### Bước 1 – Giới thiệu bài toán và kiến trúc (SV1, 1 phút)

**Màn hình:** sơ đồ hệ thống (báo cáo nhóm mục 4, Hình 1).

**Câu nói:**
> "Bài toán của nhóm là một web tra cứu sinh viên bị chậm khi nhiều người dùng cùng lúc. Hệ thống gồm 200.000 sinh viên và 1,2 triệu bản ghi điểm, chạy Node.js và PostgreSQL trên máy chủ AWS ở Sydney. Laptop của nhóm chạy k6 để giả lập nhiều người tra cứu. Trên máy chủ có Prometheus, Grafana và script monitor.sh ghi CPU, RAM, đĩa, mạng và tiến trình mỗi giây."

---

### Bước 2 – Thiết kế phép đo (SV1, 2 phút)

**Màn hình:** mở `DE20_kiem_thu_tai\test.js` trong VS Code, chỉ vào phần `options` (dòng 30–44) và hàm `default` (dòng 52–78).

**Câu nói:**
> "Nhóm đo một tác vụ: API tra cứu sinh viên theo mã. k6 tra ngẫu nhiên 106 mã rải đều từ đầu tới cuối bảng, không tra mã đầu bảng vì sẽ nhanh giả tạo. Mỗi lần đo có 30 giây khởi động, bỏ đi, và 120 giây đo chính thức. Mỗi người dùng ảo tra xong nghỉ 1 giây. Ba mức tải 10, 50, 200 người được chọn từ lần chạy thử 5 mức. Mỗi mức đo 3 lần ở cả trước và sau cải tiến, tổng cộng 18 lần. Mỗi request đều kiểm tra dữ liệu trả về đúng mã đã gửi."

---

### Bước 3 – KT1: chức năng đúng ở tải thấp (SV2, 1 phút)

**Màn hình:** tab trang web (đã tra SV0199999 ở A3), rồi cửa sổ 1.

**Câu nói khi chỉ trang web:**
> "Tra một sinh viên mất khoảng 32 ms ở database vì chưa có index, phải quét bảng. Một người tra thì chưa thấy chậm."

**Cửa sổ 1:**
```bash
bash scripts/functional-check.sh
```
**Kết quả đúng** (mất 10–20 giây):
```
PASS health
PASS database counts
PASS stable backend pagination
PASS all distributed benchmark codes and real timings
PASS 404 for a well-formed absent code
PASS validation and SQL injection protection
PASS transcript, deterministic scores and weighted GPA
PASS frontend assets and unknown route

8 functional groups passed against http://127.0.0.1:3000. No index or data was changed.
```

**Câu nói:**
> "Trước khi đo hiệu năng, nhóm xác nhận hệ thống trả đúng dữ liệu. 8 nhóm chức năng đều đạt, gồm cả 106 mã dùng để đo."

---

### Bước 4 – Tải cao ở trạng thái gốc (SV4 chạy k6, SV2 chỉ Grafana, 2 phút)

**Cửa sổ 3:**
```powershell
k6 run -e VUS=200 -e WARMUP=10s -e DURATION=40s test.js
```
Lệnh chạy khoảng 55 giây, không ghi file nên không làm lẫn số liệu chính thức.

**Trong lúc chạy:** chuyển sang **tab Grafana**.
- Đồng hồ **CPU Busy** tăng lên gần **100%**.
- **Sys Load** chuyển đỏ.
- Biểu đồ **CPU Basic** vọt lên.

**Câu nói (SV2):**
> "200 người cùng tra cứu, CPU máy chủ lên gần 100%."

**Khi k6 xong:** quay lại cửa sổ 3, chỉ vào các dòng:

| Dòng | Kết quả đúng (khoảng) |
|---|---|
| `db_query_ms ... avg=` | **1,7 – 2 s** |
| `http_req_duration ... avg=` | **1,9 – 2,3 s** |
| `http_reqs ...` | **khoảng 55–60/s** |
| `http_req_failed` | khoảng 0% |

**Câu nói (SV4):**
> "Mỗi lần tra mất gần 2 giây, máy chủ chỉ xử lý được khoảng 60 lượt mỗi giây. Đây là lần chạy minh họa; số liệu chính thức là 18 lần đo nhóm trình bày ở phần sau."

---

### Bước 5 – Tìm nút thắt có bằng chứng (SV3, 1,5 phút)

**Cửa sổ 1:**
```bash
bash scripts/db.sh explain -v code=SV0199999
```
**Kết quả đúng:** chỉ vào 3 dòng:
```
->  Parallel Seq Scan on students  (... rows=0 loops=3)
      Rows Removed by Filter: 66666
Execution Time: ... ms        (khoảng 20–120 ms)
```

**Câu nói:**
> "EXPLAIN cho thấy PostgreSQL dùng Seq Scan: quét toàn bảng, mỗi luồng bỏ qua 66.666 dòng, tức gần 200.000 dòng chỉ để lấy 1 dòng. Nhóm có 3 bằng chứng cùng chỉ một hướng:
> một là EXPLAIN quét toàn bảng;
> hai là CPU 100%, trong đó đo theo container thì PostgreSQL chiếm 178% trên tổng 200% của 2 nhân, còn steal bằng 0, tức là CPU bận thật chứ không bị AWS giới hạn;
> ba là tăng từ 100 lên 200 người mà thông lượng gần như không tăng, độ trễ tăng gấp 3.
> Kết luận: nút thắt là CPU do Seq Scan."

*(Nếu thầy hỏi thêm: mở báo cáo nhóm mục 8.3, Hình 3 CPU theo container, Hình 4 thời gian chờ CPU.)*

---

### Bước 6 – Cải tiến: đổi đúng một yếu tố (SV3, 1 phút)

**Cửa sổ 1:**
```bash
bash scripts/db.sh create-index
```
**Kết quả đúng:** `CREATE INDEX` và bảng liệt kê có dòng `idx_students_code ... 6184 kB`.

```bash
bash scripts/db.sh explain -v code=SV0199999
```
**Kết quả đúng:**
```
->  Index Scan using idx_students_code on students (...)
Execution Time: 0.0xx ms        (dưới 1 ms)
```

**Câu nói:**
> "Nhóm chỉ thêm một B-tree index trên cột mã sinh viên. Code, câu SQL, cấu hình PostgreSQL và máy chủ đều giữ nguyên. PostgreSQL chuyển từ quét toàn bảng sang tra cây index, chỉ đọc 4 trang thay vì hơn 3.000 trang, thời gian dưới 1 ms."

**Chuyển sang tab trang web**, bấm **Tra cứu** lại SV0199999.
**Kết quả đúng:** **Truy vấn Database dưới 1 ms** (so với khoảng 32 ms lúc trước).

---

### Bước 7 – Đo lại sau cải tiến (SV4 chạy, SV2 chỉ Grafana, 2 phút)

**Cửa sổ 3** – chạy **đúng lệnh như bước 4** (bấm mũi tên lên để gọi lại):
```powershell
k6 run -e VUS=200 -e WARMUP=10s -e DURATION=40s test.js
```

**Trong lúc chạy:** tab Grafana – biểu đồ CPU Basic có 2 "đỉnh": đỉnh cao lúc trước (bước 4) và đỉnh thấp hơn hẳn lúc này.

**Khi k6 xong**, kết quả đúng:

| Dòng | Trước (bước 4) | Sau (bước 7) |
|---|---|---|
| `db_query_ms avg` | 1,7–2 s | **khoảng 2–5 ms** |
| `http_req_duration avg` | khoảng 2 s | **khoảng 190–250 ms** |
| `http_reqs` | khoảng 60/s | **khoảng 145–150/s** |

**Câu nói:**
> "Cùng 200 người, thông lượng tăng gần 2,5 lần, thời gian database từ gần 2 giây xuống vài mili giây. Độ trễ còn lại khoảng 190 ms chủ yếu là đường mạng từ Việt Nam tới Sydney."

---

### Bước 8 – KT3: chức năng không đổi (SV2, 30 giây)

**Cửa sổ 1:**
```bash
bash scripts/functional-check.sh
```
**Kết quả đúng:** vẫn **`8 functional groups passed`** (lần này chạy nhanh hơn vì có index).

**Câu nói:**
> "Sau cải tiến, 8 nhóm chức năng vẫn đạt, dữ liệu trả về giống hệt trước."

---

### Bước 9 – Thống kê và phản biện (SV4, 2,5 phút)

**Màn hình:** báo cáo nhóm mục 9.2 (bảng trước/sau) và Hình 5, 6.

**Câu nói:**
> "Số liệu chính thức: mỗi mức 3 lần, tính trung bình và độ lệch chuẩn, đã bỏ 30 giây khởi động. Ở 200 người: thông lượng từ 60,2 lên 165,7 lượt mỗi giây, tăng 175%; độ trễ từ 2.280 ms xuống 191 ms; CPU từ 100% xuống 7,2%.
> Nhóm chỉ kết luận 'cải thiện' khi khoảng trung bình cộng trừ độ lệch chuẩn của trước và sau không chồng nhau. Riêng p95 ở 10 và 50 người là 'chưa đủ bằng chứng', vì mạng tới Sydney dao động mạnh làm các lần đo chênh nhau nhiều.
> Có một lần đo bị loại: lần sau_50vu_lan2 bị lỗi 1,32%, nhưng cùng lúc CPU máy chủ rảnh và chỉ có 9 kết nối, nên lỗi là do mạng laptop. Nhóm loại lần đó, ghi lý do và đo lại."

---

### Bước 10 – Đánh đổi, giới hạn, kết luận (SV1, 1 phút)

**Câu nói:**
> "Đánh đổi của index: tốn thêm 6,2 MB và mỗi lần thêm hoặc sửa sinh viên sẽ chậm hơn một chút. Hệ thống này đọc nhiều, ghi ít nên đáng giá.
> Giới hạn: độ trễ HTTP gồm cả đường mạng quốc tế; bộ giám sát chạy chung máy chủ; mới đo một loại truy vấn và n = 3.
> Kết luận: nút thắt là CPU do PostgreSQL quét toàn bảng. Đổi đúng một yếu tố là thêm index, máy chủ chịu 200 người với CPU dưới 10%, chức năng không đổi."

---

## PHẦN C. THAO TÁC CÁ NHÂN KHI BẢO VỆ

Thầy yêu cầu mỗi người tự thực hiện một thao tác. Tập trước:

| Người | Thao tác | Lệnh |
|---|---|---|
| SV1 | Đổi mức tải và chạy lại; giải thích một đoạn test.js | Cửa sổ 3: `k6 run -e VUS=50 -e WARMUP=10s -e DURATION=30s test.js` |
| SV2 | Xem container; chạy monitor.sh và giải thích các cột | Cửa sổ 1: `docker compose ps` ; `~/monitor.sh thu.csv` (Ctrl+C sau 5 giây) ; `cat thu.csv` ; `rm thu.csv` |
| SV3 | Xóa và tạo lại index, so sánh EXPLAIN | Cửa sổ 1: `bash scripts/db.sh drop-index` → `bash scripts/db.sh explain -v code=SV0199999` → `bash scripts/db.sh create-index` → explain lại |
| SV4 | Chạy phân tích, mở bảng Excel | **Đóng hết ảnh biểu đồ và Excel trước**, rồi cửa sổ 3: `py -3.13 phan_tich.py` ; mở `ket_qua_phan_tich\tong_hop.xlsx` |

---

## PHẦN D. CÂU HỎI THẦY CÓ THỂ HỎI

**Khi độ trễ tăng mà CPU chưa cao, cần kiểm tra gì?** (câu hỏi chuẩn bị của phiếu)
> Kiểm tra theo lớp: mạng (so độ trễ HTTP với db_query_ms, số kết nối TCP); máy khách (Wi-Fi, máy ngủ – như lần đo bị loại); đĩa (iowait, %util); database chờ (khóa, hết kết nối trong pool); steal time (máy ảo bị giới hạn CPU); RAM và swap; ứng dụng nghẽn một luồng.

**Vì sao 200 người chỉ được khoảng 60 lượt/giây?**
> Mỗi người tra xong nghỉ 1 giây. Nếu máy chủ nhanh thì 200 người được gần 200 lượt/giây. Thực tế mỗi lần tra mất khoảng 2,3 giây vì phải xếp hàng chờ CPU, nên 200 / (2,3 + 1) ≈ 60.

**Làm sao biết CPU là của PostgreSQL chứ không phải Node.js?**
> Đo bổ sung theo tiến trình: container PostgreSQL chiếm 177,8% trên 200%, Node.js chỉ 4,6%. Các tiến trình postgres phải chờ CPU khoảng 41% thời gian (pidstat %wait).

**Vì sao không nâng cấp máy chủ?**
> Bằng chứng chỉ thẳng vào Seq Scan. Nâng máy chỉ đẩy nút thắt lùi lại, dữ liệu càng lớn càng chậm, lại tốn tiền. Index sửa đúng nguyên nhân với chi phí thấp nhất, và đề yêu cầu đổi một yếu tố.

**Vì sao đo 3 lần? Có đủ không?**
> 3 lần là tối thiểu để tính độ lệch chuẩn và thấy biến thiên. Muốn chắc hơn nên đo 5 lần và dùng kiểm định t.

**Giám sát chạy chung máy chủ có làm sai kết quả không?**
> Có tốn một ít (khoảng 125 MB RAM, CPU dưới 1%), nhưng chạy suốt cả trước lẫn sau nên phần này như nhau, không ảnh hưởng phép so sánh.

---

## PHẦN E. KHI CÓ SỰ CỐ

| Sự cố | Cách xử lý |
|---|---|
| Gõ `ssh` mà máy hỏi `yes/no` | Đang ở trên server rồi. Gõ `no`, dùng luôn cửa sổ đó |
| Grafana không mở được | Kiểm tra cửa sổ 2 còn chạy; nếu đã tắt thì chạy lại lệnh `ssh ... -N -L 3001:...` |
| Grafana không thấy đỉnh CPU | Chọn lại khung thời gian **Last 5 minutes**, bấm nút làm mới |
| k6 báo lỗi nhiều, mạng chập chờn | Giảm còn `-e VUS=100`; nói rõ đây là lần minh họa |
| Quên xóa index ở A2 | Chạy `bash scripts/db.sh drop-index` ngay trước bước 4 |
| Mất mạng hoàn toàn | Chiếu `video\DE20_Video_Demo.mp4` và giải thích theo video |
| Số liệu demo khác bảng chính thức | Nói: lần minh họa ngắn hơn và có tính khởi động; số chính thức là trung bình 3 lần, có độ lệch chuẩn |

---

## PHẦN F. SAU BUỔI DEMO

- Server đang **có index** sau bước 6. Nếu cần demo lại lần nữa: `bash scripts/db.sh drop-index` trước.
- Đóng cửa sổ 2 (đường hầm) khi xong.
- Khi đã chấm điểm xong: Stop EC2 trên AWS Console để không bị tính tiền, cất kỹ file `de20-server-key.pem`.
