"""
ask.py -- out-of-fold weekday guesses for every city-day, 2019-2026, for "Ask the ground"
(site/globe.html#ask). The method is in groundtruth/ask.py; the result is Result 16 in
docs/04-results.md.

Reads the local MUSTANG cache (data/cache/mustang/, filled by src/history.py --download),
so it runs on a machine that has the cache, not in CI. Its outputs are committed, like
site/data/history.json: written by this script, never by hand.

Outputs
  site/data/ask/<station>.json     one file per station; each day is
                                   [day index, 24-hour shape, 7 weekday percents, period,
                                    holiday, fold, level vs the previous 8 weeks]
  outputs/tables/ask_scores.csv    per station: accuracy of those guesses

Run:  python src/ask.py            (about 10 minutes for 33 stations)
"""
import json
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))  # repo root
sys.path.insert(0, os.path.dirname(__file__))                      # src/, for history.roster
from groundtruth import ask  # noqa: E402
from groundtruth.calendars import load_weekend_rules  # noqa: E402
from groundtruth.features import SHAPE_COLS, clean_rms, daily_features  # noqa: E402
from groundtruth.live import label_days  # noqa: E402
from groundtruth.mustang import rms_series  # noqa: E402
from groundtruth.places import display_name  # noqa: E402
from history import END, START, roster  # noqa: E402

OUT_DIR = os.path.join("site", "data", "ask")
SCORES = os.path.join("outputs", "tables", "ask_scores.csv")


def weekend_rules(country, rules):
    r = rules[rules["iso2"] == country]
    if r.empty:
        r = rules[rules["iso2"] == "*"]
    return [[str(v.date()), sorted(days)] for v, days in
            sorted(zip(r["valid_from"], r["days"]), key=lambda x: x[0])]


def weekend_on(rule_list):
    starts = [(pd.Timestamp(s), set(days)) for s, days in rule_list]
    def f(t):
        cur = starts[0][1]
        for s, days in starts:
            if t >= s:
                cur = days
        return cur
    return f


def station_days(row):
    s = rms_series(row["id"], START, END)
    if s.empty:
        return pd.DataFrame()
    s.index = s.index.tz_convert(row["timezone"])
    d = label_days(daily_features(clean_rms(s)), row["country"])
    d = d[(d.index >= pd.Timestamp(START)) & (d.index < pd.Timestamp(END))]
    d = ask.mark_lockdown(d)
    d["level"] = ask.rolling_level(d)
    return d


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    rules = load_weekend_rules()
    rows = []
    for _, r in roster().iterrows():
        d = station_days(r)
        if d.empty:
            print(f"{r['city']:18s} no data")
            continue
        g = ask.oof(d)
        wk = weekend_rules(r["country"], rules)
        sc = ask.scores(d, g, weekend_on(wk))
        city = display_name(r["station"], r["city"])
        rows.append({"station": r["id"], "city": city, "country": r["country"], **sc})
        print(f"{city:30s} days {sc['n_days']:5d}  scored {sc['n_scored']:5d}  "
              f"exact day {sc['dow_acc']:.3f}  weekday/weekend {sc['weekend_bal_acc']:.3f}  "
              f"holidays as weekend {sc['holiday_as_weekend']:.2f} (n={sc['weekday_holidays']})", flush=True)

        base = d[d["period"] == "baseline"]
        usual = {str(k): [round(float(x), 3) for x in base[base["day_of_week"] == k][SHAPE_COLS].mean()]
                 for k in range(7)}
        days = []
        t0 = pd.Timestamp(START)
        for t, day in d.iterrows():
            i = int((t - t0).days)        # local calendar day, counted from START
            if t in g.index:
                gr = g.loc[t]
                probs, fold = ask.percent(gr[[f"p{k}" for k in range(7)]].values), int(gr["fold"])
            else:
                probs, fold = None, None
            lvl = None if pd.isna(day["level"]) else round(float(day["level"]), 2)
            days.append([i, [round(float(x), 3) for x in day[SHAPE_COLS].values], probs,
                         day["period"], day["holiday_name"], fold, lvl])
        out = {"generated_from": "src/ask.py", "id": r["id"], "city": city, "country": r["country"],
               "timezone": r["timezone"], "start": str(START), "end_exclusive": str(END),
               "lockdown": list(ask.LOCKDOWN), "weekend": wk, "usual": usual,
               "scores": {k: (None if isinstance(v, float) and np.isnan(v) else round(v, 4) if isinstance(v, float) else v)
                          for k, v in sc.items()},
               "days": days}
        with open(os.path.join(OUT_DIR, f"{r['id']}.json"), "w", encoding="utf-8") as f:
            json.dump(out, f, separators=(",", ":"), ensure_ascii=False)

    t = pd.DataFrame(rows).sort_values("city")
    t.to_csv(SCORES, index=False, float_format="%.4f")
    good = t[t["weekend_bal_acc"].notna()]
    print(f"\n{len(t)} stations. Median exact-day accuracy {good['dow_acc'].median():.3f} "
          f"(chance 0.143); median weekday-vs-weekend {good['weekend_bal_acc'].median():.3f}; "
          f"weekday holidays read as weekend: median {good['holiday_as_weekend'].median():.3f} "
          f"(pooled {(good['holiday_as_weekend'] * good['weekday_holidays']).sum() / good['weekday_holidays'].sum():.3f}), "
          f"ordinary weekdays: median {good['weekday_as_weekend'].median():.3f}; "
          f"lockdown days guessed {t['lockdown_days'].sum()}; days guessed {t['n_scored'].sum()} "
          f"({t['n_scored_baseline'].sum()} ordinary); stations >= 0.9 weekday/weekend {(good['weekend_bal_acc'] >= 0.9).sum()}")
    size = sum(os.path.getsize(os.path.join(OUT_DIR, f)) for f in os.listdir(OUT_DIR))
    print(f"site/data/ask/: {size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
