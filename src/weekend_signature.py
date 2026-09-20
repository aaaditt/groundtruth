"""
weekend_signature.py — cross-country weekend signature from ambient seismic noise.

Tests whether the learned weekly rhythm is *human* rather than an arbitrary 7-day
periodicity, by checking whether the seismic weekend shifts in countries that rest
on different days.

Method
------
For every station with enough usable data:
  1. Keep only PRE-lockdown days (that station's documented lockdown start date from
     Table S1), so the profile describes normal behaviour.
  2. Convert UTC timestamps to the station's local time using the paper's TimeZone column.
  3. Take the median 4-14 Hz RMS displacement per day.
  4. Take the median across days for each day-of-week, then normalise to that
     station's busiest day.
  5. Score every adjacent 2-day pair; the quietest pair is the "inferred weekend".

Result (142 stations, >=40 pre-lockdown days each)
--------------------------------------------------
  Quietest day       : Sunday 122, Saturday 8, Friday 5, other 7
  Inferred weekend   : Sat-Sun 124, Fri-Sat 5, other 13
  Fri-Sat stations   : Salfit (PS), Amatzia (IL), Jeddah (SA), Nilore (PK), Myagdi (NP)
  Median Sunday level: 0.977 (IL/PS/SA, n=3) vs 0.671 (all others, n=139)
  Mann-Whitney U     : p = 0.0032, one-sided

Known limitations
-----------------
  * n = 3 for the Fri-Sat group. Direction and effect size are the claim; the
    p-value rests on three stations.
  * Nepal (Myagdi) is a metric artifact. Nepal's weekly holiday is Saturday alone;
    because Friday happens to sit below Sunday there, the adjacent-pair metric
    labels it Fri-Sat. The other two Nepal stations correctly return Saturday.
  * Pakistan (Nilore) is a genuine middle case: the official weekend is Sunday,
    but Friday shows a dip, plausibly the Friday prayer break.
  * Station count here (142) is stricter than the project's headline 158, because
    this script uses pre-lockdown days only and requires >=40 days.

Data
----
  Lecocq et al. (2020), Science 369(6509), companion repository:
  https://github.com/ThomasLecocq/2020_Science_GlobalQuieting
    PaperZero_RMS/*.csv
    Supplementary Files/Table S1 - Lockdown stations.csv   (latin-1 encoded)

Usage
-----
  python src/weekend_signature.py
  python src/weekend_signature.py --data-root data/external/2020_Science_GlobalQuieting
"""

from __future__ import annotations

import argparse
import os
import warnings
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats

warnings.filterwarnings("ignore")

BAND = "4.0-14.0"
DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
MIN_SAMPLES_RAW = 2000  # minimum 15-min RMS rows BEFORE trimming to pre-lockdown
MIN_SAMPLES = 1500      # minimum rows remaining AFTER the trim
MIN_DAYS = 40           # minimum pre-lockdown days per station

PAIRS = {
    "Mon-Tue": ("Mon", "Tue"), "Tue-Wed": ("Tue", "Wed"), "Wed-Thu": ("Wed", "Thu"),
    "Thu-Fri": ("Thu", "Fri"), "Fri-Sat": ("Fri", "Sat"), "Sat-Sun": ("Sat", "Sun"),
    "Sun-Mon": ("Sun", "Mon"),
}

# Countries whose official weekend is Friday-Saturday, with Sunday a working day.
FRI_SAT_COUNTRIES = ["Saudi Arabia", "Israel", "State of Palestine"]

# Cities drawn on the figure: (country, city or None for first match, colour)
FIGURE_CITIES = [
    ("State of Palestine", "Salfit", "#d62728"),
    ("Israel", "Station Amatzia", "#ff7f0e"),
    ("Saudi Arabia", "Jeddah", "#2ca02c"),
    ("India", "Port Blair", "#1f77b4"),
    ("Belgium", None, "#9467bd"),
]


def load_metadata(data_root: Path) -> pd.DataFrame:
    """Table S1 is latin-1 encoded, not UTF-8."""
    path = data_root / "Supplementary Files" / "Table S1 - Lockdown stations.csv"
    return pd.read_csv(path, encoding="latin-1")


def lockdown_timestamp(raw, tz):
    """Table S1 dates are dd/mm/yyyy.

    dayfirst=True is mandatory, not a fallback. Pandas' default parse reads
    "08/03/2020" as 3 August 2020 rather than 8 March 2020 -- months after the
    recordings end -- which silently disables the pre-lockdown trim for every
    date whose day and month are both <= 12.
    """
    if pd.isna(raw):
        return pd.NaT
    try:
        return pd.to_datetime(raw, dayfirst=True).tz_localize(tz)
    except Exception:
        return pd.NaT


def load_station(csv_path: Path, tz: str, lockdown) -> pd.Series | None:
    df = pd.read_csv(csv_path, index_col=0, parse_dates=True)
    if BAND not in df.columns:
        return None
    s = df[BAND].dropna()
    if len(s) < MIN_SAMPLES_RAW:
        return None
    s.index = s.index.tz_localize("UTC").tz_convert(tz)
    if pd.notna(lockdown):
        s = s[s.index < lockdown]          # normal behaviour only
    return s


def weekly_profile(s: pd.Series):
    """Median per day, then median per day-of-week. Returns (profile, n_days)."""
    d = pd.DataFrame({"v": s.values}, index=s.index)
    d["dow"] = d.index.dayofweek           # 0 = Monday
    d["date"] = d.index.date
    daily = d.groupby(["date", "dow"])["v"].median().reset_index()
    return daily.groupby("dow")["v"].median(), len(daily)


