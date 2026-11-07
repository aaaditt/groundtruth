"""
weekday_experiment.py -- can the ground name the EXACT weekday? (docs/15, pre-registered)

Part A: eight single-day configurations (4 feature sets x random forest / gradient boosting),
        all scored on the same days with Result 16's week folds.
Part B: the best Part A feature set, seen for the 3 days before and after (a week of context),
        against the same single-day features on the same 28-day-block folds (control B0).

Reads the local MUSTANG cache (data/cache/mustang/). Per-station day tables are cached in
data/cache/weekday/ (not committed) so a re-run skips the parsing.

Outputs (committed):
  outputs/tables/weekday_partA.csv      station x config x model: n, exact, tue_thu, weekend_bal
  outputs/tables/weekday_partB.csv      station x {B0, B}: the same columns
  outputs/tables/weekday_confusion.csv  pooled 7x7 counts for A0, the chosen config, B0 and B

Run:  python src/weekday_experiment.py      (about 20-30 minutes for 33 stations)
"""
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))  # repo root
sys.path.insert(0, os.path.dirname(__file__))                      # src/, for history and ask
from groundtruth import ask as gask  # noqa: E402
from groundtruth import weekday as W  # noqa: E402
from groundtruth.calendars import load_weekend_rules  # noqa: E402
from groundtruth.features import clean_rms  # noqa: E402
from groundtruth.live import label_days  # noqa: E402
from groundtruth.models import REPO  # noqa: E402
from groundtruth.places import display_name  # noqa: E402
from ask import weekend_on, weekend_rules  # noqa: E402  (src/ask.py)
from history import END, START, roster  # noqa: E402

CACHE = os.path.join(REPO, "data", "cache", "weekday")
TABLES = os.path.join(REPO, "outputs", "tables")
SETS = W.feature_sets()


def station_table(row):
    """All four feature sets for one station, labelled like Result 16, cached on disk.
    The pickle cache is written only by this function on this machine (never downloaded)."""
    path = os.path.join(CACHE, f"{row['id']}.pkl")
    if os.path.exists(path):
        return pd.read_pickle(path)
    f = W.band_frame(row["id"], START, END)
    if f.empty:
        return pd.DataFrame()
    f.index = f.index.tz_convert(row["timezone"])
    parts = []
    for b in W.BANDS:
        s = clean_rms(f[b].dropna())
        parts += [W.day_table(s, "1h", b), W.day_table(s, "30min", b)]
    d = pd.concat(parts, axis=1)
    d.index.name = "date"
    d = d[(d.index >= pd.Timestamp(START)) & (d.index < pd.Timestamp(END))]
    d["day_of_week"] = d.index.day_of_week
    d = label_days(d, row["country"])
    d = gask.mark_lockdown(d)
    d = W.add_levels(d)
    os.makedirs(CACHE, exist_ok=True)
    d.to_pickle(path)
    return d


def part_a(d, wk_of):
    """Out-of-fold guesses for every config, on the baseline days all four sets can score."""
    a0 = d.dropna(subset=SETS["A0"])
    fold_of = W.week_folds(a0)                  # Result 16's folds, from the A0 days
    common = d["period"].eq("baseline")
    for cols in SETS.values():
        common &= d[cols].notna().all(axis=1)
    out = {}
    for name, cols in SETS.items():
        rows = d.dropna(subset=cols)
        rows = rows[rows["week_id"].isin(fold_of)]
        X, y = rows[cols].values, rows["day_of_week"].values
        for m, factory in W.MODELS.items():
            probs, _ = W.oof_probs(X, y, rows["week_id"].values, (rows["period"] == "baseline").values,
                                   fold_of, factory)
            pred = pd.Series(probs.argmax(axis=1), index=rows.index)
            keep = common[common].index.intersection(rows.index)
            out[(name, m)] = (y[rows.index.get_indexer(keep)], pred.loc[keep].values,
                              [wk_of(t) for t in keep])
    return out


def part_b(d, cols, wk_of):
    """B0 (one day) and B (the week around it), same model, same block folds, same training days."""
    rows = d.dropna(subset=cols)
    blocks = W.block_of(rows.index, START)
    fold_of = W.block_folds(blocks)
    drop = W.window_touches_fold(rows.index, START, fold_of)
    base = (rows["period"] == "baseline").values
    y = rows["day_of_week"].values
    res = {}
    for name, X in [("B0", rows[cols].values), ("B", W.week_matrix(rows, cols))]:
        probs, _ = W.oof_probs(X, y, blocks, base, fold_of, W.make_gb, drop_from_train=drop)
        pred = probs.argmax(axis=1)
        res[name] = (y[base], pred[base], [wk_of(t) for t in rows.index[base]])
    return res


