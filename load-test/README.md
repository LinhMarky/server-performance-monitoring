# DE20 – Kiểm thử tải và phân tích số liệu (phần 5)

Server: AWS EC2 t3.small Sydney, `http://3.26.226.194:3000`. Endpoint đo: `GET /api/students/search?code=...` (106 mã trong `student-codes.json`, giữ nguyên trước/sau).

## Thành phần

| File | Chạy ở | Việc |
|---|---|---|
| `test.js` | Máy khách (Windows) | Kịch bản k6: warm-up 30s + đo 120s, think time 1s, kiểm tra đúng mã trả về, ghi `db_query_ms` do server báo |
| `chay_do.ps1` | Máy khách | Chạy 1 lần đo, đặt tên file đúng quy ước, ghi `nhat_ky_do.csv` (epoch bắt đầu/kết thúc) |
| `monitor.sh` | EC2 (người có SSH) | CPU us/sy/id/wa/**st**, RAM, swap, đĩa, TCP, mạng, load mỗi giây, theo epoch |
| `phan_tich.py` | Máy khách | Bỏ warm-up, tính chỉ số từng lần, TB/SD/CV, so sánh trước/sau, biểu đồ KT2/KT3, xuất Excel |

Đã cài: k6 v2.4.0, Python 3.13 + pandas/matplotlib/openpyxl (`py -3.13`).

## Một lần đo

1. **Server (người có SSH):** không đổi index giữa chừng; bật `./monitor.sh truoc_50vu_lan1_mon.csv`.
2. **Máy khách:** `.\chay_do.ps1 -TrangThai truoc -VUS 50 -Lan 1`
3. Server: Ctrl+C monitor, gửi file `_mon.csv` → bỏ vào `ket_qua_tho\`.
4. Nghỉ ≥ 60 giây (EC2 t3 dùng CPU credit) rồi chạy lần tiếp. Đo **xen kẽ** mức: 10→50→200, rồi lần 2, lần 3.

Sau 9 lần "truoc": người tối ưu chạy `bash scripts/db.sh create-index` trên server, chạy KT1 lần 2, rồi đo 9 lần `-TrangThai sau` với **cùng** VUS.

## Phân tích

```powershell
py -3.13 phan_tich.py
```
Kết quả trong `ket_qua_phan_tich\`: `tung_lan_do.csv`, `tong_hop.xlsx` (tab tung_lan_do / tong_hop / truoc_sau), `kt2_*.png`, `so_sanh_*.png`.
Kết luận "Cải thiện" chỉ khi khoảng TB ± SD trước và sau **không chồng nhau** (n = 3).

## Lưu ý khi diễn giải

- `http_req_duration` ≈ 230–260 ms là **mạng VN ↔ Sydney**; thời gian xử lý thật của server xem `db_query_ms` (baseline ~27–36 ms ở tải thấp).
- t3.small là burstable: ghi `CPUCreditBalance` (CloudWatch) trước/sau mỗi buổi đo; nếu credit cạn, CPU bị giới hạn và `st` (steal) tăng → kết quả sai lệch.
- Pilot: chạy `-TrangThai pilot` ở 10/25/50/100/200 VU để chốt 3 mức (thấp: không lỗi, db thấp; vừa: db/p95 bắt đầu tăng; cao: quá tải/lỗi).
