"""
shape_vs_level.py -- Promise 2: is the day's SHAPE informative beyond its LOUDNESS?

The field (e.g. Lecocq et al. 2020) mostly measures how LOUD the ground is. Our claim is
that the 24-hour SHAPE of a day carries extra information about human routine. Test it
fairly: four feature sets, two model families, identical week-held-out folds per station.

  level  : 1 feature  -- how loud the day was (robust z-score within the station)
  shape  : 24 features -- hourly log-RMS minus the day's mean (loudness removed)
  both   : 25 features -- shape + level (what the project uses)
  raw    : 24 features -- hourly log-RMS WITHOUT removing the day's mean. Same
           information as `both`, just not split into shape + level. Tests whether the
           decomposition itself helps.

Models: random forest (make_model) and logistic regression (make_linear, standardised).
Tasks: weekday-vs-weekend (balanced accuracy) and exact day of week (accuracy).

Outputs: outputs/tables/shape_vs_level.csv (per station), outputs/tables/shape_vs_level_summary.csv,
         outputs/plots/shape_vs_level.png

Run:  python src/shape_vs_level.py      (~10 min; uses all CPU cores)
"""
import os, sys
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from joblib import Parallel, delayed
from scipy.stats import wilcoxon
from sklearn.model_selection import cross_val_predict
from sklearn.metrics import balanced_accuracy_score, accuracy_score

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))  # repo root, for `import groundtruth`
from groundtruth.models import load, make_model, make_linear, make_cv, SHAPE_COLS  # noqa: E402

SETS = ["level", "shape", "both", "raw"]
MODELS = {"rf": make_model, "logreg": make_linear}


def feature_matrix(g, name):
    if name == "level":
        return g[["level"]].values
    if name == "shape":
        return g[SHAPE_COLS].values
    if name == "both":
        return g[SHAPE_COLS + ["level"]].values
    # raw hourly log10 RMS = shape + the day's mean (level_raw); see groundtruth/features.py
    return g[SHAPE_COLS].values + g[["level_raw"]].values


def score_station(st, g):
    row = {"station": st, "city": g["city"].iloc[0], "n_days": len(g)}
    groups = g["week"].values
    for mname, make in MODELS.items():
        for fs in SETS:
            X = feature_matrix(g, fs)
            p2 = cross_val_predict(make(), X, g["is_weekend"].values, groups=groups, cv=make_cv())
            p7 = cross_val_predict(make(), X, g["day_of_week"].values, groups=groups, cv=make_cv())
            row[f"{mname}_{fs}_weekend"] = balanced_accuracy_score(g["is_weekend"], p2)
            row[f"{mname}_{fs}_dow"] = accuracy_score(g["day_of_week"], p7)
    return row


def summarise(r):
    rows = []
    for m in MODELS:
        for task in ["weekend", "dow"]:
            for fs in SETS:
                v = r[f"{m}_{fs}_{task}"]
                rows.append({"model": m, "task": task, "features": fs, "median": v.median(),
                             "q25": v.quantile(.25), "q75": v.quantile(.75)})
    return pd.DataFrame(rows)


def paired(r, m, task, a, b):
    """Paired comparison across stations: b minus a."""
    x, y = r[f"{m}_{a}_{task}"], r[f"{m}_{b}_{task}"]
    d = y - x
    stat, p = wilcoxon(y, x, zero_method="wilcox")   # drops exact ties
    return {"model": m, "task": task, "comparison": f"{b} - {a}", "median_diff_pp": 100 * d.median(),
            "stations_gain_gt_2pp": int((d > .02).sum()), "stations_loss_gt_2pp": int((d < -.02).sum()),
            "n": len(d), "wilcoxon_p": p}


def main():
    df = load()
    base = df[df["period"] == "baseline"]
    groups = [(st, g) for st, g in base.groupby("station") if len(g) >= 70]
    rows = Parallel(n_jobs=-1)(delayed(score_station)(st, g) for st, g in groups)
    r = pd.DataFrame(rows)
    os.makedirs("outputs/tables", exist_ok=True)
    os.makedirs("outputs/plots", exist_ok=True)
    r.to_csv("outputs/tables/shape_vs_level.csv", index=False)
    s = summarise(r)
    s.to_csv("outputs/tables/shape_vs_level_summary.csv", index=False)
    tests = pd.DataFrame([paired(r, m, t, a, b) for m in MODELS for t in ["weekend", "dow"]
                          for a, b in [("level", "both"), ("level", "shape"), ("raw", "both"), ("shape", "both")]])
    tests.to_csv("outputs/tables/shape_vs_level_tests.csv", index=False)

    print(f"{len(r)} stations, identical week-held-out folds for every feature set\n")
    piv = s.assign(cell=lambda x: x.apply(lambda q: f"{q['median']:.1%} [{q['q25']:.1%}-{q['q75']:.1%}]", axis=1))
    print(piv.pivot_table(index=["model", "task"], columns="features", values="cell", aggfunc="first")[SETS].to_string())
    print("\nPaired across stations (Wilcoxon signed-rank):")
    print(tests.to_string(index=False, formatters={"median_diff_pp": "{:+.1f}".format, "wilcoxon_p": "{:.2g}".format}))

    # paired-dot plot: level only vs both, per station (random forest)
    fig, axes = plt.subplots(1, 2, figsize=(12, 5.5))
    for ax, task, title, chance in [(axes[0], "weekend", "Weekday vs weekend (balanced acc.)", .5),
                                    (axes[1], "dow", "Exact day of week (accuracy)", 1 / 7)]:
        a, b = r[f"rf_level_{task}"] * 100, r[f"rf_both_{task}"] * 100
        for x0, x1 in zip(a, b):
            ax.plot([0, 1], [x0, x1], color="#3b6ea5" if x1 > x0 else "#c0703a", alpha=.35, lw=1)
        ax.scatter(np.zeros(len(a)), a, s=10, color="k", zorder=3)
        ax.scatter(np.ones(len(b)), b, s=10, color="k", zorder=3)
        ax.plot([0, 1], [a.median(), b.median()], color="k", lw=3, label="median")
        ax.axhline(chance * 100, color="grey", ls="--", label=f"chance ({chance:.0%})")
        ax.set_xticks([0, 1], ["loudness only\n(1 number)", "shape + loudness\n(25 numbers)"])
        ax.set(title=title, ylabel="% correct", xlim=(-.3, 1.3))
        ax.legend(loc="lower right")
    fig.suptitle(f"Does the 24-hour SHAPE add information beyond loudness?  {len(r)} stations, random forest\n"
                 "blue line = shape helps this station, orange = it hurts")
    fig.tight_layout()
    fig.savefig("outputs/plots/shape_vs_level.png", dpi=150)
    plt.close(fig)


if __name__ == "__main__":
    main()
