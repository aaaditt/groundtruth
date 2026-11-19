"""
make_graphs.py -- one graph per slide (01-06 and "The loop"), saved in this folder.

Every number comes from the result tables that the project's own scripts write from the
real Lecocq et al. (2020) data and the USGS catalogue. Nothing here is simulated. Run
the scripts first (they write outputs/), then this:

    python src/train_stations.py
    python src/shape_vs_level.py
    python src/score_days.py
    python src/confusion_detector.py
    python src/holiday_holdout.py
    python src/transfer.py
    python src/noise_floor.py
    python src/noise_floor.py --export BE.UCC
    python aradhya/make_graphs.py
"""
import os, subprocess, sys

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.dirname(os.path.abspath(__file__))
T = os.path.join(REPO, "outputs", "tables")

INK, RUST, GOLD, GREY = "#1d2430", "#b5541c", "#c9a227", "#9aa3ad"
plt.rcParams.update({"font.size": 13, "axes.titlesize": 15, "axes.spines.top": False,
                     "axes.spines.right": False, "figure.dpi": 150})


def save(fig, name):
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, name), dpi=150)
    plt.close(fig)
    print("wrote aradhya/" + name)


# ---------------------------------------------------------------- 01 the core task
def slide01():
    s = pd.read_csv(os.path.join(REPO, "outputs", "station_scores.csv"))
    fig, axes = plt.subplots(1, 2, figsize=(13, 5))
    for ax, col, chance, title in [
            (axes[0], "weekend_bal_acc", 0.5, "Weekday vs weekend (balanced accuracy)"),
            (axes[1], "dow_acc", 1 / 7, "Exact day of the week (accuracy)")]:
        v = s[col] * 100
        ax.hist(v, bins=np.arange(0, 102, 4), color=RUST, edgecolor="white")
        ax.axvline(chance * 100, color=GREY, lw=2, ls="--")
        ax.text(chance * 100 + 1, ax.get_ylim()[1] * 0.92, f"chance {chance*100:.0f}%", color=GREY)
        ax.axvline(v.median(), color=INK, lw=2)
        ax.text(v.median() - 1, ax.get_ylim()[1] * 0.80, f"median {v.median():.1f}%",
                color=INK, ha="right", fontweight="bold")
        ax.set_title(title)
        ax.set_xlabel("% correct on weeks the model never saw")
        ax.set_ylabel("stations")
        ax.yaxis.get_major_locator().set_params(integer=True)   # whole stations only
    fig.suptitle(f"01 · Reading the day off the ground: {len(s)} stations", fontsize=16)
    save(fig, "01_core_task.png")


# ---------------------------------------------------------------- 02 shape vs volume
def slide02():
    d = pd.read_csv(os.path.join(T, "shape_vs_level.csv"))
    fig, axes = plt.subplots(1, 2, figsize=(13, 5.5))
    for ax, task, chance, title in [(axes[0], "weekend", 50, "Weekday vs weekend"),
                                    (axes[1], "dow", 100 / 7, "Exact day of the week")]:
        lv, sh = d[f"rf_level_{task}"] * 100, d[f"rf_shape_{task}"] * 100
        ax.scatter(lv, sh, s=28, color=RUST, alpha=0.7, edgecolor="none")
        ax.plot([0, 100], [0, 100], color=GREY, ls="--")
        lo = min(lv.min(), sh.min()) - 5
        ax.set_xlim(lo, 101); ax.set_ylim(lo, 101)
        above = int((sh > lv).sum())
        ax.set_title(f"{title}: shape wins at {above} of {len(d)}")
        ax.set_xlabel("volume only: how loud the day was (%)")
        ax.set_ylabel("shape only: when it was busy (%)")
        ax.text(99, lo + 3, f"median: volume {lv.median():.0f}%, shape {sh.median():.0f}%",
                ha="right", va="bottom", color=INK, fontweight="bold",
                bbox=dict(facecolor="white", edgecolor="none", alpha=0.9))
        ax.axhline(chance, color=GREY, lw=0.8); ax.axvline(chance, color=GREY, lw=0.8)
    fig.suptitle("02 · The shape of a day tells you more than its volume (dots above the line)",
                 fontsize=16)
    save(fig, "02_shape_vs_volume.png")


