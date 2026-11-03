"""
validate_route_a.py -- does MUSTANG (Route A) see the same city rhythm as Lecocq et al.?

Before trusting MUSTANG for live data, we check it against the published data on
stations and days where BOTH exist (Oct 2019 - Jun 2020). Only UNIT-FREE quantities
are compared -- the two sources are never mixed in one model (project rule):

  1. day shape  : Pearson r between the two sources' 24-hour shapes for the SAME day,
                  vs. a control: r between MUSTANG's shape and Lecocq's shape on OTHER
                  days of the same station. Every day has a day/night cycle, so the
                  control is high too; same-day r must beat it to mean anything.
  2. weekly rank: Spearman rho between the two sources' average loudness per weekday
                  (baseline days only).
  3. same model : the identical random forest, trained separately on each source's
                  features with the identical week-held-out CV, on the same days.
                  Weekday-vs-weekend balanced accuracy for each.

Outputs: outputs/tables/route_a_validation.csv, outputs/plots/route_a_<station>.png

Run:  python src/validate_route_a.py --targets BE.UCC..HHZ CN.MNTQ..HHZ
"""
import argparse, os, sys
from datetime import date

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from scipy.stats import spearmanr
from sklearn.model_selection import cross_val_predict
from sklearn.metrics import balanced_accuracy_score

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))  # repo root, for `import groundtruth`
from groundtruth.features import clean_rms, daily_features, SHAPE_COLS  # noqa: E402
from groundtruth.models import load, make_model, make_cv, FEATURES, SHORT  # noqa: E402
from groundtruth.mustang import rms_series  # noqa: E402

TABLE_S1 = os.path.join("data", "external", "2020_Science_GlobalQuieting", "Supplementary Files",
                        "Table S1 - Lockdown stations.csv")
START, END = date(2019, 10, 31), date(2020, 6, 9)   # the Lecocq data's span


def robust_level(level_raw, is_base):
    # same robust z-score as build_dataset.py, computed within THIS source only
    b = level_raw[is_base]
    mad = 1.4826 * (b - b.median()).abs().median() + 1e-9
    return ((level_raw - b.median()) / mad).clip(-10, 10)


def rowwise_r(a, b):
    a = a - a.mean(axis=1, keepdims=True)
    b = b - b.mean(axis=1, keepdims=True)
    return (a * b).sum(1) / np.sqrt((a * a).sum(1) * (b * b).sum(1))


