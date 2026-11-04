"""
band_test.py -- which frequencies carry the human weekly rhythm?

Lecocq et al. (2020) used 4-14 Hz as the "human" band. Their published files only
contain that band, but MUSTANG spectra contain every frequency, so on the 7 live
stations (1 Oct 2025 - 30 Sep 2026, already cached) we can ask the question directly.

For each band, the SAME pipeline: displacement RMS per spectrum -> 25 daily features
-> the same random forest -> week-held-out balanced accuracy (weekday vs weekend) and
exact-day accuracy. Every band is scored on the SAME days at each station, so the
comparison is fair.

Bands
  0.1-1 Hz    ocean microseism (waves on coastlines): a NATURAL CONTROL. Expected to
              show no weekly rhythm; if it did, the method would be finding something
              other than people.
  1-4 Hz      low end of cultural noise
  4-14 Hz     the paper's human band
  14-19.7 Hz  high end (19.7 Hz is the top bin at the 40-sample/s stations)
  1-19.7 Hz   everything above the microseism

Outputs: outputs/tables/band_test.csv, outputs/plots/band_test.png
Run:     python src/band_test.py          (uses the MUSTANG cache; ~2 min)
"""
import os
import sys

import matplotlib
import numpy as np
import pandas as pd

matplotlib.use("Agg")
import matplotlib.pyplot as plt

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))  # repo root, for `import groundtruth`
from groundtruth import live  # noqa: E402
from groundtruth.features import clean_rms, daily_features  # noqa: E402
from groundtruth.mustang import _month_starts, band_rms, fetch_month, parse  # noqa: E402
from groundtruth.stations import load_stations  # noqa: E402

BANDS = {"0.1-1 Hz": (0.1, 1.0), "1-4 Hz": (1.0, 4.0), "4-14 Hz": (4.0, 14.0),
         "14-19.7 Hz": (14.0, 19.75), "1-19.7 Hz": (1.0, 19.75)}


def band_series(station_id):
    """{band: RMS series} for the training window, parsing each month only once."""
    parts = {b: [] for b in BANDS}
    for a, b in _month_starts(live.TRAIN_START, live.TRAIN_END):
        psd = parse(fetch_month(station_id, a, b))
        for name, rng in BANDS.items():
            s = band_rms(psd, rng)
            if len(s):
                parts[name].append(s)
        del psd
    return {k: pd.concat(v).sort_index() for k, v in parts.items() if v}


def main():
    stations = [s for s in load_stations() if s.status == "live" and s.route == "mustang"]
    rows = []
    for st in stations:
        series = band_series(st.id)
        days = {}
        for name, s in series.items():
            s = s[~s.index.duplicated()]
            s.index = s.index.tz_convert(st.timezone)
            d = live.label_days(daily_features(clean_rms(s)), st.country)
            d = d[(d.index >= pd.Timestamp(live.TRAIN_START)) & (d.index < pd.Timestamp(live.TRAIN_END))]
            d["level"] = live.robust_scale(d["level_raw"], d.loc[d["period"] == "baseline", "level_raw"])
            days[name] = d
        common = sorted(set.intersection(*(set(d.index) for d in days.values())))
        line = f"{st.city:16s}"
        for name, d in days.items():
            sc = live.evaluate(d.loc[common])
            rows.append({"station": st.id, "city": st.city, "band": name, "days": len(common),
                         "weekend_bal_acc": sc["weekend_bal_acc"], "dow_acc": sc["dow_acc"]})
            line += f"  {name} {sc['weekend_bal_acc']:.0%}/{sc['dow_acc']:.0%}"
        print(line, flush=True)

    out = pd.DataFrame(rows)
    out.to_csv("outputs/tables/band_test.csv", index=False)
    piv = out.pivot(index="city", columns="band", values="weekend_bal_acc")[list(BANDS)]
    print("\nWeekday vs weekend, balanced accuracy (chance 50%):")
    print(piv.to_string(float_format=lambda v: f"{v:.1%}"))
    print("\nMedian across stations:")
    print(out.groupby("band")[["weekend_bal_acc", "dow_acc"]].median().loc[list(BANDS)]
          .to_string(float_format=lambda v: f"{v:.1%}"))
    plot(out)


def plot(out):
    fig, axes = plt.subplots(1, 2, figsize=(13, 4.8), sharex=True)
    x = np.arange(len(BANDS))
    for ax, col, chance, title in [(axes[0], "weekend_bal_acc", .5, "Weekday vs weekend"),
                                   (axes[1], "dow_acc", 1 / 7, "Exact day of the week")]:
        for city, g in out.groupby("city"):
            g = g.set_index("band").loc[list(BANDS)]
            ax.plot(x, g[col] * 100, "-o", color="#9a998f", lw=1, ms=4, alpha=.8)
        med = out.groupby("band")[col].median().loc[list(BANDS)]
        ax.plot(x, med * 100, "-o", color="#2a78d6", lw=3, ms=8, label="median of 7 stations")
        ax.axhline(chance * 100, color="#d03b3b", ls="--", lw=1.5, label="chance")
        ax.set_xticks(x, list(BANDS))
        ax.set_ylabel("accuracy (%)")
        ax.set_title(title, fontsize=13)
        ax.grid(alpha=.3)
        ax.legend(fontsize=10, loc="upper left", ncol=2)
    axes[0].set_ylim(40, 110)          # headroom above the data so the legend covers nothing
    axes[1].set_ylim(5, 88)
    axes[0].annotate("ocean waves: no weekly rhythm", (0, out[out.band == "0.1-1 Hz"].weekend_bal_acc.median() * 100),
                     xytext=(1.3, 55), fontsize=10, arrowprops={"arrowstyle": "->"})
    dub = out[(out.city == "Dublin") & (out.band == "1-4 Hz")].weekend_bal_acc
    if len(dub):
        axes[0].annotate("Dublin", (1, dub.iloc[0] * 100), xytext=(1.08, 45), fontsize=10)
    fig.suptitle("Which frequencies carry the human weekly rhythm? 7 stations, Oct 2025 - Sep 2026 (MUSTANG)",
                 fontsize=13)
    fig.tight_layout()
    fig.savefig("outputs/plots/band_test.png", dpi=150)
    plt.close(fig)
    print("-> outputs/tables/band_test.csv, outputs/plots/band_test.png")


if __name__ == "__main__":
    main()