# ---------------------------------------------------------------- 03 its mistakes find things
def slide03():
    day = pd.read_csv(os.path.join(T, "day_scores.csv"), parse_dates=["date"], keep_default_na=False)
    top = pd.read_csv(os.path.join(T, "top_confusion_days.csv"), keep_default_na=False)
    cd = pd.read_csv(os.path.join(T, "confusion_detector.csv"))
    code = "AM.R7885"                                     # New York, a showcase city
    ny = day[(day["station"] == code) & (day["period"] != "lockdown")].sort_values("date")
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(15, 5.5), gridspec_kw={"width_ratios": [2.3, 1]})
    a1.plot(ny["date"], ny["confusion"] * 100, color=GREY, lw=1)
    hol = ny[ny["period"] == "holiday"]
    a1.scatter(hol["date"], hol["confusion"] * 100, color=RUST, s=60, zorder=3,
               label="official public holiday")
    # label only the official holidays among the most confusing days, spread apart
    t = top[(top["station"] == code) & (top["status"] == "verified holiday")].head(3)
    shifts = [(-70, 12), (-75, 32), (95, 8)]           # (x, y) label offsets in points
    for (_, r), (dx, dy) in zip(t.sort_values("date").iterrows(), shifts):
        dt = pd.Timestamp(r["date"])
        y = ny.loc[ny["date"] == dt, "confusion"].iloc[0] * 100
        a1.annotate(f"{r['note']}\n{r['day']} → model says {r['model_says']}",
                    (dt, y), xytext=(dx, dy), textcoords="offset points", ha="center",
                    va="bottom", fontsize=10.5, fontweight="bold",
                    arrowprops=dict(arrowstyle="-", color=INK, lw=0.8))
    a1.set_ylim(0, 135)
    a1.set_yticks([0, 25, 50, 75, 100])
    a1.set_ylabel("confusion: 100% − P(true day) %")
    a1.set_title("New York: how surprised the model is by each day", pad=10)
    a1.legend(loc="lower left", frameon=True, framealpha=0.9)
    import matplotlib.dates as mdates
    a1.xaxis.set_major_locator(mdates.MonthLocator())
    a1.xaxis.set_major_formatter(mdates.DateFormatter("%b %Y"))
    sub = cd[cd["subset"] == "all days"]
    vals = [sub["confusion_pr_auc"].median(), sub["anomaly_pr_auc"].median(), sub["prevalence"].median()]
    bars = a2.bar(["confusion", "plain\nanomaly", "chance"], vals, color=[RUST, GOLD, GREY])
    for b, v in zip(bars, vals):
        a2.text(b.get_x() + b.get_width() / 2, v + 0.01, f"{v:.2f}", ha="center", fontweight="bold")
    a2.set_ylim(0, 1)
    a2.set_ylabel("PR-AUC for finding holidays\n(median over stations)")
    a2.set_title(f"Never trained on events ({len(sub)} stations)")
    fig.suptitle("03 · Let its mistakes do the finding", fontsize=16)
    save(fig, "03_mistakes_find_events.png")


# ---------------------------------------------------------------- 04 holiday test
def slide04():
    h = pd.read_csv(os.path.join(T, "holiday_holdout.csv"), index_col=0)
    h = h.iloc[::-1]
    fig, ax = plt.subplots(figsize=(12, 6))
    colors = [GREY if "ordinary" in i else RUST for i in h.index]
    ax.barh(range(len(h)), h["called_weekend"] * 100, color=colors)
    ax.set_yticks(range(len(h)))
    ax.set_yticklabels([f"{i} (n={int(n)})" for i, n in zip(h.index, h["n"])])
    for i, v in enumerate(h["called_weekend"] * 100):
        ax.text(v + 1, i, f"{v:.0f}%", va="center", fontweight="bold")
    ax.set_xlim(0, 110)
    ax.set_xlabel('% of days the model called "weekend"')
    ax.set_title('04 · Holidays were never in training, yet most read as "weekend"')
    save(fig, "04_holiday_test.png")


