"""
history_pilot.py -- can the live data source (MUSTANG) give us YEARS of history?

Idea for the site: a globe with a date slider over the last few years. Before building
it, this pilot checks two things on the live stations:

  1. COVERAGE: how many usable days each station has per month, Jan 2019 - Sep 2026.
  2. LOCKDOWN CHECK: the 2020 lockdowns are the best-known event in this data. If
     MUSTANG's history is trustworthy, it must show the same quieting as the published
     Lecocq et al. (2020) data, on the same days.

The check was written down BEFORE downloading (docs/10-work-log.md, 2026-11-04):
  before  = ordinary working days (period "baseline", not weekend) from 7 Jan 2020 to
            the day before the city's lockdown (Table S1 date, as in build_dataset.py)
  during  = working days (not weekend, not a public holiday) in the 4 weeks from the
            lockdown date
  change  = 10 ** (median level_raw during - median level_raw before) - 1
            (level_raw is log10 of the day's loudness, so this is a % change in
            vibration amplitude and has NO units -- it can be compared across sources)
  Only dates present in BOTH sources are used. Each source's change is computed from
  that source alone: the two are never mixed in one number or model.
  PASS per city: same sign, and the two changes within 10 percentage points.
  With 6 cities this is a sanity check, not a statistical test.

Outputs: outputs/tables/history_days.csv.gz  (one row per station-day, 2019-01 onward)
         outputs/tables/history_coverage.csv (usable days per station-month)
         outputs/tables/history_lockdown_check.csv
         outputs/plots/history_pilot.png

Run:  python src/history_pilot.py     (first run downloads ~450 station-months, polite
                                       1 request/second; re-runs use the cache)
"""
import os
import sys
from datetime import date

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))  # repo root
from groundtruth.features import clean_rms, daily_features  # noqa: E402
from groundtruth.live import label_days  # noqa: E402
from groundtruth.models import load  # noqa: E402
from groundtruth.mustang import rms_series  # noqa: E402
from groundtruth.stations import load_stations  # noqa: E402

START, END = date(2019, 1, 1), date(2026, 10, 1)   # END = live models' TRAIN_END
PRE_FROM = pd.Timestamp("2020-01-07")
DURING_DAYS = 28
TOL_PP = 10.0
TABLES = os.path.join("outputs", "tables")
PLOTS = os.path.join("outputs", "plots")


def history(station):
    """All local days for one station over [START, END), same features and labels as
    the live models (groundtruth.live), but `level` is not needed here."""
    s = rms_series(station.id, START, END)
    if s.empty:
        return pd.DataFrame()
    s.index = s.index.tz_convert(station.timezone)
    d = label_days(daily_features(clean_rms(s)), station.country)
    d = d[(d.index >= pd.Timestamp(START)) & (d.index < pd.Timestamp(END))]
    d.insert(0, "station", station.id)
    d.insert(1, "city", station.city)
    return d


def change(level_raw, before, during):
    return 10 ** (level_raw[during].median() - level_raw[before].median()) - 1


def lockdown_check(hist, lec, station):
    """Lockdown quieting in both sources on the SAME dates (see module docstring)."""
    code = ".".join(station.id.split(".")[:2])
    L = lec[lec["station"] == code].set_index("date")
    if L.empty or pd.isna(L["lockdown_date"].iloc[0]):
        return None
    ld = pd.Timestamp(L["lockdown_date"].iloc[0])
    M = hist.copy()
    both = L.index.intersection(M.index)
    L, M = L.loc[both], M.loc[both]
    # labels come from the published data, so both sources use identical day sets
    workday = ~L["is_weekend"].astype(bool) & (L["holiday_name"].fillna("") == "")
    before = workday & (L["period"] == "baseline") & (L.index >= PRE_FROM) & (L.index < ld)
    during = workday & (L.index >= ld) & (L.index < ld + pd.Timedelta(days=DURING_DAYS))
    if before.sum() < 5 or during.sum() < 5:
        return {"station": station.id, "city": station.city, "lockdown": ld.date(),
                "n_before": int(before.sum()), "n_during": int(during.sum()),
                "lecocq_change_pct": np.nan, "mustang_change_pct": np.nan, "pass": False}
    cl = 100 * change(L["level_raw"], before, during)
    cm = 100 * change(M["level_raw"], before, during)
    return {"station": station.id, "city": station.city, "lockdown": ld.date(),
            "n_before": int(before.sum()), "n_during": int(during.sum()),
            "lecocq_change_pct": round(cl, 1), "mustang_change_pct": round(cm, 1),
            "pass": bool(np.sign(cl) == np.sign(cm) and abs(cl - cm) <= TOL_PP)}


