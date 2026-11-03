"""
showcase_city.py -- deep dive on ONE seismometer, for presentation slides.

Default: AM.R7885, a Raspberry Shake citizen seismometer in New York City.
Try others from outputs/station_scores.csv, e.g. --station HL.ATH (Athens),
--station BE.UCC (Brussels, the lead author's own station), --station FR.CURIE (Paris).

Makes:
  outputs/plots/<station>_weekly_rhythm.png   average hourly vibration per weekday
  outputs/plots/<station>_confusion.png        7-day confusion matrix (week-held-out CV)
  outputs/plots/<station>_hour_importance.png  which local hours the model relies on
  outputs/models/<station>_dow.joblib          model trained on all normal days

Run:  python src/showcase_city.py --station AM.R7885
"""
import argparse, os, sys
import numpy as np
import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.model_selection import cross_val_predict
from sklearn.metrics import confusion_matrix, accuracy_score, balanced_accuracy_score

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))  # repo root, for `import groundtruth`
from groundtruth.models import load, make_model, FEATURES, SHAPE_COLS, SHORT, make_cv  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--station", default="AM.R7885")
    a = ap.parse_args()
    df = load()
    g = df[(df["station"] == a.station) & (df["period"] == "baseline")]
    if g.empty:
        sys.exit(f"No baseline days for {a.station}")
    city = g["city"].iloc[0]
    os.makedirs("outputs/plots", exist_ok=True); os.makedirs("outputs/models", exist_ok=True)
    tag = a.station.replace(".", "_")

    # 1. rhythm plot (absolute log level = shape + daily mean, back in real units)
    prof = g[SHAPE_COLS].values + g[["level_raw"]].values
    ref = np.median(prof)  # express everything relative to the station's typical hour
    fig, ax = plt.subplots(figsize=(10, 5))
    colors = plt.cm.viridis(np.linspace(0, 0.85, 5)).tolist() + ["#d62728", "#ff7f0e"]
    for d in range(7):
        m = g["day_of_week"].values == d
        ax.plot(range(24), 10 ** (np.median(prof[m], axis=0) - ref), label=SHORT[d], color=colors[d],
                lw=2.5 if d >= 5 else 1.5)
    ax.set(xlabel="Local hour of day", ylabel="Ground vibration, 4-14 Hz\n(x typical level at this station)",
           title=f"{city} ({a.station}): the city's weekly rhythm in ground vibration\n"
                 f"{len(g)} normal days, Nov 2019 - Mar 2020 (data: Lecocq et al. 2020, Science)")
    ax.set_xticks(range(0, 24, 2)); ax.grid(alpha=.3); ax.legend(ncol=7)
    fig.tight_layout(); fig.savefig(f"outputs/plots/{tag}_weekly_rhythm.png", dpi=150); plt.close(fig)

    # 2. honest evaluation
    X, y, w = g[FEATURES].values, g["day_of_week"].values, g["week"].values
    p = cross_val_predict(make_model(), X, y, groups=w, cv=make_cv())
    p2 = cross_val_predict(make_model(), X, g["is_weekend"].values, groups=w, cv=make_cv())
    acc, bacc = accuracy_score(y, p), balanced_accuracy_score(g["is_weekend"], p2)
    cm = confusion_matrix(y, p, labels=range(7))
    fig, ax = plt.subplots(figsize=(6.5, 5.5))
    ax.imshow(cm, cmap="Blues")
    for i in range(7):
        for j in range(7):
            ax.text(j, i, cm[i, j], ha="center", va="center", color="white" if cm[i, j] > cm.max() / 2 else "black")
    ax.set(xticks=range(7), yticks=range(7), xticklabels=SHORT, yticklabels=SHORT, xlabel="Predicted", ylabel="Actual",
           title=f"{city}: day-of-week from vibration\naccuracy {acc:.0%} (chance 14%)")
    fig.tight_layout(); fig.savefig(f"outputs/plots/{tag}_confusion.png", dpi=150); plt.close(fig)

    # 3. final model + importances
    model = make_model().fit(X, y)
    joblib.dump(model, f"outputs/models/{tag}_dow.joblib")
    imp = model.feature_importances_
    fig, ax = plt.subplots(figsize=(10, 3.8))
    ax.bar(range(24), imp[:24], color="#3b6ea5", label="hour-of-day shape")
    ax.bar(24.5, imp[24], color="#c0703a", label="overall loudness")
    ax.set(xticks=list(range(0, 24, 2)) + [24.5], xticklabels=[str(h) for h in range(0, 24, 2)] + ["level"],
           xlabel="Local hour", ylabel="importance", title=f"{city}: what the model looks at")
    ax.legend(); fig.tight_layout(); fig.savefig(f"outputs/plots/{tag}_hour_importance.png", dpi=150); plt.close(fig)

    print(f"{a.station} {city}: day-of-week accuracy {acc:.1%}, weekday/weekend balanced accuracy {bacc:.1%}, {len(g)} days")


if __name__ == "__main__":
    main()