def infer_weekend(row) -> str:
    scores = {k: (row[a] + row[b]) / 2 for k, (a, b) in PAIRS.items()}
    return min(scores, key=scores.get)


def build_profiles(data_root: Path) -> pd.DataFrame:
    meta = load_metadata(data_root)
    rms_dir = data_root / "PaperZero_RMS"
    available = os.listdir(rms_dir)
    rows = []

    for _, r in meta.iterrows():
        code = str(r["Station_Code"]).strip()
        if "." not in code:
            continue
        net, sta = code.split(".")[0], code.split(".")[1]
        matches = [f for f in available if f.startswith(f"{net}.{sta}.")]
        if not matches:
            continue

        tz = r["TimeZone"]
        lockdown = lockdown_timestamp(r.get("Date_LD1"), tz)
        try:
            s = load_station(rms_dir / matches[0], tz, lockdown)
        except Exception:
            s = None
        if s is None or len(s) < MIN_SAMPLES:
            continue

        prof, n_days = weekly_profile(s)
        if len(prof) < 7 or n_days < MIN_DAYS:
            continue

        norm = prof / prof.max()
        rows.append({
            "country": r["Country name"], "city": r["City"], "code": code,
            "ndays": n_days, "quietest": DAYS[int(prof.idxmin())],
            **{DAYS[i]: round(float(norm.get(i, np.nan)), 3) for i in range(7)},
        })

    res = pd.DataFrame(rows)
    res["inferred_weekend"] = res.apply(infer_weekend, axis=1)
    return res


def report(res: pd.DataFrame) -> None:
    print(f"Stations with usable pre-lockdown weekly profile: {len(res)}\n")

    print("=== Quietest day of week ===")
    print(res["quietest"].value_counts().to_string(), "\n")

    print("=== Inferred weekend (quietest adjacent pair) ===")
    print(res["inferred_weekend"].value_counts().to_string(), "\n")

    fri_sat = res[res.inferred_weekend == "Fri-Sat"].sort_values("country")
    print("=== Stations where the ground says the weekend is FRIDAY-SATURDAY ===")
    print(fri_sat[["country", "city", "ndays", "Fri", "Sat", "Sun"]]
          .to_string(index=False), "\n")

    grp_a = res[res.country.isin(FRI_SAT_COUNTRIES)]["Sun"]
    grp_b = res[~res.country.isin(FRI_SAT_COUNTRIES)]["Sun"]
    _, p = stats.mannwhitneyu(grp_a, grp_b, alternative="greater")
    print("Median normalised SUNDAY activity")
    print(f"  Israel / Palestine / Saudi  (n={len(grp_a):3d}): {grp_a.median():.3f}")
    print(f"  All other countries         (n={len(grp_b):3d}): {grp_b.median():.3f}")
    print(f"  Mann-Whitney U, one-sided:  p = {p:.5f}")


def make_figure(res: pd.DataFrame, out_path: Path) -> None:
    fig, ax = plt.subplots(figsize=(10, 5.5))

    for country, city, colour in FIGURE_CITIES:
        sub = res[res.country == country]
        if city is not None:
            sub = sub[sub.city == city]
        if sub.empty:
            continue
        row = sub.iloc[0]
        ax.plot(DAYS, [row[d] for d in DAYS], marker="o", lw=2.4,
                color=colour, label=f"{row['city']}, {row['country']}")

    ax.axvspan(3.5, 5.5, color="grey", alpha=0.10)
    ax.text(4.5, 0.455, "Fri-Sat", ha="center", fontsize=9, color="grey")
    ax.axvspan(5.5, 6.5, color="grey", alpha=0.20)
    ax.text(6.0, 0.455, "Sun", ha="center", fontsize=9, color="grey")

    ax.set_ylabel("Ground vibration, 4-14 Hz\n(normalised to each city's busiest day)")
    ax.set_title("The ground knows which days a country rests\n"
                 "Pre-lockdown seismic data, Lecocq et al. 2020",
                 fontsize=12, fontweight="bold")
    ax.legend(fontsize=9, loc="lower left")
    ax.grid(alpha=0.25)
    ax.set_ylim(0.42, 1.04)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    plt.tight_layout()
    plt.savefig(out_path, dpi=180)
    print(f"\nFigure written to {out_path}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--data-root", type=Path,
                    default=Path("data/external/2020_Science_GlobalQuieting"),
                    help="clone of ThomasLecocq/2020_Science_GlobalQuieting")
    ap.add_argument("--table-out", type=Path,
                    default=Path("outputs/tables/weekly_profiles.csv"))
    ap.add_argument("--figure-out", type=Path,
                    default=Path("outputs/plots/weekend_signature.png"))
    args = ap.parse_args()

    if not (args.data_root / "PaperZero_RMS").is_dir():
        raise SystemExit(
            f"PaperZero_RMS not found under {args.data_root}.\n"
            "Run `python src/get_data.py` first, or pass --data-root."
        )

    res = build_profiles(args.data_root)
    args.table_out.parent.mkdir(parents=True, exist_ok=True)
    res.to_csv(args.table_out, index=False)
    print(f"Table written to {args.table_out}\n")

    report(res)
    make_figure(res, args.figure_out)


if __name__ == "__main__":
    main()
