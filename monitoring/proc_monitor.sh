#!/bin/bash
# DE20 - Ghi số liệu THEO TIẾN TRÌNH mỗi giây (bổ sung yêu cầu 2: "tiến trình"). Chạy TRÊN EC2.
# Dùng: ./proc_monitor.sh bs_truoc_200vu    (Ctrl+C hoặc kill để dừng)
# Tạo 3 file:
#   <ten>_pidstat.txt  pidstat -h: epoch, PID, %CPU, RSS, đọc/ghi đĩa của từng tiến trình có hoạt động
#   <ten>_docker.csv   docker stats: epoch, container, %CPU, RAM, mạng, đĩa
#   <ten>_pg.csv       số kết nối/truy vấn đang chạy trong PostgreSQL (mỗi 2 giây)
TEN=${1:?Can ten lan do}
APP=/home/ubuntu/server-performance-monitoring
LC_ALL=C pidstat -h -u -r -d 1 > "${TEN}_pidstat.txt" &
P1=$!
( echo "epoch,container,cpu_pct,mem_usage,net_io,block_io"
  while true; do E=$(date +%s)
    docker stats --no-stream --format '{{.Name}},{{.CPUPerc}},{{.MemUsage}},{{.NetIO}},{{.BlockIO}}' | sed "s/^/$E,/"
  done ) > "${TEN}_docker.csv" &
P2=$!
( echo "epoch,ket_noi_app,dang_chay,cho_lock"
  while true; do E=$(date +%s)
    R=$(cd $APP && docker compose exec -T db sh -c 'psql -X -U $POSTGRES_USER -d $POSTGRES_DB -Atc "select count(*), count(*) filter (where state='"'"'active'"'"'), count(*) filter (where wait_event_type='"'"'Lock'"'"') from pg_stat_activity where application_name='"'"'student-academic-web'"'"'"' </dev/null | tr '|' ',')
    echo "$E,$R"; sleep 2
  done ) > "${TEN}_pg.csv" &
P3=$!
trap 'kill $P1 $P2 $P3 2>/dev/null; pkill -P $P2 2>/dev/null; pkill -P $P3 2>/dev/null; exit 0' INT TERM
wait
