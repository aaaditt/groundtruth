"""
presentation_data.py -- every number and curve the presentation videos draw.

The final-talk videos (presentation/video/, made with Remotion) must never contain a
number typed in by hand: CLAUDE.md rule 1, real data only. So this script reads the
real files and writes small JSON files that the videos load:

  city_day.json   one real Wednesday and Sunday under Brussels (15-minute shaking),
                  and the 25 numbers (24 shape + 1 level) the model sees for each
  spectrum.json   Brussels' real frequency spectrum, hour by hour, weekday vs Sunday
                  (MUSTANG noise-psd, Oct 2025 - Sep 2026, local cache)
  bands.json      Result 12: how well each frequency band reads the weekend
  forest.json     a random forest actually trained on Brussels: the first questions of
                  one tree, and the 100 votes for a day it never saw
  folds.json      which Brussels weeks are held out in each of the 5 test rounds
  results.json    Results 1-3, 6: 149 cities, the control group, shape vs loudness
  mistakes.json   Results 4, 7, 8: Christmas 2019, holidays, the confusion detector
  applied.json    Results 9, 10, 16-19: the weekend moves, the UAE, the limits

Run:  python src/presentation_data.py      (~1 minute; needs the local MUSTANG cache)
"""
import gzip
import json
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from groundtruth.features import load_station_rms, daily_features, SHAPE_COLS  # noqa: E402
from groundtruth.models import load, make_model, make_cv, FEATURES, SHORT  # noqa: E402
from groundtruth.mustang import parse, CACHE  # noqa: E402
from groundtruth.stations import load_stations  # noqa: E402
from groundtruth.calendars import public_holidays  # noqa: E402

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(REPO, "presentation", "video", "public", "data")
TABLES = os.path.join(REPO, "outputs", "tables")
RMS_DIR = os.path.join(REPO, "data", "external", "2020_Science_GlobalQuieting", "PaperZero_RMS")

CITY = "BE.UCC"                 # Brussels: the city the whole talk follows
CITY_LIVE = "BE.UCC..HHZ"       # the same seismometer in the recent (MUSTANG) data
WEDNESDAY, SUNDAY = "2020-01-15", "2020-01-19"   # an ordinary week in January 2020
CHRISTMAS = "2019-12-25"
CONTROLS = ["NC.MLI", "C1.MG01", "BX.KOOLE"]   # Result 2: places with almost no people


def save(name, obj):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        json.dump(obj, f, separators=(",", ":"))
    print(f"  wrote {name}")


def r(x, n=5):
    """Round for the JSON (the videos only draw these; nothing is computed from them)."""
    return None if x is None or not np.isfinite(x) else round(float(x), n)


def tz_of(lecocq_code):
    """The station's local time zone, from config/stations.yaml."""
    for s in load_stations():
        if s.id.startswith(lecocq_code + "."):
            return s.timezone
    raise KeyError(lecocq_code)


# ── 1. One real day under Brussels ────────────────────────────────────────────────
def city_day(days):
    tz = tz_of(CITY)
    s = load_station_rms(os.path.join(RMS_DIR, f"{CITY}..HHZ.csv"), tz)
    typical = float(s.median())          # stations use different units: show "x typical"
    feats = daily_features(s)
    base = days[(days.station == CITY) & (days.period == "baseline")]
    hol = days[(days.station == CITY) & (days.period == "holiday")]
    out = {"city": "Brussels", "station": CITY, "timezone": tz, "days": {}}
    for label, d in [("wednesday", WEDNESDAY), ("sunday", SUNDAY), ("christmas", CHRISTMAS)]:
        # Christmas is a holiday (never trained on); the other two are ordinary days
        allowed = hol if label == "christmas" else base
        assert pd.Timestamp(d) in set(allowed.date), f"{d} has the wrong period in {CITY}"
        one = s[s.index.strftime("%Y-%m-%d") == d]
        f = feats.loc[pd.Timestamp(d)]
        out["days"][label] = {
            "date": d,
            # minutes after local midnight, and shaking as a multiple of the typical level
            "samples": [[int(t.hour * 60 + t.minute), r(v / typical)] for t, v in one.items()],
            "hourly_log10": [r(f[c] + f["level_raw"]) for c in SHAPE_COLS],
            "shape": [r(f[c]) for c in SHAPE_COLS],
            "level_raw": r(f["level_raw"]),
        }
    out["unit_note"] = "shaking divided by this station's median over the whole record"
    out["typical_log10"] = r(np.log10(typical))   # hourly_log10 - this = log10(x typical)
    # the station's usual ordinary-day loudness, for the "level" step
    out["usual_level_raw"] = r(base.level_raw.median())
    return out