def validate(target, lec_all, tz):
    station = ".".join(target.split(".")[:2])
    lec = lec_all[lec_all["station"] == station].set_index("date")
    s = rms_series(target, START, END)
    if len(s) < 1000:
        print(f"{target}: only {len(s)} MUSTANG spectra -- skipped")
        return None
    s.index = s.index.tz_convert(tz)
    mus = daily_features(clean_rms(s))
    common = lec.index.intersection(mus.index)
    lec, mus = lec.loc[common], mus.loc[common]
    base = (lec["period"] == "baseline").values

    # 1. same-day shape agreement vs other-day control
    A, B = mus[SHAPE_COLS].values, lec[SHAPE_COLS].values
    same = rowwise_r(A, B)
    rng = np.random.default_rng(0)
    shifts = rng.integers(7, len(B) - 7, size=50)
    other = np.array([rowwise_r(A, np.roll(B, k, axis=0)).mean() for k in shifts])
    # 1b. what is SPECIFIC to each day: subtract each source's own average shape, so the
    #     shared day/night cycle is gone. Control (other days) should now be ~0.
    Ad, Bd = A - A.mean(axis=0), B - B.mean(axis=0)
    dev_same = rowwise_r(Ad, Bd)
    dev_other = np.array([rowwise_r(Ad, np.roll(Bd, k, axis=0)).mean() for k in shifts])
    # 1c. day-to-day loudness: correlation of the daily level series (unit-free)
    level_r = np.corrcoef(mus["level_raw"], lec["level_raw"])[0, 1]

    # 2. weekly loudness ranking on baseline days
    lv_l = lec.loc[base].groupby("day_of_week")["level_raw"].mean()
    lv_m = mus.loc[base].groupby("day_of_week")["level_raw"].mean()
    rho = spearmanr(lv_l, lv_m).statistic

    # 3. same model, each source on its own, identical days and folds
    y = lec.loc[base, "is_weekend"].values
    weeks = lec.loc[base, "week"].values
    acc = {}
    for name, X in [("lecocq", lec.loc[base, FEATURES].values),
                    ("mustang", np.column_stack([mus.loc[base, SHAPE_COLS].values,
                                                 robust_level(mus["level_raw"], base)[base].values]))]:
        p = cross_val_predict(make_model(), X, y, groups=weeks, cv=make_cv())
        acc[name] = balanced_accuracy_score(y, p)

    # plot: average weekly shape, each source normalised on its own (unit-free)
    fig, axes = plt.subplots(1, 2, figsize=(12, 4))
    for name, d, ls in [("Lecocq et al. 2020", lec, "-"), ("MUSTANG (Route A)", mus, "--")]:
        prof = d.loc[base].groupby("day_of_week")[SHAPE_COLS].mean()
        for dow in [2, 5, 6]:
            axes[0].plot(range(24), prof.loc[dow].values, ls, color={2: "#3b6ea5", 5: "#c0392b", 6: "#e67e22"}[dow],
                         label=f"{SHORT[dow]} - {name}")
    axes[0].set(title=f"{station}: average day shape, both sources", xlabel="local hour",
                ylabel="log10 level minus day mean")
    axes[0].legend(fontsize=7)
    axes[1].hist(same, bins=30, color="#3b6ea5", alpha=.8, label="same day")
    axes[1].axvline(other.mean(), color="k", ls="--", label=f"other days (control) {other.mean():.2f}")
    axes[1].set(title="Day-shape correlation, MUSTANG vs Lecocq", xlabel="Pearson r", ylabel="# days")
    axes[1].legend()
    fig.tight_layout()
    fig.savefig(f"outputs/plots/route_a_{station.replace('.', '_')}.png", dpi=150)
    plt.close(fig)

    row = {"target": target, "days_both": len(common), "baseline_days": int(base.sum()),
           "shape_r_median": np.median(same), "shape_r_p10": np.percentile(same, 10),
           "control_r_mean": other.mean(),
           "deviation_r_median": np.median(dev_same), "deviation_control_r": dev_other.mean(),
           "daily_level_r": level_r, "weekly_rank_rho": rho,
           "weekend_acc_lecocq": acc["lecocq"], "weekend_acc_mustang": acc["mustang"]}
    print(f"{target:16s} days={len(common):3d}\n"
          f"   shape r       same day {row['shape_r_median']:.2f} (10th pct {row['shape_r_p10']:.2f})  vs other days {other.mean():.2f}\n"
          f"   day-specific  same day {np.median(dev_same):.2f}  vs other days {dev_other.mean():.2f}\n"
          f"   daily level r {level_r:.2f} | weekly rank rho {rho:.2f} | "
          f"weekend acc Lecocq {acc['lecocq']:.1%}  MUSTANG {acc['mustang']:.1%}")
    return row


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--targets", nargs="+", required=True, help="NET.STA.LOC.CHA as in the paper's files")
    a = ap.parse_args()
    meta = pd.read_csv(TABLE_S1, encoding="latin-1").set_index("Station_Code")
    lec = load()
    rows = [validate(t, lec, meta.loc[".".join(t.split(".")[:2]), "TimeZone"]) for t in a.targets]
    out = pd.DataFrame([r for r in rows if r])
    os.makedirs("outputs/tables", exist_ok=True)
    out.to_csv("outputs/tables/route_a_validation.csv", index=False)
    print(f"\n-> outputs/tables/route_a_validation.csv ({len(out)} stations)")


if __name__ == "__main__":
    main()
