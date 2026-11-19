"""DE20 - Phân tích số liệu k6 (+ monitor.sh nếu có).

Chạy:  py -3.13 phan_tich.py            (đọc mọi file trong ket_qua_tho/)
       py -3.13 phan_tich.py --warmup 30

Đầu vào (đặt trong ket_qua_tho/):
  {truoc|sau|pilot}_{N}vu_lan{k}_k6.csv    k6 --out csv
  {truoc|sau|pilot}_{N}vu_lan{k}_mon.csv   monitor.sh trên server (không bắt buộc)
Đầu ra (ket_qua_phan_tich/):
  tung_lan_do.csv        chỉ số của từng lần đo
  tong_hop.csv / .xlsx   trung bình, độ lệch chuẩn mẫu, CV theo trạng thái x mức tải + so sánh trước/sau
  kt2_<lan>.png          biểu đồ theo giây: thông lượng, p95, CPU (KT2)
  so_sanh_<chi_so>.png   cột trung bình ± độ lệch chuẩn trước/sau (KT3)
"""
import argparse
import re
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "ket_qua_tho"
OUT = ROOT / "ket_qua_phan_tich"
PAT = re.compile(r"^(truoc|sau|pilot)_(\d+)vu_lan(\d+)_k6\.csv$")

# Chỉ số chính đưa vào bảng tổng hợp: (cột, nhãn, cao hơn là tốt?)
CHI_SO = [
    ("throughput_rps", "Thông lượng (req/s)", True),
    ("lat_avg_ms", "Độ trễ TB (ms)", False),
    ("lat_p95_ms", "Độ trễ p95 (ms)", False),
    ("error_pct", "Tỷ lệ lỗi (%)", False),
    ("db_avg_ms", "db_query TB (ms)", False),
    ("db_p95_ms", "db_query p95 (ms)", False),
    ("cpu_busy_avg", "CPU bận TB (%)", False),
    ("steal_avg", "Steal TB (%)", False),
]


def doc_k6(path: Path, warmup: int):
    df = pd.read_csv(path, low_memory=False,
                     usecols=["metric_name", "timestamp", "metric_value", "group", "name", "status"])
    # bỏ request health trong setup()/teardown(); metric tự định nghĩa (db_query_ms...) không có tag name
    df = df[~df["group"].fillna("").str.startswith(("::setup", "::teardown"))]
    t0 = df.loc[df["name"] == "search", "timestamp"].min()
    df = df[df["timestamp"] >= t0 + warmup]   # bỏ giai đoạn khởi động
    return df, t0


def doc_mon(path: Path, t_from: int, t_to: int):
    if not path.exists():
        return None
    mon = pd.read_csv(path)
    return mon[(mon["epoch"] >= t_from) & (mon["epoch"] <= t_to)]


def chi_so_mot_lan(k6: pd.DataFrame, mon):
    m = lambda n: k6.loc[k6["metric_name"] == n, "metric_value"]
    dur, reqs = m("http_req_duration"), m("http_reqs")
    span = k6["timestamp"].max() - k6["timestamp"].min() + 1
    r = {
        "so_request": int(reqs.sum()),
        "giay_do": int(span),
        "throughput_rps": reqs.sum() / span,
        "lat_avg_ms": dur.mean(),
        "lat_med_ms": dur.median(),
        "lat_p95_ms": dur.quantile(0.95),
        "lat_p99_ms": dur.quantile(0.99),
        "lat_max_ms": dur.max(),
        "waiting_avg_ms": m("http_req_waiting").mean(),
        "connecting_avg_ms": m("http_req_connecting").mean(),
        "error_pct": m("http_req_failed").mean() * 100,
        "check_fail_pct": (1 - m("checks").mean()) * 100 if len(m("checks")) else np.nan,
        "db_avg_ms": m("db_query_ms").mean(),
        "db_p95_ms": m("db_query_ms").quantile(0.95),
    }
    if mon is not None and len(mon):
        busy = 100 - mon["cpu_id"]
        r.update({
            "cpu_busy_avg": busy.mean(), "cpu_busy_max": busy.max(),
            "iowait_avg": mon["cpu_wa"].mean(), "steal_avg": mon["cpu_st"].mean(),
            "mem_used_max_mb": mon["mem_used_mb"].max(), "swap_used_max_mb": mon["swap_used_mb"].max(),
            "disk_util_avg": mon["disk_util"].mean(), "tcp_estab_max": mon["tcp_estab"].max(),
            "net_tx_kBps_avg": mon["net_tx_kBps"].mean(), "load1_max": mon["load1"].max(),
        })
    return r


