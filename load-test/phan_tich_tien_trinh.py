"""DE20 - Phân tích số liệu THEO TIẾN TRÌNH của 2 lần đo bổ sung (yêu cầu 2: "tiến trình").

Chạy:  py -3.13 phan_tich_tien_trinh.py
Đầu vào (ket_qua_bo_sung/):  bs_{truoc|sau}_200vu_k6.csv, _pidstat.txt, _docker.csv, _pg.csv, _mon.csv
Đầu ra  (ket_qua_bo_sung/):  tien_trinh_tong_hop.csv, tien_trinh.json, tien_trinh_cpu.png, tien_trinh_wait.png

Ghi chú:
- CPU theo container lấy từ docker stats (200% = 2 vCPU). Cộng %CPU của pidstat theo từng tiến trình
  bị thiếu khi có nhiều tiến trình ngắn, nên chỉ dùng pidstat cho %wait, danh sách tiến trình và I/O đĩa.
- %wait (pidstat) = phần trăm thời gian tiến trình sẵn sàng chạy nhưng phải chờ được cấp CPU.
- Node.js hiện trong pidstat với tên luồng "MainThread".
- Chỉ lấy cửa sổ đo chính thức: bỏ 30 giây khởi động đầu, như phan_tich.py.
"""
import json
import re
from datetime import datetime, timezone
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

ROOT = Path(__file__).resolve().parent / "ket_qua_bo_sung"
WARMUP = 30
NGAY = "2026-11-19"   # ngày đo (UTC), pidstat chỉ ghi giờ
NHOM = {"postgres": "postgres (database)", "node": "node (web API)", "MainThread": "node (web API)"}
CONTAINER = [("server-performance-monitoring-db-1", "db (PostgreSQL)"), ("server-performance-monitoring-web-1", "web (Node.js)"),
             ("monitoring-prometheus-1", "Prometheus"), ("monitoring-grafana-1", "Grafana"), ("monitoring-node-exporter-1", "node-exporter")]


def cua_so(ten):
    k6 = pd.read_csv(ROOT / f"{ten}_k6.csv", usecols=["metric_name", "timestamp", "metric_value", "name"], low_memory=False)
    t0 = k6.loc[k6["name"] == "search", "timestamp"].min() + WARMUP
    t1 = k6["timestamp"].max()
    k = k6[(k6["timestamp"] >= t0) & (k6["timestamp"] <= t1)]
    m = lambda n: k.loc[k["metric_name"] == n, "metric_value"]
    k6s = {"throughput_rps": m("http_reqs").sum() / (t1 - t0 + 1), "lat_avg_ms": m("http_req_duration").mean(),
           "lat_p95_ms": m("http_req_duration").quantile(0.95), "db_avg_ms": m("db_query_ms").mean(),
           "error_pct": m("http_req_failed").mean() * 100}
    return int(t0), int(t1), {a: round(float(b), 2) for a, b in k6s.items()}


