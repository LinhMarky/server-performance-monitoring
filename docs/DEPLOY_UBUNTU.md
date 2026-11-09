# Triển khai trên máy Ubuntu Linux

Hướng dẫn cho Ubuntu 24.04 LTS/22.04 LTS 64-bit, trên máy cá nhân có giao diện, máy ảo hoặc Server/VPS. Thực hiện các lệnh trong Terminal của máy Linux nhận bàn giao. Không yêu cầu MacBook, Docker Desktop hoặc cài Node.js/PostgreSQL riêng trên host.

Để có lộ trình ngắn và hiểu vai trò từng file, đọc [phần bắt đầu trên Linux trong README](../README.md#linux-quickstart). Tài liệu này giải thích chi tiết cài Docker và mạng.

Các bước cài package dưới đây đối chiếu với [Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/) ngày 09/11/2026. Nếu dùng bản Linux khác, kiểm tra `cat /etc/os-release` và chọn [hướng dẫn đúng hệ điều hành](https://docs.docker.com/engine/install/); không thêm repository Ubuntu trên Debian/Fedora. Khi Docker Engine và Compose Plugin đã sẵn sàng, dùng các bước clone/build/seed của dự án.

## 1. Kiểm tra máy

```bash
cat /etc/os-release
uname -m
lscpu
free -h
df -h
lsblk
```

Khuyến nghị khởi đầu, **chưa phải cấu hình đã benchmark**: 2–4 vCPU, RAM 4 GB trở lên, 15–20 GB đĩa trống cho Docker, database, WAL, log và backup. Quy mô 1.000.000 sinh viên/6.000.000 điểm cần thêm RAM/đĩa; nên thử seed trước khi chốt cấu hình. Ghi nguyên cấu hình trong hai trạng thái. Không đặt CPU/RAM limit tùy tiện trong Compose.

## 2. Cài Docker Engine và Compose Plugin

Trên máy Ubuntu, kiểm tra các package có thể xung đột:

```bash
dpkg -l docker.io docker-compose docker-compose-v2 docker-doc docker-buildx podman-docker containerd runc
```

Nếu chúng đã tồn tại, kiểm tra workload hiện có và làm theo mục gỡ package xung đột của Docker trước khi tiếp tục; không gỡ mù quáng trên máy có ứng dụng khác.

```bash
sudo apt update
sudo apt install -y ca-certificates curl git openssl nano
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

sudo tee /etc/apt/sources.list.d/docker.sources > /dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo systemctl status docker --no-pager
sudo docker version
sudo docker compose version
sudo docker info
```

Dùng Compose Plugin (`docker compose`), không cần cài binary Python `docker-compose`. Docker daemon phải báo Server version. Nếu chỉ có Client hoặc Cannot connect, kiểm tra `sudo journalctl -u docker --no-pager -n 100`.

Các script seed/kiểm tra gọi `docker` trực tiếp. Để chạy đúng các lệnh phía dưới bằng tài khoản triển khai, chỉ cấp quyền nhóm Docker cho tài khoản tin cậy:

```bash
sudo usermod -aG docker "$USER"
```

Đăng xuất rồi đăng nhập lại phiên desktop hoặc SSH. Kiểm tra `id -nG` và `docker info`; chỉ tiếp tục khi `docker info` thành công không cần sudo. Việc này cũng cấp đủ quyền cho những lệnh Docker nằm bên trong script. Thành viên nhóm `docker` có quyền tương đương root trên host, không cấp cho tài khoản không tin cậy và không `chmod 666 /var/run/docker.sock`. Xem [Linux post-install](https://docs.docker.com/engine/install/linux-postinstall/).

## 3. Clone và cấu hình

```bash
git clone --branch codex/student-academic-management https://github.com/LinhMarky/server-performance-monitoring.git student-performance-system
cd student-performance-system
cp .env.example .env
chmod 600 .env
openssl rand -hex 32
nano .env
```

Lệnh clone chọn đúng nhánh Web mẫu trong repo nhóm. Dán chuỗi ngẫu nhiên vào `POSTGRES_PASSWORD`; không dùng nguyên giá trị placeholder. `DB_HOST=db`, `DB_PORT=5432`; DB không phải localhost của Web. Đặt `STUDENT_COUNT=200000`, `DB_POOL_MAX=10` để bắt đầu. Không commit .env.

Trong nano, lưu bằng Ctrl+O, Enter, rồi thoát Ctrl+X. Nếu `.env` đã tồn tại, sửa file đó, không chạy lại lệnh copy đè lên cấu hình đang dùng.

**Nếu mở Web ngay trên máy Linux này:** giữ `WEB_BIND_ADDRESS=127.0.0.1` và mở `http://localhost:3000` sau khi hoàn thành bước 4. Không cần SSH tunnel.

**Nếu máy Linux là server chỉ truy cập qua SSH:** có thể giữ bind localhost và mở tunnel từ máy có trình duyệt. Thay USER/IP_LINUX bằng tài khoản và địa chỉ thực:

```bash
ssh -L 3000:127.0.0.1:3000 USER@IP_LINUX
```

Sau đó mở localhost:3000 ở máy cá nhân. Nếu muốn HTTP trực tiếp từ máy phát tải khác, đặt `WEB_BIND_ADDRESS=0.0.0.0`, giữ/chọn `WEB_PORT`, chỉ cho phép IP cần thiết qua firewall của nhà cung cấp và quy tắc Docker phù hợp. Xem phần mạng bên dưới.

## 4. Build, chạy, seed

```bash
docker compose config --quiet
docker compose up -d --build --wait --wait-timeout 180
docker compose ps
docker compose logs --tail=100 db web
bash scripts/seed.sh
bash scripts/db.sh validate
bash scripts/db.sh stats
bash scripts/functional-check.sh
curl -fsS http://127.0.0.1:3000/api/health
```

Seed chỉ chạy bằng lệnh riêng. Đợi dòng `Seed committed successfully` và wrapper báo file mã sẵn sàng, kiểm tra số lượng; không benchmark khi seed/ANALYZE/validate đang chạy. Docker build từ source trên máy nhận, tự chọn image phù hợp kiến trúc; không chép node_modules hay Docker volume từ máy phát triển.

Hoàn thành khi hai service healthy, SQL validate PASS, functional check báo 8 nhóm đạt và stats có 200.000 sinh viên/40 môn/1.200.000 điểm. Khi bật lại sau này, chỉ chạy `docker compose up -d --wait`; không seed lại DB đã có dữ liệu.

## 5. Truy cập mạng và kiểm tra firewall

```bash
hostname -I
ip -br address
sudo ss -lntp
docker compose port web 3000
sudo ufw status verbose
```

Nếu dùng máy Linux trong mạng nội bộ, lấy IP LAN bằng `hostname -I`, ví dụ `192.168.1.50`; máy cùng mạng truy cập `http://192.168.1.50:3000` sau khi đặt `WEB_BIND_ADDRESS=0.0.0.0`, chạy `docker compose up -d` và cho phép cổng HTTP từ máy nguồn. Đây chỉ là IP ví dụ, phải dùng IP thực của máy Linux. IP LAN không tự truy cập được từ Internet.

Nếu dùng VPS, IP công khai xem ở control panel nhà cung cấp, `hostname -I` có thể chỉ là IP riêng. Nếu `WEB_PORT=3000` và đã mở truy cập đúng phạm vi, URL là `http://IP_VPS:3000`. Nếu từ xa không được:

1. Curl localhost trên chính máy Linux chạy Docker để tách lỗi ứng dụng khỏi lỗi mạng.
2. Kiểm tra `docker compose ps`, logs và port mapping.
3. Kiểm tra WEB_BIND_ADDRESS; `127.0.0.1` cố ý chặn truy cập trực tiếp từ xa. Sửa .env rồi `docker compose up -d` để áp dụng; `restart` không nạp lại cấu hình.
4. Kiểm tra firewall/security group phía nhà cung cấp, IP đúng và quy tắc mạng Docker.

**Cổng Docker publish có thể bypass quy tắc ufw.** Không coi `ufw deny` là đủ để bảo vệ cổng đã publish. Dùng provider firewall, reverse proxy có kiểm soát hoặc quy tắc DOCKER-USER phù hợp với backend firewall đang dùng; đọc [Docker packet filtering](https://docs.docker.com/engine/network/packet-filtering-firewalls/) trước khi sửa. Không tắt firewall toàn bộ. Không publish PostgreSQL 5432. Chỉ dùng dữ liệu giả; nếu đưa vào ứng dụng thật cần thêm HTTPS, xác thực và phân quyền.

## 6. Vận hành

Theo bảng lệnh và backup/restore trong README. Không dùng `down -v` cho restart. Không đổi Docker Compose project name hoặc thư mục triển khai giữa chừng mà không kiểm tra volume: Compose lấy project name từ thư mục hoặc `-p`; đổi tên có thể tạo **volume mới khác**, gây tưởng mất dữ liệu. Dùng `docker volume ls` và `docker compose ls` để đối chiếu.

Ghi version bằng `docker compose exec web node --version`, `docker compose exec db postgres --version`, `docker compose images`, `docker version`. Giữ phiên bản cố định trong phép so sánh; cập nhật bảo mật là một đợt thay đổi riêng, không giữa BASELINE/OPTIMIZED.