# ── 2. The real spectrum, hour by hour ────────────────────────────────────────────
def spectrum():
    tz = tz_of(CITY)
    folder = os.path.join(CACHE, CITY_LIVE)
    months = [f"{y}-{m:02d}" for y, m in
              [(2025, 10), (2025, 11), (2025, 12)] + [(2026, k) for k in range(1, 10)]]
    parts = []
    for m in months:
        with gzip.open(os.path.join(folder, f"{m}.txt.gz"), "rt", encoding="utf-8") as fh:
            parts.append(parse(fh.read()))
    psd = pd.concat(parts, ignore_index=True)
    psd = psd[(psd.freq >= 0.05) & (psd.freq <= 20)]
    t = psd["start"].dt.tz_convert(tz)
    psd["hour"] = t.dt.hour
    psd["date"] = t.dt.date
    dow = t.dt.day_of_week
    hol = set(public_holidays("BE", None, [2025, 2026]))
    is_hol = psd["date"].isin(hol)
    kind = np.where((dow < 5) & ~is_hol, "weekday", np.where(dow == 6, "sunday", ""))
    psd["kind"] = kind
    psd = psd[psd.kind != ""]
    med = psd.groupby(["kind", "hour", "freq"])["db"].median()
    freqs = sorted(psd.freq.unique())
    out = {"city": "Brussels", "station": CITY_LIVE, "timezone": tz,
           "period": f"{months[0]} to {months[-1]}", "freqs": [r(f, 5) for f in freqs],
           "unit": "dB (ground acceleration power, MUSTANG noise-psd)",
           "n_days": {k: int(psd[psd.kind == k].date.nunique()) for k in ["weekday", "sunday"]}}
    for k in ["weekday", "sunday"]:
        out[k] = [[r(med.get((k, h, f), np.nan), 2) for f in freqs] for h in range(24)]
    return out


# ── 3. Which band carries the rhythm (Result 12) ──────────────────────────────────
def bands():
    b = pd.read_csv(os.path.join(TABLES, "band_test.csv"))
    order = ["0.1-1 Hz", "1-4 Hz", "4-14 Hz", "14-19.7 Hz", "1-19.7 Hz"]
    g = b.groupby("band")
    return {"n_stations": int(b.station.nunique()),
            "bands": [{"band": k, "weekend_median": r(g.get_group(k).weekend_bal_acc.median()),
                       "dow_median": r(g.get_group(k).dow_acc.median())} for k in order]}


# ── 4. The forest and the test weeks, on Brussels ─────────────────────────────────
def forest_and_folds(days):
    g = days[(days.station == CITY) & (days.period == "baseline")].sort_values("date")
    g = g.reset_index(drop=True)
    X, y, weeks = g[FEATURES].values, g["day_of_week"].values, g["week"].values
    folds = list(make_cv().split(X, y, groups=weeks))
    fold_of_week = {}
    for i, (_, te) in enumerate(folds):
        for w in np.unique(weeks[te]):
            fold_of_week[int(w)] = i
    calendar = [{"date": d.strftime("%Y-%m-%d"), "dow": int(dw), "week": int(w),
                 "fold": fold_of_week[int(w)]}
                for d, dw, w in zip(g.date, g.day_of_week, weeks)]

    # The day we ask about: an ordinary Wednesday. Train only on the OTHER weeks.
    target = g.index[g.date == pd.Timestamp(WEDNESDAY)][0]
    tr, te = next((tr, te) for tr, te in folds if target in te)
    model = make_model().fit(X[tr], y[tr])
    votes = np.bincount([int(t.predict(X[[target]])[0]) for t in model.estimators_],
                        minlength=7)
    proba = model.predict_proba(X[[target]])[0]

    # The first three levels of tree 0, as plain questions
    tree = model.estimators_[0].tree_
    names = [f"{int(c[-2:])}:00 shape" if c.startswith("shape") else "level" for c in FEATURES]

    def node(i, depth):
        counts = tree.value[i][0]
        leaf = tree.children_left[i] == -1 or depth == 3
        d = {"samples": int(tree.n_node_samples[i]),
             "majority": SHORT[int(model.classes_[int(np.argmax(counts))])]}
        if not leaf:
            d["question"] = f"{names[tree.feature[i]]} <= {tree.threshold[i]:.2f}"
            d["feature"] = names[tree.feature[i]]
            d["threshold"] = r(tree.threshold[i], 3)
            d["yes"] = node(tree.children_left[i], depth + 1)
            d["no"] = node(tree.children_right[i], depth + 1)
        return d

    forest = {"city": "Brussels", "n_trees": len(model.estimators_),
              "n_train_days": int(len(tr)), "n_features": len(FEATURES),
              "day": {"date": WEDNESDAY, "true": SHORT[int(y[target])],
                      "votes": {SHORT[k]: int(v) for k, v in enumerate(votes)},
                      "proba": {SHORT[int(c)]: r(p) for c, p in zip(model.classes_, proba)}},
              "tree0": node(0, 0)}
    folds_out = {"city": "Brussels", "n_folds": len(folds), "n_days": int(len(g)),
                 "n_weeks": int(len(np.unique(weeks))), "days": calendar}
    return forest, folds_out


