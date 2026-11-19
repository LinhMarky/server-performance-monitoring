#!/bin/bash
# DE20 - Ghi tài nguyên server mỗi 1 giây ra CSV theo epoch (chạy TRÊN EC2, người có quyền SSH).
# Cài 1 lần:  sudo apt install -y sysstat
# Dùng:       ./monitor.sh truoc_50vu_lan1_mon.csv     (bật TRƯỚC khi k6 chạy, Ctrl+C sau khi k6 xong)
# Tên file phải trùng tên lần đo k6 (đổi _k6.csv thành _mon.csv) để phan_tich.py tự ghép.
OUT=${1:-monitor.csv}
IFACE=$(ip route | awk '/default/ {print $5; exit}')
DEV=$(lsblk -dno NAME,TYPE | awk '$2=="disk"{print $1; exit}')

echo "epoch,cpu_us,cpu_sy,cpu_id,cpu_wa,cpu_st,mem_used_mb,swap_used_mb,swap_in,swap_out,disk_util,disk_r_await,disk_w_await,tcp_estab,net_rx_kBps,net_tx_kBps,load1" > "$OUT"

read_net() { awk -v i="$IFACE:" '$1==i {print $2, $10}' /proc/net/dev; }
read RX0 TX0 < <(read_net)

while true; do
  vmstat 1 2 | tail -1 > /tmp/vm.$$ &
  iostat -dx "$DEV" 1 2 > /tmp/io.$$ &
  wait
  EPOCH=$(date +%s)
  # vmstat: r b swpd free buff cache si so bi bo in cs us sy id wa st [gu]
  read -r _ _ _ _ _ _ SI SO _ _ _ _ US SY ID WA ST _ < /tmp/vm.$$
  MEM=$(free -m | awk '/Mem:/ {print $3}')
  SWAP=$(free -m | awk '/Swap:/ {print $3}')
  # iostat in 2 báo cáo; lấy dòng của DEV ở báo cáo cuối, tìm cột theo tên
  read UTIL RAW WAW < <(awk '
    /^Device/ { for (i=1;i<=NF;i++) { if($i=="%util") u=i; if($i=="r_await") r=i; if($i=="w_await") w=i } }
    $1==dev && u { uu=$u; rr=(r?$r:0); ww=(w?$w:0) }
    END { print uu+0, rr+0, ww+0 }' dev="$DEV" /tmp/io.$$)
  CONN=$(ss -tn state established | tail -n +2 | wc -l)
  read RX1 TX1 < <(read_net)
  RXK=$(( (RX1-RX0)/1024 )); TXK=$(( (TX1-TX0)/1024 )); RX0=$RX1; TX0=$TX1
  LOAD=$(cut -d' ' -f1 /proc/loadavg)
  echo "$EPOCH,$US,$SY,$ID,$WA,$ST,$MEM,$SWAP,$SI,$SO,$UTIL,$RAW,$WAW,$CONN,$RXK,$TXK,$LOAD" >> "$OUT"
done
