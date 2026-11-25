"""
plot_learning_curve.py -- "does more data help?" as one picture, for the talk.

Draws Result 18 (more days per station, src/more_data_experiment.py) next to Result 17
Part B (the week around the day, src/weekday_experiment.py). No new numbers: it only reads
their saved tables, so run those scripts first.

  outputs/tables/more_data_L.csv     exact-day accuracy per station, 100 ... all training days
  outputs/tables/weekday_partB.csv   B0 = one day on the same folds, B = the week around it
Output: outputs/plots/learning_curve.png
Run:    python src/plot_learning_curve.py
"""
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

L = os.path.join("outputs", "tables", "more_data_L.csv")
B = os.path.join("outputs", "tables", "weekday_partB.csv")
PLOT = os.path.join("outputs", "plots", "learning_curve.png")
ORDER = ["n=100", "n=200", "n=400", "n=800", "n=1600", "n=all"]


def main():
    curve = pd.read_csv(L).groupby("config")["exact"].median().reindex(ORDER) * 100
    week = pd.read_csv(B).groupby("config")["exact"].median() * 100
    print("median exact-day accuracy by training days:", curve.round(1).to_dict())
    print("week around the day (B):", round(week["B"], 1), " one day, same folds (B0):", round(week["B0"], 1))

    fig, ax = plt.subplots(figsize=(12, 6.5))
    x = list(range(len(ORDER)))
    ax.plot(x, curve.values, "-o", color="#555", lw=3, ms=10, label="one day, more training days")
    for xi, v in zip(x, curve.values):
        ax.text(xi, v + 2.5, f"{v:.0f}%", ha="center", fontsize=14, color="#333")
    xb = len(ORDER) + 0.9
    ax.bar([xb], [week["B"]], width=0.8, color="#d2691e", label="the week around the day")
    ax.text(xb, week["B"] + 2.5, f"{week['B']:.0f}%", ha="center", fontsize=16, color="#d2691e", weight="bold")
    ax.axhline(100 / 7, color="#999", ls=":", lw=1.5)
    ax.text(-0.3, 100 / 7 + 1.5, "guessing: 14%", fontsize=12, color="#777")
    ax.set_xticks(x + [xb], ["100", "200", "400", "800", "1,600", "all\n(7 years)", "all, +\n3 days each side"],
                  fontsize=13)
    ax.set_xlabel("Ordinary days each city's model learned from", fontsize=14)
    ax.set_ylabel("Exact weekday named (median of 33 cities, %)", fontsize=13)
    ax.set_ylim(0, 105)
    ax.set_title("More days help, then flatten. More context is what works.", fontsize=18, loc="left")
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    ax.legend(fontsize=13, frameon=False, loc="upper left")
    fig.text(0.01, 0.005, "33 stations, MUSTANG Jan 2019 - Sep 2026; every score on weeks the model never saw. "
             "Results 17-18, docs/04. src/plot_learning_curve.py", fontsize=9, color="#777")
    fig.tight_layout(rect=(0, 0.02, 1, 1))
    fig.savefig(PLOT, dpi=150)
    print("wrote", PLOT)


if __name__ == "__main__":
    main()