# ---------------------------------------------------------------- 05 across cities
def slide05():
    m = pd.read_csv(os.path.join(T, "transfer_matrix.csv"), index_col=0) * 100
    fig, ax = plt.subplots(figsize=(11, 7))
    im = ax.imshow(m.values, cmap="Oranges", vmin=50, vmax=100)
    ax.set_xticks(range(len(m.columns)))
    ax.set_xticklabels([c.replace(" & ", " &\n").replace("North America", "North\nAmerica")
                        for c in m.columns], fontsize=11)
    ax.set_yticks(range(len(m.index)))
    ax.set_yticklabels(m.index, fontsize=11)
    for i in range(m.shape[0]):
        for j in range(m.shape[1]):
            v = m.values[i, j]
            ax.text(j, i, f"{v:.0f}%", ha="center", va="center", fontsize=13, fontweight="bold",
                    color="white" if v > 80 else INK)
    ax.set_xlabel("tested on unseen stations in ...")
    ax.set_ylabel("trained on ...")
    fig.colorbar(im, ax=ax, label="weekday vs weekend, balanced accuracy %")
    ax.set_title("05 · Does a model trained in one region work in another?")
    save(fig, "05_across_cities.png")


# ---------------------------------------------------------------- 06 subtract the people
def slide06():
    e = pd.read_csv(os.path.join(T, "noise_floor_events.csv"))
    groups = [("all stations\n(%d pairs)" % len(e), e),
              ("without Puerto Rico\n(%d pairs)" % (e.station != "AM.RCCD1").sum(),
               e[e.station != "AM.RCCD1"])]
    dets = [("raw", "fixed threshold", GREY), ("rolling", "last 2 hours", GOLD),
            ("learned", "learned normal\n(subtract the people)", RUST)]
    fig, ax = plt.subplots(figsize=(12, 6))
    w = 0.26
    for i, (d, lab, c) in enumerate(dets):
        ys = [g[f"found_{d}_p99"].sum() for _, g in groups]
        bars = ax.bar(np.arange(2) + (i - 1) * w, ys, w, color=c, label=lab)
        for b, y in zip(bars, ys):
            ax.text(b.get_x() + b.get_width() / 2, y + 10, str(int(y)), ha="center", fontweight="bold")
    ax.set_xticks(range(2))
    ax.set_xticklabels([g for g, _ in groups])
    ax.set_ylabel("catalogued earthquakes found\n(same false-alarm rate: 1% of quiet hours)")
    ax.legend(frameon=False, ncol=3, loc="upper right")
    ax.set_ylim(0, max(e["found_learned_p99"].sum(), e["found_raw_p99"].sum()) * 1.2)
    ax.set_title("06 · Subtracting the people did NOT reveal more earthquakes (pre-registered, p = 0.053)")
    save(fig, "06_subtract_people.png")


# ---------------------------------------------------------------- the loop
def loop(code="BE.UCC", days=7):
    path = os.path.join(REPO, "outputs", "clean_signal", f"{code}.csv")
    if not os.path.exists(path):
        subprocess.run([sys.executable, os.path.join(REPO, "src", "noise_floor.py"), "--export", code],
                       cwd=REPO, check=True)
    c = pd.read_csv(path, parse_dates=["time_local"])
    start = pd.Timestamp("2019-11-18")                     # a normal Monday, baseline period
    w = c[(c["time_local"] >= start) & (c["time_local"] < start + pd.Timedelta(days=days))]
    fig, (a1, a2) = plt.subplots(2, 1, figsize=(14, 7.5), sharex=True)
    a1.plot(w["time_local"], w["log10_rms"], color=INK, lw=1.2, label="01 · recorded (the 'noise')")
    a1.plot(w["time_local"], w["learned_normal"], color=RUST, lw=2, ls="--",
            label="02 · learned: what normal sounds like")
    a1.set_ylabel("log10 ground motion")
    a1.legend(frameon=False, loc="upper left", fontsize=11, ncol=2)
    a2.plot(w["time_local"], w["residual"], color=RUST, lw=1.2,
            label="03 · returned: recorded minus normal")
    a2.axhline(0, color=GREY, lw=1)
    a2.set_ylabel("difference from normal")
    a2.legend(frameon=False, loc="upper left", fontsize=11)
    sd_raw, sd_res = c["log10_rms"].std(), c["residual"].std()
    fig.suptitle(f"The loop · Brussels ({code}), one week. Over the whole record the spread drops "
                 f"{sd_raw:.3f} → {sd_res:.3f} ({(1 - sd_res / sd_raw) * 100:.0f}% removed)", fontsize=15)
    save(fig, "07_the_loop.png")


if __name__ == "__main__":
    for f in [slide01, slide02, slide03, slide04, slide05, slide06, loop]:
        f()