def summarise(rows, label):
    t = pd.DataFrame(rows)
    g = t.groupby(label)
    s = pd.DataFrame({"median_exact": g["exact"].median(), "pooled_exact": g.apply(
        lambda x: (x["exact"] * x["n"]).sum() / x["n"].sum(), include_groups=False),
        "median_tue_thu": g["tue_thu"].median(), "median_weekend_bal": g["weekend_bal"].median(),
        "stations_90": g["exact"].apply(lambda x: int((x >= 0.9).sum())), "stations": g.size()})
    return t, s


def main():
    rules = load_weekend_rules()
    ros = roster()
    # build (or load) every station's day tables in parallel first: parsing and the rolling
    # levels are the slow part (about 4 minutes per station on one core)
    from joblib import Parallel, delayed
    Parallel(n_jobs=6)(delayed(station_table)(r) for _, r in ros.iterrows())
    tables, a_rows, cms = {}, [], {}
    for _, r in ros.iterrows():
        d = station_table(r)
        if d.empty:
            print(f"{r['id']}: no data")
            continue
        tables[r["id"]] = d
        wk_of = weekend_on(weekend_rules(r["country"], rules))
        city = display_name(r["station"], r["city"])
        res = part_a(d, wk_of)
        line = []
        for (name, m), (y, p, wd) in res.items():
            a = W.accuracy_table(y, p, wd)
            cms[(name, m)] = cms.get((name, m), 0) + a["cm"]
            a_rows.append({"station": r["id"], "city": city, "config": f"{name}-{m}",
                           **{k: v for k, v in a.items() if k != "cm"}})
            line.append(f"{name}-{m} {a['exact']:.3f}")
        print(f"{city:30s} n={a_rows[-1]['n']:5d}  " + "  ".join(line), flush=True)

    ta, sa = summarise(a_rows, "config")
    ta.to_csv(os.path.join(TABLES, "weekday_partA.csv"), index=False, float_format="%.4f")
    print("\nPart A (median over stations, common days):\n" + sa.round(4).to_string())

    # the chosen configuration (docs/15 section 3): highest median exact; ties -> fewer features
    sa["n_features"] = [len(SETS[c.split("-")[0]]) for c in sa.index]
    chosen = sa.sort_values(["median_exact", "n_features"], ascending=[False, True]).index[0]
    cols = SETS[chosen.split("-")[0]]
    a0 = ta[ta["config"] == "A0-RF"].set_index("station")["exact"]
    ch = ta[ta["config"] == chosen].set_index("station")["exact"]
    gain = sa.loc[chosen, "median_exact"] - sa.loc["A0-RF", "median_exact"]
    wins = int((ch > a0.reindex(ch.index)).sum())
    verdict = "IMPROVES on Result 16" if gain >= 0.03 and wins >= 22 else "no meaningful improvement"
    print(f"\nChosen: {chosen} ({len(cols)} features per day). Median gain over A0-RF {100 * gain:+.1f} points; "
          f"higher at {wins}/{len(ch)} stations -> {verdict}")

    b_rows = []
    for _, r in ros.iterrows():
        if r["id"] not in tables:
            continue
        wk_of = weekend_on(weekend_rules(r["country"], rules))
        res = part_b(tables[r["id"]], cols, wk_of)
        line = []
        for name, (y, p, wd) in res.items():
            a = W.accuracy_table(y, p, wd)
            cms[(name, "GB")] = cms.get((name, "GB"), 0) + a["cm"]
            b_rows.append({"station": r["id"], "city": display_name(r["station"], r["city"]), "config": name,
                           **{k: v for k, v in a.items() if k != "cm"}})
            line.append(f"{name} {a['exact']:.3f}")
        print(f"{b_rows[-1]['city']:30s} " + "  ".join(line), flush=True)
    tb, sb = summarise(b_rows, "config")
    tb.to_csv(os.path.join(TABLES, "weekday_partB.csv"), index=False, float_format="%.4f")
    print(f"\nPart B, per-day features {chosen.split('-')[0]} (median over stations):\n" + sb.round(4).to_string())
    print("Aspiration (90% median exact) " + ("REACHED" if sb.loc["B", "median_exact"] >= 0.9 else "not reached"))

    cm_rows = []
    for key in [("A0", "RF"), tuple(chosen.split("-")), ("B0", "GB"), ("B", "GB")]:
        for i in range(7):
            for j in range(7):
                cm_rows.append({"config": "-".join(key), "true": i, "pred": j, "count": int(cms[key][i, j])})
        cm = cms[key]
        print(f"\n{'-'.join(key)} pooled, rows = true Mon..Sun, % guessed Mon..Sun")
        print((100 * cm / cm.sum(axis=1, keepdims=True)).round().astype(int))
    pd.DataFrame(cm_rows).to_csv(os.path.join(TABLES, "weekday_confusion.csv"), index=False)


if __name__ == "__main__":
    main()
