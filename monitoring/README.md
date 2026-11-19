# Giám sát server (Prometheus + Grafana + monitor.sh)

Bộ giám sát chạy trên chính server EC2, tách riêng khỏi stack web (`docker-compose.yml` ở thư mục gốc).

| Thành phần | Cổng | Việc |
|---|---|---|
| node-exporter | 127.0.0.1:9100 | Xuất số liệu CPU (cả steal), RAM, đĩa, mạng, load của máy |
| Prometheus | 127.0.0.1:9090 | Thu số liệu từ node-exporter mỗi 5 giây, lưu 30 ngày |
| Grafana | 127.0.0.1:3001 | Dashboard, xem qua đường hầm SSH, quyền xem không cần đăng nhập |
| `monitor.sh` | | Ghi tài nguyên **mỗi 1 giây** ra CSV theo epoch, để `load-test/phan_tich.py` ghép với k6 |

Cả ba dịch vụ chỉ nghe trên 127.0.0.1, **không mở cổng ra Internet**.

## Cài trên server (Ubuntu, đã có Docker)

```bash
# chép thư mục monitoring/ của repo lên server, ví dụ thành ~/monitoring
cd ~/monitoring
echo "GF_ADMIN_PASSWORD=$(openssl rand -hex 8)" > .env && chmod 600 .env   # mật khẩu admin Grafana, KHÔNG commit
docker compose up -d
docker compose ps                                                         # 3 dịch vụ Up
curl -s 127.0.0.1:9090/api/v1/targets | grep -o '"health":"[a-z]*"'       # "up"
```

Nhập dashboard **Node Exporter Full** (ID 1860): đăng nhập Grafana bằng `admin`, vào **Dashboards → New → Import**, nhập `1860`, chọn data source Prometheus.

## Xem Grafana từ laptop

```powershell
ssh -i de20-server-key.pem -N -L 3001:127.0.0.1:3001 ubuntu@<IP_EC2>
```
Mở `http://localhost:3001`.

## monitor.sh

```bash
sudo apt install -y sysstat                     # cài 1 lần
mkdir -p ~/do_dac && cd ~/do_dac
~/monitor.sh truoc_50vu_lan1_mon.csv            # bật TRƯỚC khi k6 chạy, Ctrl+C sau khi k6 xong
```
Tên file phải trùng tên lần đo k6 (`_k6.csv` → `_mon.csv`). Cột ghi ra: `epoch, cpu_us, cpu_sy, cpu_id, cpu_wa, cpu_st, mem_used_mb, swap_used_mb, swap_in, swap_out, disk_util, disk_r_await, disk_w_await, tcp_estab, net_rx_kBps, net_tx_kBps, load1`.

## Lưu ý khi đo

- Bật bộ giám sát **trước** lần đo đầu tiên và giữ chạy suốt cả trước lẫn sau, để phần tài nguyên nó tốn (khoảng 125 MB RAM) như nhau ở hai trạng thái.
- Không mở nhiều dashboard nặng trong lúc k6 đang chạy, vì Grafana/Prometheus dùng chung CPU với server đang đo.
- Tắt: `docker compose down` (số liệu giữ trong volume).

## proc_monitor.sh (số liệu theo tiến trình)

```bash
cp proc_monitor.sh ~/ && chmod +x ~/proc_monitor.sh
cd ~/do_dac && sudo ~/proc_monitor.sh bs_truoc_200vu     # bật trước k6; dừng: sudo pkill -INT -f '[p]roc_monitor.sh bs_truoc_200vu'
```
Chạy bằng `sudo` để `pidstat` đọc được I/O của mọi tiến trình. Tạo 3 file: `<tên>_pidstat.txt` (`pidstat -h -u -r -d 1`: %CPU, %wait, RSS, kB đọc/ghi từng tiến trình), `<tên>_docker.csv` (CPU/RAM từng container), `<tên>_pg.csv` (số kết nối/truy vấn đang chạy/chờ khóa trong PostgreSQL, mỗi 2 giây). Phân tích bằng `load-test/phan_tich_tien_trinh.py`.

Lưu ý: tổng %CPU cộng từ `pidstat` bị thiếu khi có nhiều tiến trình ngắn (worker của Parallel Seq Scan), nên CPU theo container lấy từ `docker stats`. Node.js hiện trong `pidstat` với tên luồng `MainThread`.