def bieu_do_kt2(ten, k6, mon):
    dur = k6[k6["metric_name"] == "http_req_duration"]
    per_s = dur.groupby("timestamp")["metric_value"].agg(
        rps="count", p95=lambda s: s.quantile(0.95))
    t = per_s.index - per_s.index.min()
    n_ax = 3 if mon is not None and len(mon) else 2
    fig, axs = plt.subplots(n_ax, 1, figsize=(10, 2.6 * n_ax), sharex=True)
    axs[0].plot(t, per_s["rps"], lw=1)
    axs[0].set_ylabel("req/s")
    axs[1].plot(t, per_s["p95"], lw=1, color="tab:red")
    axs[1].set_ylabel("p95 (ms)")
    if n_ax == 3:
        tm = mon["epoch"] - per_s.index.min()
        axs[2].plot(tm, 100 - mon["cpu_id"], lw=1, label="CPU bận")
        axs[2].plot(tm, mon["cpu_wa"], lw=1, label="iowait")
        axs[2].plot(tm, mon["cpu_st"], lw=1, label="steal")
        axs[2].set_ylabel("%"); axs[2].set_ylim(0, 105); axs[2].legend(loc="upper right", fontsize=8)
    axs[-1].set_xlabel(f"giây kể từ sau warm-up (epoch gốc {per_s.index.min()})")
    for a in axs:
        a.grid(alpha=.3)
    fig.suptitle(f"KT2 - {ten}")
    fig.tight_layout()
    fig.savefig(OUT / f"kt2_{ten}.png", dpi=120)
    plt.close(fig)


def tong_hop(runs: pd.DataFrame):
    rows = []
    for (tt, vus), g in runs.groupby(["trang_thai", "vus"]):
        g = g.sort_values("lan")
        for col, nhan, _ in CHI_SO:
            if col not in g or g[col].isna().all():
                continue
            v = g[col].astype(float)
            mean, sd = v.mean(), v.std(ddof=1) if len(v) > 1 else np.nan
            row = {"trang_thai": tt, "vus": vus, "chi_so": nhan, "n": len(v),
                   "trung_binh": mean, "do_lech_chuan": sd,
                   "cv_pct": sd / mean * 100 if mean else np.nan,
                   "min": v.min(), "max": v.max()}
            for lan, val in zip(g["lan"], v):
                row[f"lan{lan}"] = val
            rows.append(row)
    th = pd.DataFrame(rows)
    if th.empty:
        return th, pd.DataFrame()

    # So sánh trước/sau: % thay đổi và tiêu chí "khoảng TB±SD không chồng nhau"
    ss = []
    for (vus, nhan), g in th[th["trang_thai"].isin(["truoc", "sau"])].groupby(["vus", "chi_so"]):
        if set(g["trang_thai"]) != {"truoc", "sau"}:
            continue
        a = g[g["trang_thai"] == "truoc"].iloc[0]; b = g[g["trang_thai"] == "sau"].iloc[0]
        tot = next(t for c, n, t in CHI_SO if n == nhan)
        khong_chong = (a.trung_binh + a.do_lech_chuan < b.trung_binh - b.do_lech_chuan) or \
                      (b.trung_binh + b.do_lech_chuan < a.trung_binh - a.do_lech_chuan)
        doi = (b.trung_binh - a.trung_binh) / a.trung_binh * 100 if a.trung_binh else np.nan
        tot_hon = (doi > 0) == tot if pd.notna(doi) and doi != 0 else None
        ss.append({"vus": vus, "chi_so": nhan, "truoc_tb": a.trung_binh, "truoc_sd": a.do_lech_chuan,
                   "sau_tb": b.trung_binh, "sau_sd": b.do_lech_chuan, "thay_doi_pct": doi,
                   "khong_chong_nhau": khong_chong,
                   "ket_luan": ("Cải thiện" if tot_hon else "Xấu đi") if khong_chong and tot_hon is not None
                               else "Chưa đủ bằng chứng"})
    return th, pd.DataFrame(ss)