# ── 5. Results across 149 cities (Results 1, 2, 3, 6) ─────────────────────────────
def results():
    s = pd.read_csv(os.path.join(REPO, "outputs", "station_scores.csv"), keep_default_na=False,
                    na_values={"weekend_bal_acc": [""], "dow_acc": [""]})
    best = s.loc[s.dow_acc.idxmax()]
    sv = pd.read_csv(os.path.join(TABLES, "shape_vs_level.csv"))
    gain = sv.rf_both_dow - sv.rf_level_dow
    glob = pd.read_csv(os.path.join(REPO, "outputs", "global_model_unseen_city_scores.csv"))
    pooled = unseen_city_pooled()
    return {
        "n_stations": int(len(s)),
        "weekend_median": r(s.weekend_bal_acc.median()), "dow_median": r(s.dow_acc.median()),
        "best": {"city": best.city, "country": best.country, "dow": r(best.dow_acc)},
        "stations": [{"station": a, "city": c, "weekend": r(w), "dow": r(d)}
                     for a, c, w, d in zip(s.station, s.city, s.weekend_bal_acc, s.dow_acc)],
        "controls": [{"station": a, "city": c, "weekend": r(w), "dow": r(d)}
                     for a, c, w, d in s[s.station.isin(CONTROLS)][
                         ["station", "city", "weekend_bal_acc", "dow_acc"]].values],
        "shape_vs_level": {"median_gain_dow": r(gain.median()), "stations_gain_gt_2pp": int((gain > .02).sum()),
                           "n": int(len(gain)), "level_dow_median": r(sv.rf_level_dow.median()),
                           "both_dow_median": r(sv.rf_both_dow.median())},
        "unseen_city_median_weekend": r(glob.weekend_bal_acc.median()),
        "unseen_city_pooled_weekend": r(pooled),
        "level_only_weekend_median": r(sv.rf_level_weekend.median()),
    }


def unseen_city_pooled():
    """Result 3's headline: one global model, weekday vs weekend, pooled over test days
    from cities it never trained on. Same code as src/train_global.py (~1 minute)."""
    from sklearn.model_selection import cross_val_predict
    from sklearn.metrics import balanced_accuracy_score
    from groundtruth.models import make_global_model
    b = load()
    b = b[b.period == "baseline"]
    p = cross_val_predict(make_global_model(), b[FEATURES].values, b.is_weekend.values,
                          groups=b.station.values, cv=make_cv())
    return balanced_accuracy_score(b.is_weekend, p)


