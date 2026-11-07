"""
ask.py -- out-of-fold weekday guesses for every city-day, 2019-2026, for "Ask the ground"
(site/globe.html#ask). The method is in groundtruth/ask.py; the result is Result 16 in
docs/04-results.md.

Reads the local MUSTANG cache (data/cache/mustang/, filled by src/history.py --download),
so it runs on a machine that has the cache, not in CI. Its outputs are committed, like
site/data/history.json: written by this script, never by hand.

Two guesses per day (since 1.5.0, Result 17):
  * from the day ALONE: 3 frequency bands x 48 half-hours, gradient boosting, week folds;
  * from the WEEK around it (the day and 3 days either side), 28-day-block folds.

Outputs
  site/data/ask/<station>.json     one file per station; each day is
                                   [day index, 24-hour shape (4-14 Hz), 7 weekday percents
                                    from the day alone, period, holiday, fold, level vs the
                                    previous 8 weeks, 7 weekday percents from the week, week fold]
  outputs/tables/ask_scores.csv    per station: accuracy of those guesses

Needs the day tables cached by src/weekday_experiment.py (data/cache/weekday/).
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
from groundtruth.features import SHAPE_COLS  # noqa: E402
from groundtruth import weekday as W  # noqa: E402
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


DAY_FEATURES = W.feature_sets()["A3"]     # Result 17's chosen single-day features
DAY_MODEL = W.make_gb


def station_days(row):
    """The station's day table (cached by src/weekday_experiment.py), with Result 16's column
    names for the 4-14 Hz hourly shape and level, which the site draws."""
    from weekday_experiment import station_table
    d = station_table(row)
    if d.empty:
        return d
    d = d.rename(columns={f"b2_h{h:02d}": c for h, c in enumerate(SHAPE_COLS)})
    d["level"], d["level_raw"] = d["b2_hlevel"], d["b2_hlevel_raw"]
    return d.dropna(subset=SHAPE_COLS)       # the same days as before: those with a 4-14 Hz line


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    rules = load_weekend_rules()
    rows = []
    for _, r in roster().iterrows():
        d = station_days(r)
        if d.empty:
            print(f"{r['city']:18s} no data")
            continue
        g = ask.oof(d, DAY_FEATURES, DAY_MODEL)
        gw = ask.oof_week(d, DAY_FEATURES, START)
        wk = weekend_rules(r["country"], rules)
        sc = ask.scores(d, g, weekend_on(wk))
        sw = ask.scores(d, gw, weekend_on(wk))
        sc.update({"week_dow_acc": sw["dow_acc"], "week_weekend_bal_acc": sw["weekend_bal_acc"],
                   "week_n_scored": sw["n_scored"]})
        city = display_name(r["station"], r["city"])
        rows.append({"station": r["id"], "city": city, "country": r["country"], **sc})
        print(f"{city:30s} days {sc['n_days']:5d}  scored {sc['n_scored']:5d}  "
              f"exact day {sc['dow_acc']:.3f}  from the week {sc['week_dow_acc']:.3f}  weekday/weekend {sc['weekend_bal_acc']:.3f}  "
              f"holidays as weekend {sc['holiday_as_weekend']:.2f} (n={sc['weekday_holidays']})", flush=True)

        base = d[d["period"] == "baseline"].dropna(subset=SHAPE_COLS)
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
            if t in gw.index:
                gr = gw.loc[t]
                wprobs, wfold = ask.percent(gr[[f"p{k}" for k in range(7)]].values), int(gr["fold"])
            else:
                wprobs, wfold = None, None
            shape = [round(float(x), 3) for x in day[SHAPE_COLS].values]
            days.append([i, shape, probs, day["period"], day["holiday_name"], fold, lvl, wprobs, wfold])
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
          f"(chance 0.143); from the week {good['week_dow_acc'].median():.3f}; median weekday-vs-weekend {good['weekend_bal_acc'].median():.3f}; "
          f"weekday holidays read as weekend: median {good['holiday_as_weekend'].median():.3f} "
          f"(pooled {(good['holiday_as_weekend'] * good['weekday_holidays']).sum() / good['weekday_holidays'].sum():.3f}), "
          f"ordinary weekdays: median {good['weekday_as_weekend'].median():.3f}; "
          f"lockdown days guessed {t['lockdown_days'].sum()}; days guessed {t['n_scored'].sum()} "
          f"({t['n_scored_baseline'].sum()} ordinary); stations >= 0.9 weekday/weekend {(good['weekend_bal_acc'] >= 0.9).sum()}")
    size = sum(os.path.getsize(os.path.join(OUT_DIR, f)) for f in os.listdir(OUT_DIR))
    print(f"site/data/ask/: {size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
