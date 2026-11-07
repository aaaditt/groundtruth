"""
more_data_experiment.py -- does more data, more stations, or more training rounds name the
weekday from ONE day better? (docs/16, pre-registered)

  L  learning curve: 100 ... all training days per station
  P  pooling: one model for all 33 stations vs one per station, on shared calendar-week folds
  R  more boosting rounds: max_iter 100 / 300 / 1000

All runs use Result 17's A3 features (3 bands x 48 half-hours + 3 levels) and score the same
baseline days as Result 17 Part A. Needs the day tables cached by src/weekday_experiment.py.

Run:  python src/more_data_experiment.py
"""
import os
import sys

import numpy as np
import pandas as pd
from joblib import Parallel, delayed
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.model_selection import GroupKFold

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.dirname(__file__))
from groundtruth import weekday as W  # noqa: E402
from groundtruth.places import display_name  # noqa: E402
from history import roster  # noqa: E402
from weekday_experiment import SETS, TABLES, station_table  # noqa: E402

COLS = SETS["A3"]
SIZES = [100, 200, 400, 800, 1600, "all"]
ROUNDS = [100, 300, 1000]


def gb(**kw):
    return HistGradientBoostingClassifier(class_weight="balanced", random_state=0, **kw)


def scored_rows(d):
    """Result 17 Part A's rows and scoring days for A3: weeks known to the A0 folds; scored on
    baseline days every feature set can score."""
    fold_of = W.week_folds(d.dropna(subset=SETS["A0"]))
    common = d["period"].eq("baseline")
    for cols in SETS.values():
        common &= d[cols].notna().all(axis=1)
    rows = d.dropna(subset=COLS)
    rows = rows[rows["week_id"].isin(fold_of)]
    return rows, fold_of, common.reindex(rows.index).values


def score(y, pred):
    mid = np.isin(y, [1, 2, 3])
    return {"n": int(len(y)), "exact": float((pred == y).mean()), "tue_thu": float((pred[mid] == y[mid]).mean())}


def fit_predict(X, y, folds, train_mask, factory, n=None):
    """Out-of-fold predictions; with n, each fold trains on a random n of its training days."""
    pred = np.full(len(y), -1)
    for f in sorted(set(folds)):
        tr = np.flatnonzero(train_mask & (folds != f))
        if n is not None and n < len(tr):
            tr = np.sort(np.random.default_rng(0).choice(tr, n, replace=False))
        m = factory().fit(X[tr], y[tr])
        te = folds == f
        pred[te] = m.predict(X[te])
    return pred


def per_station(sid, city):
    d = station_table({"id": sid})
    rows, fold_of, keep = scored_rows(d)
    X, y = rows[COLS].values, rows["day_of_week"].values
    folds = rows["week_id"].map(fold_of).values
    base = (rows["period"] == "baseline").values
    out = []
    for n in SIZES:
        p = fit_predict(X, y, folds, base, gb, None if n == "all" else n)
        out.append({"run": "L", "station": sid, "city": city, "config": f"n={n}", **score(y[keep], p[keep])})
    for it in ROUNDS:
        p = fit_predict(X, y, folds, base, lambda: gb(max_iter=it, early_stopping=False))
        out.append({"run": "R", "station": sid, "city": city, "config": f"max_iter={it}", **score(y[keep], p[keep])})
    return out


def pooled(ros):
    """P0 / P1 / P2 on folds by calendar week shared by all stations."""
    frames = []
    for k, (_, r) in enumerate(ros.iterrows()):
        d = station_table(r)
        rows, _, keep = scored_rows(d)
        rows = rows.assign(station_code=k, sid=r["id"], keep=keep)
        frames.append(rows[COLS + ["station_code", "sid", "keep", "week_id", "period", "day_of_week"]])
    a = pd.concat(frames)
    weeks = np.array(sorted(set(a["week_id"])))
    fold_of = {}
    for f, (_, te) in enumerate(GroupKFold(5).split(weeks, groups=weeks)):
        for w in weeks[te]:
            fold_of[w] = f
    a["fold"] = a["week_id"].map(fold_of)
    base = (a["period"] == "baseline").values
    y = a["day_of_week"].values
    preds = {}
    preds["P1"] = fit_predict(a[COLS + ["station_code"]].values, y, a["fold"].values, base,
                              lambda: gb(categorical_features=[len(COLS)]))
    preds["P2"] = fit_predict(a[COLS].values, y, a["fold"].values, base, gb)
    p0 = np.full(len(a), -1)
    for sid in a["sid"].unique():
        m = (a["sid"] == sid).values
        p0[m] = fit_predict(a.loc[m, COLS].values, y[m], a.loc[m, "fold"].values, base[m], gb)
    preds["P0"] = p0
    out = []
    for name, p in preds.items():
        for sid, g in a.assign(p=p).groupby("sid", sort=False):
            g = g[g["keep"]]
            out.append({"run": "P", "station": sid, "config": name,
                        **score(g["day_of_week"].values, g["p"].values)})
    return out


def report(t, run, base_cfg):
    s = t[t["run"] == run].groupby("config", sort=False).agg(
        median_exact=("exact", "median"), median_tue_thu=("tue_thu", "median"))
    s["pooled_exact"] = t[t["run"] == run].groupby("config", sort=False).apply(
        lambda x: (x["exact"] * x["n"]).sum() / x["n"].sum(), include_groups=False)
    b = t[(t["run"] == run) & (t["config"] == base_cfg)].set_index("station")["exact"]
    s["better_than_" + base_cfg] = [int((t[(t["run"] == run) & (t["config"] == c)].set_index("station")["exact"]
                                         > b).sum()) for c in s.index]
    print(f"\nRun {run}:\n" + s.round(4).to_string())
    return s


def main():
    ros = roster()
    names = {r["id"]: display_name(r["station"], r["city"]) for _, r in ros.iterrows()}
    res = Parallel(n_jobs=4)(delayed(per_station)(sid, names[sid]) for sid in ros["id"])
    rows = [x for part in res for x in part]
    p_rows = pooled(ros)
    for x in p_rows:
        x["city"] = names[x["station"]]
    t = pd.DataFrame(rows + p_rows)
    for run in "LPR":
        t[t["run"] == run].drop(columns="run").to_csv(
            os.path.join(TABLES, f"more_data_{run}.csv"), index=False, float_format="%.4f")

    sl = report(t, "L", "n=800")
    gain = sl.loc["n=all", "median_exact"] - sl.loc["n=800", "median_exact"]
    print(f"L: all vs 800 = {100 * gain:+.1f} points -> "
          + ("more own-station data is still paying off" if gain >= 0.02 else "the curve has flattened"))
    sp = report(t, "P", "P0")
    best = sp.loc[["P1", "P2"], "median_exact"].idxmax()
    g = sp.loc[best, "median_exact"] - sp.loc["P0", "median_exact"]
    print(f"P: best pooled {best} {100 * g:+.1f} points, better at {sp.loc[best, 'better_than_P0']}/33 -> "
          + ("pooling helps" if g >= 0.02 and sp.loc[best, "better_than_P0"] >= 22 else "pooling does not help enough"))
    sr = report(t, "R", "max_iter=100")
    best = sr["median_exact"].idxmax()
    g = sr.loc[best, "median_exact"] - sr.loc["max_iter=100", "median_exact"]
    print(f"R: best {best} {100 * g:+.1f} points, better at {sr.loc[best, 'better_than_max_iter=100']}/33 -> "
          + ("more rounds help" if g >= 0.02 and sr.loc[best, "better_than_max_iter=100"] >= 22 else "more rounds do not help enough"))


if __name__ == "__main__":
    main()