# ── 6. Mistakes that find events (Results 4, 7, 8) ────────────────────────────────
def mistakes():
    d = pd.read_csv(os.path.join(TABLES, "day_scores.csv"), keep_default_na=False,
                    na_values={c: [""] for c in ["pred_dow", "p_weekend", "confusion", "p_sunday", "pred_weekend"]})
    city = d[d.station == CITY]
    cal = [{"date": a, "dow": int(b), "pred": None if pd.isna(c) else int(c),
            "p_weekend": r(e), "confusion": r(k), "period": f, "holiday": h}
           for a, b, c, e, k, f, h in zip(city.date, city.day_of_week, city.pred_dow, city.p_weekend,
                                          city.confusion, city.period, city.holiday_name)]
    xmas = d[d.date == CHRISTMAS]
    hh = pd.read_csv(os.path.join(TABLES, "holiday_holdout.csv"), index_col=0)
    cd = pd.read_csv(os.path.join(TABLES, "confusion_detector.csv"))
    alld = cd[cd.subset == "all days"]
    return {
        "city": "Brussels", "calendar": cal,
        "christmas": {"date": CHRISTMAS, "weekday": "Wednesday",
                      "brussels": cal[[c["date"] for c in cal].index(CHRISTMAS)],
                      "n_stations": int(len(xmas)), "share_called_sunday": r((xmas.pred_dow == 6).mean())},
        "holidays_called_weekend": r(hh.loc["ALL public holidays", "called_weekend"]),
        "n_holidays": int(hh.loc["ALL public holidays", "n"]),
        "ordinary_called_weekend": r(hh.loc["ordinary working day", "called_weekend"]),
        "confusion_pr_auc_median": r(alld.confusion_pr_auc.median()),
        "anomaly_pr_auc_median": r(alld.anomaly_pr_auc.median()),
        "chance_pr_auc_median": r(alld.prevalence.median()),
        "confusion_wins": int((alld.confusion_pr_auc > alld.anomaly_pr_auc).sum()),
        "n_stations": int(len(alld)),
        # two named holidays the talk mentions: one when cities shut, one when most work
        # (weekday occurrences, all cities, weekend-vs-weekday model; docs/04 Result 4 table)
        "named_holidays": [named_holiday(d, h) for h in ("Christmas Day", "Veterans Day")],
    }


def named_holiday(d, name):
    s = d[(d.holiday_name == name) & (d.day_of_week < 5)]
    return {"name": name, "n": int(len(s)), "called_weekend": r(s.pred_weekend.astype(float).mean())}


# ── 6b. Lockdown: Brussels day by day, and the pooled flag rates (Result 4) ───────
def lockdown(days):
    g = days[days.station == CITY].sort_values("date")
    sc = pd.read_csv(os.path.join(REPO, "outputs", "daily_anomaly_scores.csv"))
    flag = sc.groupby("period").flagged.mean()          # pooled over all station-days
    return {
        "city": "Brussels", "lockdown_date": str(g.lockdown_date.iloc[0])[:10],
        # each day's loudness (level_raw, log10) with its period, for a timeline
        "days": [{"date": d.strftime("%Y-%m-%d"), "dow": int(w), "level": r(v), "period": p}
                 for d, w, v, p in zip(g.date, g.day_of_week, g.level_raw, g.period)],
        "flag_rate": {k: r(flag[k]) for k in ["baseline", "holiday", "festive", "lockdown"]},
    }


# ── 6c. Where the seismometers are (the data slide) ───────────────────────────────
def station_map(days):
    with open(os.path.join(REPO, "site", "data", "stations_2020.json"), encoding="utf-8") as f:
        st = json.load(f)
    return {"n_stations": int(days.station.nunique()), "n_station_days": int(len(days)),
            "n_ordinary_days": int((days.period == "baseline").sum()),
            "days_by_period": {k: int(v) for k, v in days.period.value_counts().items()},
            "stations": [{"code": s["code"], "city": s["city"], "lat": s["lat"], "lon": s["lon"],
                          "weekend": s.get("weekend_bal_acc")} for s in st]}


