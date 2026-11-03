"""
train_stations.py -- one model PER seismometer, trained only on "normal life" days.

Evaluation is deliberately strict: 5-fold cross-validation where whole calendar
WEEKS are held out together (GroupKFold by week). The model never sees any day
from the week it is tested on, so it can't cheat by memorising "that noisy
Tuesday was next to that noisy Wednesday".

Metrics:
  weekday-vs-weekend: BALANCED accuracy (weekends are only 2/7 of days, so plain
                      accuracy would reward always guessing "weekday"; chance = 50%)
  day-of-week       : plain accuracy over 7 classes (chance = 14.3%)

Outputs: outputs/station_scores.csv, outputs/plots/accuracy_by_station.png

Run:  python src/train_stations.py
"""
import os, sys
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.model_selection import GroupKFold, cross_val_predict
from sklearn.metrics import balanced_accuracy_score, accuracy_score

sys.path.insert(0, os.path.dirname(__file__))
from common import load, make_model, FEATURES  # noqa: E402


def main():
    df = load()
    base = df[df["period"] == "baseline"]
    rows = []
    for st, g in base.groupby("station"):
        if len(g) < 70:
            continue
        X, groups = g[FEATURES].values, g["week"].values
        cv = GroupKFold(5)
        p2 = cross_val_predict(make_model(), X, g["is_weekend"].values, groups=groups, cv=cv)
        p7 = cross_val_predict(make_model(), X, g["day_of_week"].values, groups=groups, cv=cv)
        rows.append({
            "station": st, "city": g["city"].iloc[0], "country": g["country"].iloc[0],
            "pop_density": g["pop_density"].iloc[0], "n_days": len(g),
            "weekend_bal_acc": balanced_accuracy_score(g["is_weekend"], p2),
            "dow_acc": accuracy_score(g["day_of_week"], p7),
        })
        print(f"{st:10s} {str(rows[-1]['city'])[:18]:18s} weekend={rows[-1]['weekend_bal_acc']:.2f} dow={rows[-1]['dow_acc']:.2f}")
    r = pd.DataFrame(rows).sort_values("weekend_bal_acc", ascending=False)
    os.makedirs("outputs/plots", exist_ok=True)
    r.to_csv("outputs/station_scores.csv", index=False)

    fig, axes = plt.subplots(1, 2, figsize=(11, 4))
    axes[0].hist(r["weekend_bal_acc"], bins=20, color="#3b6ea5")
    axes[0].axvline(0.5, color="k", ls="--", label="chance (50%)")
    axes[0].set(title="Weekday vs weekend", xlabel="balanced accuracy", ylabel="# stations")
    axes[0].legend()
    axes[1].hist(r["dow_acc"], bins=20, color="#c0703a")
    axes[1].axvline(1 / 7, color="k", ls="--", label="chance (14%)")
    axes[1].set(title="Exact day of week", xlabel="accuracy")
    axes[1].legend()
    fig.suptitle(f"Real seismometers, {len(r)} stations worldwide (week-held-out cross-validation)")
    fig.tight_layout()
    fig.savefig("outputs/plots/accuracy_by_station.png", dpi=150)

    print("\n=== Summary across stations ===")
    print(f"Stations evaluated: {len(r)}")
    print(f"Weekday/weekend balanced accuracy: median {r['weekend_bal_acc'].median():.1%}, "
          f"{(r['weekend_bal_acc'] >= 0.9).mean():.0%} of stations >= 90%")
    print(f"Day-of-week accuracy: median {r['dow_acc'].median():.1%} (chance 14.3%), best {r['dow_acc'].max():.1%}")
    print("\nTop 10:\n" + r.head(10)[["station", "city", "weekend_bal_acc", "dow_acc"]].to_string(index=False))
    control_and_density(r)


def control_and_density(r):
    """The sanity checks: (1) the worst stations should be places with few people,
    sitting near chance; (2) accuracy should rise with population density.
    `r` is the per-station table (same as outputs/station_scores.csv)."""
    from scipy.stats import spearmanr
    print("\nBottom 5 (the control group should sit near chance):\n"
          + r.sort_values("weekend_bal_acc").head(5)[["station", "city", "country", "weekend_bal_acc", "dow_acc"]].to_string(index=False))
    d = r.dropna(subset=["pop_density"]).copy()
    d["density_third"] = pd.qcut(d["pop_density"].rank(method="first"), 3, labels=["least dense", "middle", "densest"])
    print("\nMedian weekday/weekend balanced accuracy by population-density third:")
    print(d.groupby("density_third", observed=True)["weekend_bal_acc"].median().map(lambda v: f"{v:.1%}").to_string())
    rho, p = spearmanr(d["pop_density"], d["weekend_bal_acc"])
    print(f"Spearman rho (density vs weekday/weekend accuracy) = {rho:.2f}, p = {p:.2g}, n = {len(d)}")


if __name__ == "__main__":
    main()
