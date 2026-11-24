"""
memorisation.py -- how much better does the model do on days it trained on? (Result 20,
EXPLORATORY: written after Results 16-18, nothing here was pre-registered.)

The question a newcomer asks: "the model is trained on 7 years of 33 cities; if it can only
name 56% of days, can it even name the days it was trained on?" This answers it with the
exact models behind "Ask the ground" (Result 16/17: 3 bands x 48 half-hours, gradient
boosting, 5 folds of whole weeks). For every fold model we score:

  * the days it TRAINED on   (in-sample: the model has seen the answer)
  * the weeks it NEVER saw   (out-of-fold: what every reported number in this project uses)

Same models, same days, same features: the gap is memorisation. A big gap is why we never
grade a model on days it saw.

Reads the day tables cached by src/weekday_experiment.py (data/cache/weekday/), like
src/ask.py. Runs in a few minutes.

Outputs
  outputs/tables/memorisation.csv    per station: exact-day accuracy, seen vs unseen days
  outputs/plots/memorisation.png     the two numbers for every station
Run:  python src/memorisation.py
"""
import os
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))  # repo root
sys.path.insert(0, os.path.dirname(__file__))                      # src/
from ask import DAY_FEATURES, DAY_MODEL, station_days  # noqa: E402
from groundtruth.models import make_cv  # noqa: E402
from groundtruth.models import week_id  # noqa: E402
from groundtruth.places import display_name  # noqa: E402
from history import roster  # noqa: E402

TABLE = os.path.join("outputs", "tables", "memorisation.csv")
PLOT = os.path.join("outputs", "plots", "memorisation.png")


def seen_vs_unseen(d):
    """Exact-day accuracy of each fold model on its own training days and on its test weeks.

    Only ordinary (baseline) days, the days every reported accuracy uses. Folds are the same
    GroupKFold by week as groundtruth.ask.oof, so 'unseen' here equals Ask's number."""
    d = d.dropna(subset=DAY_FEATURES)
    base = d[d["period"] == "baseline"]
    X, y = base[DAY_FEATURES].values, base["day_of_week"].values
    groups = week_id(base.index)
    right_seen = n_seen = right_unseen = n_unseen = 0
    for train, test in make_cv().split(X, y, groups=groups):
        model = DAY_MODEL().fit(X[train], y[train])
        right_seen += int((model.predict(X[train]) == y[train]).sum())   # days it saw
        n_seen += len(train)
        right_unseen += int((model.predict(X[test]) == y[test]).sum())  # weeks it never saw
        n_unseen += len(test)
    return right_seen / n_seen, right_unseen / n_unseen, len(base)


def main():
    rows = []
    for _, r in roster().iterrows():
        d = station_days(r)
        if d.empty:
            continue
        seen, unseen, n = seen_vs_unseen(d)
        city = display_name(r["station"], r["city"])
        rows.append({"station": r["id"], "city": city, "ordinary_days": n,
                     "exact_day_seen": seen, "exact_day_unseen": unseen, "gap": seen - unseen})
        print(f"{city:32s} days {n:5d}  seen {seen:.3f}  never seen {unseen:.3f}", flush=True)

    t = pd.DataFrame(rows).sort_values("exact_day_unseen")
    t.to_csv(TABLE, index=False, float_format="%.4f")
    print(f"\n{len(t)} stations. Median exact-day accuracy: days it trained on "
          f"{t['exact_day_seen'].median():.3f}, weeks it never saw {t['exact_day_unseen'].median():.3f} "
          f"(chance 0.143). Median gap {t['gap'].median():.3f}.")

    # one row per station: a grey dot (never seen) joined to an orange dot (seen)
    fig, ax = plt.subplots(figsize=(11, 9))
    yy = np.arange(len(t))
    ax.hlines(yy, t["exact_day_unseen"] * 100, t["exact_day_seen"] * 100, color="#bbb", lw=2)
    ax.scatter(t["exact_day_unseen"] * 100, yy, s=60, color="#555", label="weeks it never saw", zorder=3)
    ax.scatter(t["exact_day_seen"] * 100, yy, s=60, color="#d2691e", label="days it trained on", zorder=3)
    ax.axvline(100 / 7, color="#999", ls=":", lw=1.5)
    ax.text(100 / 7 + 0.8, len(t) - 0.5, "guessing\n14%", fontsize=12, color="#777", va="top")
    ax.set_yticks(yy, t["city"], fontsize=11)
    ax.set_xlim(0, 102)
    ax.set_xlabel("Exact weekday named correctly (%)", fontsize=14)
    ax.set_title(f"Same models, same 7 years: median {t['exact_day_seen'].median():.0%} on days it "
                 f"trained on,\n{t['exact_day_unseen'].median():.0%} on weeks it never saw",
                 fontsize=16, loc="left")
    ax.legend(fontsize=13, loc="lower right", frameon=False)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    fig.text(0.01, 0.005, "33 stations, Jan 2019 - Sep 2026, MUSTANG. Ordinary days only. "
             "Exploratory (Result 20). src/memorisation.py", fontsize=9, color="#777")
    fig.tight_layout(rect=(0, 0.02, 1, 1))
    fig.savefig(PLOT, dpi=150)
    print(f"wrote {TABLE} and {PLOT}")


if __name__ == "__main__":
    main()