def bieu_do_so_sanh(runs):
    if not {"truoc", "sau"} <= set(runs["trang_thai"]):
        return
    for col, nhan, _ in CHI_SO[:4]:
        g = runs[runs["trang_thai"].isin(["truoc", "sau"])].groupby(["vus", "trang_thai"])[col].agg(["mean", "std"]).unstack()
        vus = g.index.astype(str); x = np.arange(len(vus)); w = .38
        fig, ax = plt.subplots(figsize=(7, 4))
        for i, tt in enumerate(["truoc", "sau"]):
            if ("mean", tt) in g:
                ax.bar(x + (i - .5) * w, g[("mean", tt)], w, yerr=g[("std", tt)], capsize=4,
                       label="Trước (không index)" if tt == "truoc" else "Sau (có index)")
        ax.set_xticks(x, [f"{v} VU" for v in vus]); ax.set_ylabel(nhan); ax.legend(); ax.grid(axis="y", alpha=.3)
        ax.set_title(f"{nhan}: trung bình ± độ lệch chuẩn (n=3)")
        fig.tight_layout(); fig.savefig(OUT / f"so_sanh_{col}.png", dpi=120); plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--warmup", type=int, default=30)
    ap.add_argument("--khong-ve", action="store_true", help="bỏ qua biểu đồ KT2 từng lần")
    args = ap.parse_args()
    import sys
    sys.stdout.reconfigure(encoding="utf-8")  # tránh lỗi in tiếng Việt trên console Windows
    OUT.mkdir(exist_ok=True)

    runs = []
    for f in sorted(RAW.glob("*_k6.csv")):
        mt = PAT.match(f.name)
        if not mt:
            print(f"bỏ qua {f.name} (sai quy ước tên)"); continue
        tt, vus, lan = mt.group(1), int(mt.group(2)), int(mt.group(3))
        ten = f.name[:-len("_k6.csv")]
        k6, t0 = doc_k6(f, args.warmup)
        mon = doc_mon(RAW / f"{ten}_mon.csv", t0 + args.warmup, int(k6["timestamp"].max()))
        r = {"ten": ten, "trang_thai": tt, "vus": vus, "lan": lan, "epoch_bat_dau": int(t0),
             "co_monitor": mon is not None, **chi_so_mot_lan(k6, mon)}
        runs.append(r)
        if not args.khong_ve:
            bieu_do_kt2(ten, k6, mon)
        print(f"{ten:24s} rps={r['throughput_rps']:7.2f} avg={r['lat_avg_ms']:8.1f} p95={r['lat_p95_ms']:8.1f} "
              f"loi={r['error_pct']:5.2f}% db={r['db_avg_ms']:7.1f}ms monitor={'co' if mon is not None else 'khong'}")

    if not runs:
        print("Không có file k6 hợp lệ trong ket_qua_tho/"); return
    runs = pd.DataFrame(runs).sort_values(["trang_thai", "vus", "lan"])
    runs.to_csv(OUT / "tung_lan_do.csv", index=False, encoding="utf-8-sig")
    th, ss = tong_hop(runs)
    th.to_csv(OUT / "tong_hop.csv", index=False, encoding="utf-8-sig")
    with pd.ExcelWriter(OUT / "tong_hop.xlsx") as xw:
        runs.to_excel(xw, sheet_name="tung_lan_do", index=False)
        th.to_excel(xw, sheet_name="tong_hop", index=False)
        if not ss.empty:
            ss.to_excel(xw, sheet_name="truoc_sau", index=False)
    if not ss.empty:
        ss.to_csv(OUT / "truoc_sau.csv", index=False, encoding="utf-8-sig")
        print("\n=== TRƯỚC / SAU ===")
        print(ss[["vus", "chi_so", "truoc_tb", "sau_tb", "thay_doi_pct", "ket_luan"]].round(2).to_string(index=False))
    bieu_do_so_sanh(runs)
    print(f"\nĐã ghi kết quả vào {OUT}")


if __name__ == "__main__":
    main()
