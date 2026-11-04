"""
train_live.py -- per-station live models on 12 months of recent MUSTANG data.

For every station in config/stations.yaml with status "live" and route "mustang":
download 1 Oct 2025 - 1 Oct 2026 (cached, ~1 MB per station-month compressed), build
the daily features, score the models honestly (whole weeks held out), then fit the
final models on all normal days for the dashboard.

The 2019-20 accuracy from the published data is shown NEXT TO the new one for
context only: the two come from different sources and different years, and no model
ever sees both (project rule).

Outputs
  outputs/tables/live_models.csv      one row per station: days, coverage, accuracy
  outputs/tables/live_days.csv        every station-day: features, labels
  outputs/plots/live_week_shapes.png  average day shape per weekday, per station
  outputs/models/live/<id>.joblib     the fitted models (not committed; regenerable)

Run:  python src/train_live.py          (first run downloads ~84 station-months, ~20 min)
"""
import os
import sys

import joblib
import matplotlib
import pandas as pd

matplotlib.use("Agg")
import matplotlib.pyplot as plt

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))  # repo root, for `import groundtruth`
from groundtruth import live  # noqa: E402
from groundtruth.features import SHAPE_COLS  # noqa: E402
from groundtruth.models import SHORT  # noqa: E402
from groundtruth.stations import load_stations  # noqa: E402

PUBLISHED = os.path.join("outputs", "station_scores.csv")   # 2019-20, Lecocq data


def main():
    stations = [s for s in load_stations() if s.status == "live" and s.route == "mustang"]
    published = pd.read_csv(PUBLISHED).set_index("station")
    os.makedirs("outputs/models/live", exist_ok=True)
    rows, all_days = [], []
    for st in stations:
        print(f"{st.id:16s} {st.city:16s} downloading/reading 12 months ...", flush=True)
        d = live.station_days(st)
        if d.empty:
            print("   no data -- skipped")
            continue
        cov = live.coverage_by_month(d)
        n_base = int((d["period"] == "baseline").sum())
        scores = live.evaluate(d)
        model = live.train(st, d)
        joblib.dump(model, f"outputs/models/live/{st.id}.joblib")

        old = published.loc[st.lecocq] if st.lecocq in published.index else None
        row = {"station": st.id, "city": st.city, "country": st.country,
               "train_start": live.TRAIN_START, "train_end": live.TRAIN_END,
               "model_version": live.MODEL_VERSION,
               "days": len(d), "baseline_days": n_base,
               "holiday_days": int((d["period"] == "holiday").sum()),
               "months_under_20_days": sum(v < 20 for v in cov.values()),
               "weekend_bal_acc": scores["weekend_bal_acc"], "dow_acc": scores["dow_acc"],
               "published_weekend_bal_acc_2019_20": None if old is None else old["weekend_bal_acc"],
               "published_dow_acc_2019_20": None if old is None else old["dow_acc"]}
        rows.append(row)
        dd = d.reset_index()
        dd.insert(0, "station", st.id)
        all_days.append(dd)
        gaps = ", ".join(f"{m}:{n}" for m, n in cov.items() if n < 20) or "none"
        print(f"   days={len(d)} baseline={n_base}  weekday/weekend {scores['weekend_bal_acc']:.1%}  "
              f"exact day {scores['dow_acc']:.1%}   (months with <20 days: {gaps})", flush=True)

    out = pd.DataFrame(rows)
    out.to_csv("outputs/tables/live_models.csv", index=False)
    days = pd.concat(all_days, ignore_index=True)
    # full precision on purpose: rounding the features moved one Dublin forest split,
    # and tests/test_live.py checks the scores reproduce exactly from this file
    days.to_csv("outputs/tables/live_days.csv", index=False)
    plot(days, out)
    print(f"\n-> outputs/tables/live_models.csv ({len(out)} stations), live_days.csv ({len(days)} days), "
          "outputs/plots/live_week_shapes.png")
    print(out[["station", "city", "baseline_days", "weekend_bal_acc", "dow_acc",
               "published_weekend_bal_acc_2019_20", "published_dow_acc_2019_20"]]
          .to_string(index=False, float_format=lambda v: f"{v:.3f}"))


def plot(days, table):
    """Average normal-day shape for Wednesday, Saturday and Sunday at each station."""
    n = len(table)
    cols = 4
    fig, axes = plt.subplots((n + cols - 1) // cols, cols, figsize=(16, 4 * ((n + cols - 1) // cols)),
                             sharey=True, squeeze=False)
    colors = {2: "#3b6ea5", 4: "#8e44ad", 5: "#c0392b", 6: "#e67e22"}
    for ax, (_, r) in zip(axes.flat, table.iterrows()):
        g = days[(days["station"] == r["station"]) & (days["period"] == "baseline")]
        prof = g.groupby("day_of_week")[SHAPE_COLS].mean()
        for dow, c in colors.items():
            if dow in prof.index:
                ax.plot(range(24), prof.loc[dow].values, color=c, lw=2, label=SHORT[dow])
        ax.set_title(f"{r['city']}  ({r['weekend_bal_acc']:.0%} weekday/weekend)", fontsize=12)
        ax.set_xticks([0, 6, 12, 18, 23])
        ax.set_xlabel("local hour")
        ax.grid(alpha=.3)
    for ax in list(axes.flat)[n:]:
        ax.axis("off")
    axes[0, 0].set_ylabel("log10 level minus day mean")
    axes[0, 0].legend(fontsize=10)
    fig.suptitle("Live models: average normal day, Oct 2025 - Sep 2026 (MUSTANG)", fontsize=14)
    fig.tight_layout()
    fig.savefig("outputs/plots/live_week_shapes.png", dpi=150)
    plt.close(fig)


if __name__ == "__main__":
    main()