def plot(hist_all, stations, lockdowns):
    fig, axes = plt.subplots(len(stations), 1, figsize=(13, 2.1 * len(stations)), sharex=True)
    for ax, st in zip(axes, stations):
        h = hist_all[hist_all["station"] == st.id]
        if h.empty:
            ax.text(0.5, 0.5, "no data", transform=ax.transAxes, ha="center")
            ax.set_ylabel(st.city, rotation=0, ha="right", va="center", fontsize=11)
            continue
        work = h[(~h["is_weekend"]) & (h["period"] == "baseline")]["level_raw"]
        ref = work.median()
        # each working day, and a 4-week rolling median, as "x typical level"
        daily = 10 ** (work - ref)
        roll = daily.rolling("28D", min_periods=8).median()
        ax.plot(daily.index, daily.values, ".", ms=1.5, color="#86b6ef", alpha=0.6)
        ax.plot(roll.index, roll.values, "-", lw=2, color="#1c5cab")
        ax.axhline(1, color="#888", lw=0.8)
        if st.id in lockdowns:
            ld = pd.Timestamp(lockdowns[st.id])
            ax.axvspan(ld, ld + pd.Timedelta(days=DURING_DAYS), color="#d03b3b", alpha=0.15, lw=0)
        ax.set_ylim(0.4, 1.6)
        ax.set_ylabel(st.city, rotation=0, ha="right", va="center", fontsize=11)
        ax.grid(axis="y", color="#ddd", lw=0.5)
        for s in ("top", "right"):
            ax.spines[s].set_visible(False)
    axes[0].set_title("Working-day ground vibration, 2019-2026 (4-14 Hz, MUSTANG)\n"
                      "x typical level at this station; line = 4-week median; "
                      "red = first 4 weeks of the 2020 lockdown", fontsize=12, loc="left")
    axes[-1].xaxis.set_major_locator(mdates.YearLocator())
    axes[-1].xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
    fig.tight_layout()
    fig.savefig(os.path.join(PLOTS, "history_pilot.png"), dpi=150)
    plt.close(fig)


def main():
    stations = [s for s in load_stations() if s.route == "mustang"]
    lec = load()
    lockdowns = {}
    parts, checks = [], []
    for st in stations:
        print(f"{st.city:16s} downloading / reading {START} .. {END}", flush=True)
        h = history(st)
        print(f"{'':16s} {len(h)} usable days", flush=True)
        if h.empty:
            continue
        parts.append(h)
        c = lockdown_check(h, lec, st)
        if c:
            checks.append(c)
            lockdowns[st.id] = c["lockdown"]
    hist_all = pd.concat(parts)
    hist_all.index.name = "date"
    hist_all.to_csv(os.path.join(TABLES, "history_days.csv.gz"))

    months = pd.period_range(START, pd.Timestamp(END) - pd.Timedelta(days=1), freq="M")
    cov = (hist_all.groupby(["station", hist_all.index.to_period("M")]).size()
           .unstack(fill_value=0).reindex(columns=months, fill_value=0))
    cov.columns = [str(m) for m in cov.columns]
    cov.to_csv(os.path.join(TABLES, "history_coverage.csv"))

    chk = pd.DataFrame(checks)
    chk.to_csv(os.path.join(TABLES, "history_lockdown_check.csv"), index=False)
    plot(hist_all, stations, lockdowns)

    print("\nUsable days per year:")
    print(hist_all.groupby(["city", hist_all.index.year]).size().unstack(fill_value=0).to_string())
    print("\nLockdown check (working days, same dates in both sources):")
    print(chk.to_string(index=False))
    print(f"\n{int(chk['pass'].sum())}/{len(chk)} cities pass")


if __name__ == "__main__":
    main()