def doc_pidstat(ten):
    rows, cols = [], None
    for line in (ROOT / f"{ten}_pidstat.txt").read_text(encoding="utf-8", errors="replace").splitlines():
        if line.startswith("#"):
            cols = line[1:].split()
            continue
        if not cols or not re.match(r"^\d\d:\d\d:\d\d", line):
            continue
        parts = line.split()
        if len(parts) < len(cols):
            continue
        r = dict(zip(cols, parts[:len(cols) - 1] + [" ".join(parts[len(cols) - 1:])]))
        ts = datetime.strptime(f"{NGAY} {r['Time']}", "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc).timestamp()
        rows.append({"epoch": int(ts), "cmd": r["Command"], "cpu": float(r["%CPU"]), "wait": float(r["%wait"]),
                     "rd": max(float(r["kB_rd/s"]), 0), "wr": max(float(r["kB_wr/s"]), 0)})
    df = pd.DataFrame(rows)
    df["nhom"] = df["cmd"].map(lambda c: NHOM.get(c, "khác"))
    return df


def mem_mb(x):
    x = x.split("/")[0].strip()
    for u, f in (("GiB", 1024), ("MiB", 1), ("KiB", 1 / 1024)):
        if x.endswith(u):
            return float(x[:-3]) * f
    return float("nan")


def phan_tich(ten):
    t0, t1, k6s = cua_so(ten)
    ps = doc_pidstat(ten)
    ps = ps[(ps["epoch"] >= t0) & (ps["epoch"] <= t1)]
    n = ps["epoch"].nunique()
    wait = ps.groupby("nhom")["wait"].mean()
    io = ps.groupby("nhom")[["rd", "wr"]].sum() / n
    wait_giay = ps[ps["nhom"] == "postgres (database)"].groupby("epoch")["wait"].mean()
    so_tt_pg = ps[ps["nhom"] == "postgres (database)"].groupby("epoch")["cmd"].count().mean()
    top = ps.groupby("cmd")["cpu"].sum().div(n).sort_values(ascending=False).head(6)
    mon = pd.read_csv(ROOT / f"{ten}_mon.csv")
    mon = mon[(mon["epoch"] >= t0) & (mon["epoch"] <= t1)]
    pg = pd.read_csv(ROOT / f"{ten}_pg.csv")
    pg = pg[(pg["epoch"] >= t0) & (pg["epoch"] <= t1)]
    dk = pd.read_csv(ROOT / f"{ten}_docker.csv")
    dk = dk[(dk["epoch"] >= t0) & (dk["epoch"] <= t1)].copy()
    dk["cpu"] = dk["cpu_pct"].str.rstrip("%").astype(float)
    dk["mem"] = dk["mem_usage"].map(mem_mb)
    return {
        "ten": ten, "epoch_tu": t0, "epoch_den": t1, "so_giay": int(n), "k6": k6s,
        "cpu_may_tb": round(float((100 - mon["cpu_id"]).mean()), 1), "steal_tb": round(float(mon["cpu_st"].mean()), 2),
        "iowait_tb": round(float(mon["cpu_wa"].mean()), 2), "disk_util_tb": round(float(mon["disk_util"].mean()), 2),
        "ram_mb_tb": round(float(mon["mem_used_mb"].mean()), 0), "load1_tb": round(float(mon["load1"].mean()), 2),
        "docker_cpu_tb": dk.groupby("container")["cpu"].mean().round(1).to_dict(),
        "docker_mem_mb_tb": dk.groupby("container")["mem"].mean().round(0).to_dict(),
        "wait_pct_tb": wait.round(1).to_dict(),
        "io_kBps": {k: {"doc": round(float(v["rd"]), 1), "ghi": round(float(v["wr"]), 1)} for k, v in io.iterrows()},
        "so_tien_trinh_postgres_hoat_dong_tb": round(float(so_tt_pg), 1),
        "top_tien_trinh_pidstat": {k: round(float(v), 1) for k, v in top.items()},
        "pg_ket_noi_tb": round(float(pg["ket_noi_app"].mean()), 1), "pg_dang_chay_tb": round(float(pg["dang_chay"].mean()), 1),
        "pg_dang_chay_max": int(pg["dang_chay"].max()), "pg_cho_lock_max": int(pg["cho_lock"].max()),
        "_wait_giay": wait_giay,
    }


def main():
    kq = {s: phan_tich(f"bs_{s}_200vu") for s in ("truoc", "sau")}
    rows = []
    for s, r in kq.items():
        for c, lab in CONTAINER:
            rows.append({"trang_thai": s, "container": lab, "cpu_pct_tb": r["docker_cpu_tb"].get(c), "ram_mb_tb": r["docker_mem_mb_tb"].get(c)})
    pd.DataFrame(rows).to_csv(ROOT / "tien_trinh_tong_hop.csv", index=False, encoding="utf-8-sig")
    (ROOT / "tien_trinh.json").write_text(json.dumps({s: {k: v for k, v in r.items() if not k.startswith("_")} for s, r in kq.items()},
                                                     ensure_ascii=False, indent=2), encoding="utf-8")

    # Biểu đồ 1: CPU theo container (docker stats)
    fig, ax = plt.subplots(figsize=(8.5, 4.2)); x = range(len(CONTAINER)); w = 0.38
    for i, (s, lab, col) in enumerate([("truoc", "Trước (không index)", "#1f77b4"), ("sau", "Sau (có index)", "#ff7f0e")]):
        vals = [kq[s]["docker_cpu_tb"].get(c, 0) for c, _ in CONTAINER]
        bars = ax.bar([j + (i - 0.5) * w for j in x], vals, w, label=lab, color=col)
        ax.bar_label(bars, fmt="%.1f", fontsize=8.5, padding=2)
    ax.set_xticks(list(x)); ax.set_xticklabels([n for _, n in CONTAINER], fontsize=9)
    ax.set_ylabel("%CPU trung bình (200% = 2 vCPU)"); ax.set_ylim(0, 215); ax.axhline(200, color="#999", ls="--", lw=1)
    ax.set_title("CPU theo container ở 200 VU (docker stats, cửa sổ đo 120 s)"); ax.legend(); ax.grid(axis="y", alpha=.3)
    fig.tight_layout(); fig.savefig(ROOT / "tien_trinh_cpu.png", dpi=150); plt.close(fig)

    # Biểu đồ 2: %wait trung bình của các tiến trình postgres theo giây
    fig, ax = plt.subplots(figsize=(8, 3.6))
    for s, lab, col in [("truoc", "postgres trước", "#1f77b4"), ("sau", "postgres sau", "#ff7f0e")]:
        g = kq[s]["_wait_giay"]
        ax.plot(g.index - g.index.min(), g.values, label=lab, color=col, lw=1.4)
    ax.set_xlabel("giây trong cửa sổ đo"); ax.set_ylabel("%wait TB mỗi tiến trình")
    ax.set_ylim(0, 100); ax.set_title("Thời gian tiến trình postgres phải chờ CPU (pidstat %wait), 200 VU")
    ax.legend(); ax.grid(alpha=.3)
    fig.tight_layout(); fig.savefig(ROOT / "tien_trinh_wait.png", dpi=150); plt.close(fig)

    for s, r in kq.items():
        print(f"== {s}: {r['so_giay']} giây, k6 {r['k6']}")
        print(f"   máy: CPU {r['cpu_may_tb']}%, steal {r['steal_tb']}%, iowait {r['iowait_tb']}%, disk util {r['disk_util_tb']}%, RAM {r['ram_mb_tb']} MB, load1 {r['load1_tb']}")
        print(f"   docker CPU: {r['docker_cpu_tb']}")
        print(f"   docker RAM MB: {r['docker_mem_mb_tb']}")
        print(f"   %wait TB: {r['wait_pct_tb']}; số tiến trình postgres hoạt động TB {r['so_tien_trinh_postgres_hoat_dong_tb']}")
        print(f"   I/O kB/s: {r['io_kBps']}")
        print(f"   top pidstat: {r['top_tien_trinh_pidstat']}")
        print(f"   pg: kết nối TB {r['pg_ket_noi_tb']}, đang chạy TB {r['pg_dang_chay_tb']} (max {r['pg_dang_chay_max']}), chờ lock max {r['pg_cho_lock_max']}")


if __name__ == "__main__":
    main()
