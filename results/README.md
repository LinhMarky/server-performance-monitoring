# Kết quả đo hiệu năng: trước và sau khi thêm index

Đo ngày 19/11/2026. Server AWS EC2 t3.small (Sydney, 2 vCPU, 2 GB RAM), 200.000 sinh viên. Máy khách: laptop Windows chạy k6 tại Việt Nam.

- **Tác vụ:** `GET /api/students/search?code=...`, 106 mã rải đều cả bảng
- **Mức tải:** 10 / 50 / 200 VU, mỗi lần 30s khởi động (bỏ) + 120s đo, nghỉ 1s giữa 2 request
- **Lặp:** 3 lần mỗi mức, xen kẽ 10 → 50 → 200, nghỉ 60s giữa 2 lần đo
- **Đổi đúng một yếu tố:** `CREATE INDEX idx_students_code ON students USING btree (student_code)`

## Kết quả (TB ± SD, n = 3)

| Chỉ số | Mức | Trước | Sau | Thay đổi | Kết luận |
|---|---|---|---|---|---|
| Thông lượng (req/s) | 10 VU | 7,05 ± 0,38 | 8,16 ± 0,08 | +16% | Cải thiện |
| | 50 VU | 34,5 ± 1,0 | 40,4 ± 0,7 | +17% | Cải thiện |
| | 200 VU | 60,2 ± 0,7 | 165,7 ± 0,3 | +175% | Cải thiện |
| `db_query_ms` TB | 10 VU | 74,7 ± 6,0 | 0,73 ± 0,09 | −99,0% | Cải thiện |
| | 50 VU | 128,9 ± 13,7 | 1,65 ± 0,36 | −98,7% | Cải thiện |
| | 200 VU | 1.992 ± 30 | 4,13 ± 0,49 | −99,8% | Cải thiện |
| Độ trễ TB (ms) | 10 VU | 408 ± 80 | 208 ± 9 | −49% | Cải thiện |
| | 50 VU | 434 ± 45 | 216 ± 26 | −50% | Cải thiện |
| | 200 VU | 2.280 ± 34 | 191 ± 3 | −92% | Cải thiện |
| Độ trễ p95 (ms) | 10 VU | 715 ± 406 | 366 ± 38 | −49% | Chưa đủ bằng chứng |
| | 50 VU | 693 ± 250 | 424 ± 161 | −39% | Chưa đủ bằng chứng |
| | 200 VU | 2.570 ± 38 | 324 ± 19 | −87% | Cải thiện |
| CPU bận TB (%) | 10 VU | 20,6 ± 2,0 | 2,5 ± 0,0 | −88% | Cải thiện |
| | 50 VU | 67,4 ± 3,3 | 4,1 ± 0,9 | −94% | Cải thiện |
| | 200 VU | 100 ± 0 | 7,2 ± 0,3 | −93% | Cải thiện |
| Tỷ lệ lỗi | mọi mức | 0% | 0% | | Không đổi |

"Cải thiện" chỉ khi khoảng TB ± SD trước và sau không chồng nhau. p95 ở 10/50 VU dao động mạnh do mạng VN ↔ Sydney (CV 36–57%), nên chưa đủ bằng chứng ở hai mức này.

**EXPLAIN** (`SV0199999`): trước là Parallel Seq Scan, đọc 3.351 trang, 119 ms. Sau là Index Scan, đọc 4 trang, 0,08 ms. Index tốn 6,2 MB.

## File

| File | Nội dung |
|---|---|
| `tong_hop.xlsx` / `tong_hop.csv` | TB, SD, CV theo trạng thái × mức tải (gồm cả pilot) |
| `truoc_sau.csv` | So sánh trước/sau và kết luận từng chỉ số |
| `tung_lan_do.csv` | Chỉ số của từng lần đo |
| `nhat_ky_do.csv` | Nhật ký đo: epoch bắt đầu/kết thúc, ghi chú (dòng 20 bị loại) |
| `kt1_truoc.txt`, `kt1_sau.txt` | KT1 trước/sau: functional-check, validate, EXPLAIN, dung lượng |
| `LY_DO_loai_bo.txt` | Lý do loại lần đo `sau_50vu_lan2` (lỗi mạng phía máy khách) |
| `bieu_do/so_sanh_*.png` | KT3: cột TB ± SD trước/sau |
| `bieu_do/kt2_*.png` | KT2: thông lượng, p95, CPU/iowait/steal theo từng giây của mỗi lần đo |

Số liệu thô (k6 CSV khoảng 170 MB, monitor CSV) không đưa lên repo. Tạo lại bảng và biểu đồ bằng `load-test/phan_tich.py`.