# ── 7. Where it was applied, and its limits (Results 9, 10, 16-19) ────────────────
def applied():
    ws = pd.read_csv(os.path.join(TABLES, "transfer_weekend_shift.csv"))
    uae_all = pd.read_csv(os.path.join(TABLES, "uae_experiment.csv"))
    uae, placebo = uae_all.iloc[0], uae_all[uae_all.analysis == "placebo year"].iloc[0]
    wa = pd.read_csv(os.path.join(TABLES, "weekday_partA.csv"))
    wb = pd.read_csv(os.path.join(TABLES, "weekday_partB.csv"))
    nf = pd.read_csv(os.path.join(TABLES, "noise_floor_summary.csv"))
    p99 = nf[(nf.false_alarm_level == "p99") & (nf.detector_a == "learned") & (nf.detector_b == "raw")].iloc[0]
    tm = pd.read_csv(os.path.join(TABLES, "transfer_matrix.csv"), index_col=0)
    # the UAE station's position, from the FDSN-checked table (not Table S1; see docs/02)
    co = pd.read_csv(os.path.join(TABLES, "history_station_coords.csv"), index_col="station")
    return {
        "weekend_shift": [{"city": c, "day": t, "called_weekend": r(v)}
                          for c, t, v in zip(ws.city, ws.true_day, ws.called_Sat_or_Sun)],
        "uae": {"station": "II.UOSS", "sunday_change": r(uae.Sun_pct_change),
                "p": r(uae.Sun_p_one_sided), "friday_change": r(uae.Fri_pct_change),
                "placebo_sunday_change": r(placebo.Sun_pct_change), "placebo_p": r(placebo.Sun_p_one_sided),
                "verdict": "SUPPORTED" if str(uae.verdict_preregistered).startswith("SUPPORTED") else "NOT",
                "lat": float(co.loc["II.UOSS", "lat"]), "lon": float(co.loc["II.UOSS", "lon"])},
        "transfer_matrix": {"regions": list(tm.columns),
                            "values": [[r(v) for v in row] for row in tm.values]},
        # Result 17: exact weekday from one day (A3-GB) vs from the week around it (B)
        "exact_one_day_median": r(wa[wa.config == "A3-GB"].exact.median()),
        "exact_week_median": r(wb[wb.config == "B"].exact.median()),
        "exact_one_day_control_median": r(wb[wb.config == "B0"].exact.median()),
        "noise_floor": {"pairs": int(p99.pairs), "learned": int(p99.found_a), "raw": int(p99.found_b),
                        "p": r(p99.p_mcnemar)},
    }


def main():
    days = load()
    print("Exporting presentation data (real files only)...")
    save("city_day.json", city_day(days))
    save("spectrum.json", spectrum())
    save("bands.json", bands())
    forest, folds = forest_and_folds(days)
    save("forest.json", forest)
    save("folds.json", folds)
    res = results()
    save("results.json", res)
    mis = mistakes()
    save("mistakes.json", mis)
    app = applied()
    save("applied.json", app)
    lock = lockdown(days)
    save("lockdown.json", lock)
    smap = station_map(days)
    save("stations.json", smap)
    print(f"  stations {smap['n_stations']}, station-days {smap['n_station_days']:,}, "
          f"ordinary {smap['n_ordinary_days']:,}; flag rates {lock['flag_rate']}")

    print("\nHeadline numbers (check against README / docs/04):")
    print(f"  weekday vs weekend, median of {res['n_stations']}: {res['weekend_median']:.1%}")
    print(f"  exact day, median: {res['dow_median']:.1%}; best {res['best']['city']} {res['best']['dow']:.1%}")
    print(f"  shape vs loudness: +{res['shape_vs_level']['median_gain_dow'] * 100:.0f} pp, "
          f"{res['shape_vs_level']['stations_gain_gt_2pp']} of {res['shape_vs_level']['n']} gain")
    print(f"  holidays called weekend: {mis['holidays_called_weekend']:.1%} (n={mis['n_holidays']}) "
          f"vs {mis['ordinary_called_weekend']:.1%}")
    print(f"  confusion PR-AUC {mis['confusion_pr_auc_median']:.2f} vs anomaly "
          f"{mis['anomaly_pr_auc_median']:.2f}, chance {mis['chance_pr_auc_median']:.2f}; "
          f"confusion wins at {mis['confusion_wins']}/{mis['n_stations']}")
    print(f"  Christmas 2019 in Brussels: called {SHORT[mis['christmas']['brussels']['pred']]}, "
          f"P(weekend) {mis['christmas']['brussels']['p_weekend']:.2f}; "
          f"{mis['christmas']['share_called_sunday']:.0%} of {mis['christmas']['n_stations']} cities said Sunday")
    print(f"  Brussels forest on {WEDNESDAY}: votes {forest['day']['votes']}")
    print(f"  unseen cities (pooled): {res['unseen_city_pooled_weekend']:.1%}; loudness only: "
          f"{res['level_only_weekend_median']:.1%}")
    print(f"  exact day: one day {app['exact_one_day_median']:.1%}, week {app['exact_week_median']:.1%}, "
          f"control {app['exact_one_day_control_median']:.1%}; UAE placebo {app['uae']['placebo_sunday_change']:.0%}")
    print(f"  UAE Sunday change {app['uae']['sunday_change']:.0%}, p = {app['uae']['p']:.3f}")
    print(f"  Noise floor: learned {app['noise_floor']['learned']} vs raw {app['noise_floor']['raw']}, "
          f"p = {app['noise_floor']['p']:.3f}")


if __name__ == "__main__":
    main()
