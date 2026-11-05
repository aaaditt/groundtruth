"""ask.py -- the logic behind "Ask the ground" (site/globe.html#ask, src/ask.py).

A visitor picks any city and any day from 2019 to 2026, and the site shows what weekday the
model thinks that day was. To keep that honest, every day's guess comes from a model that
never trained on that day's week:

  * one station at a time, all its days 2019-2026 (EarthScope MUSTANG, the globe's data);
  * the same 24-hour shape features as everywhere else (groundtruth.features);
  * a 7-class random forest (make_model) trained on ordinary days only (period "baseline");
  * 5-fold GroupKFold on week_id: a whole week is either training or testing, and each day
    is guessed by the one fold model that did NOT see its week. Holiday, festive and
    lockdown days never enter training at all, but are guessed the same way.

Two choices that differ from the 12-month live models (groundtruth/live.py), because this
data spans seven years:
  * `level` (how loud the day was overall) is compared with the station's ordinary days in
    the PREVIOUS 8 weeks, not with one fixed year. Sensors drift and get replaced over seven
    years; the day's own shape is not touched.
  * a fixed lockdown window, 1 Mar - 30 Jun 2020, is never training data at any station
    (CLAUDE.md rule 2). Later regional lockdowns are not marked; docs/04 Result 16 says so.
"""
import numpy as np
import pandas as pd
from sklearn.metrics import balanced_accuracy_score

from groundtruth.features import SHAPE_COLS
from groundtruth.models import make_cv, make_model, week_id

LOCKDOWN = ("2020-03-01", "2020-06-30")
WINDOW_DAYS = 56          # 8 weeks of earlier days for the level reference
MIN_REF = 10              # at least this many ordinary days in that window ...
FALLBACK_DAYS = 28        # ... else the last 28 ordinary days before the day (within a year),
FALLBACK_SPAN = 365       #     e.g. late in the 2020 lockdown window; else not scored
FEATURES = SHAPE_COLS + ["level"]


def mark_lockdown(d):
    """Label every day in the fixed 2020 lockdown window as period "lockdown"."""
    d = d.copy()
    on = (d.index >= pd.Timestamp(LOCKDOWN[0])) & (d.index <= pd.Timestamp(LOCKDOWN[1]))
    d.loc[on, "period"] = "lockdown"
    return d


def rolling_level(d):
    """Each day's level_raw as a robust z-score (median / MAD, clipped to +-10) against the
    baseline days of the 56 days BEFORE it. When fewer than MIN_REF such days exist (deep in
    the lockdown window, or after a long outage), it uses the last FALLBACK_DAYS baseline days
    before the day instead, looking back at most a year; NaN if even that is too few.
    Uses earlier days' levels and the holiday calendar only, never weekday labels."""
    lv = d["level_raw"]
    base = lv.where(d["period"] == "baseline")
    out = pd.Series(np.nan, index=d.index)
    idx = d.index
    for k, t in enumerate(idx):
        ref = base[(idx < t) & (idx >= t - pd.Timedelta(days=WINDOW_DAYS))].dropna()
        if len(ref) < MIN_REF:
            ref = base[(idx < t) & (idx >= t - pd.Timedelta(days=FALLBACK_SPAN))].dropna().iloc[-FALLBACK_DAYS:]
        if len(ref) < MIN_REF:
            continue
        mad = 1.4826 * (ref - ref.median()).abs().median() + 1e-9
        out.iloc[k] = float(np.clip((lv.iloc[k] - ref.median()) / mad, -10, 10))
    return out


def oof(d):
    """Out-of-fold weekday probabilities for every scorable day.

    Returns a DataFrame indexed like the scorable days with columns fold, p0..p6 (Monday ..
    Sunday) and pred (the most likely weekday)."""
    d = d.dropna(subset=FEATURES).copy()
    d["week_id"] = week_id(d.index)
    base = d[d["period"] == "baseline"]
    X, y, g = base[FEATURES].values, base["day_of_week"].values, base["week_id"].values
    # the folds are defined on the training weeks; any other week (holidays only,
    # lockdown) is assigned to a fold by its own week number, so it is also never seen
    fold_of_week = {}
    for f, (_, test) in enumerate(make_cv().split(X, y, groups=g)):
        for w in set(g[test]):
            fold_of_week[w] = f
    weeks = sorted(set(d["week_id"]))
    extra = [w for w in weeks if w not in fold_of_week]
    for k, w in enumerate(extra):
        fold_of_week[w] = k % 5
    d["fold"] = d["week_id"].map(fold_of_week)
    probs = np.zeros((len(d), 7))
    for f in range(5):
        train = base[base["week_id"].map(fold_of_week) != f]
        model = make_model().fit(train[FEATURES].values, train["day_of_week"].values)
        rows = (d["fold"] == f).values
        if rows.any():
            p = model.predict_proba(d.loc[rows, FEATURES].values)
            full = np.zeros((rows.sum(), 7))
            full[:, model.classes_] = p
            probs[rows] = full
    out = pd.DataFrame(probs, index=d.index, columns=[f"p{k}" for k in range(7)])
    out.insert(0, "fold", d["fold"].astype(int))
    out["pred"] = probs.argmax(axis=1)
    return out


def percent(probs):
    """Probabilities as whole percents (what the site shows and the tests check)."""
    return [int(round(100 * p)) for p in probs]


def scores(d, guesses, weekend_days_on):
    """Accuracy of the out-of-fold guesses, from the same rounded percents the site shows.

    weekend_days_on(date) -> set of weekday numbers that were the weekend on that date."""
    g = guesses.join(d[["period", "day_of_week", "holiday_name"]], how="left")
    pc = np.array([percent(r) for r in g[[f"p{k}" for k in range(7)]].values])
    pred = pc.argmax(axis=1)
    p_weekend = np.array([pc[k, sorted(weekend_days_on(t))].sum() for k, t in enumerate(g.index)])
    is_we = np.array([t.weekday() in weekend_days_on(t) for t in g.index])
    b = (g["period"] == "baseline").values
    hol = ((g["period"] == "holiday") & ~is_we).values
    ordinary_weekday = b & ~is_we
    return {
        "n_days": int(len(d)),
        "n_scored": int(len(g)),
        "n_scored_baseline": int(b.sum()),
        "dow_acc": float((pred[b] == g["day_of_week"].values[b]).mean()) if b.any() else np.nan,
        "weekend_bal_acc": float(balanced_accuracy_score(is_we[b], p_weekend[b] >= 50)) if b.any() else np.nan,
        "weekday_holidays": int(hol.sum()),
        "holiday_as_weekend": float((p_weekend[hol] >= 50).mean()) if hol.any() else np.nan,
        "weekday_as_weekend": float((p_weekend[ordinary_weekday] >= 50).mean()) if ordinary_weekday.any() else np.nan,
        "lockdown_days": int((g["period"] == "lockdown").sum()),
    }


__all__ = ["LOCKDOWN", "WINDOW_DAYS", "MIN_REF", "FALLBACK_DAYS", "FALLBACK_SPAN", "FEATURES", "mark_lockdown", "rolling_level",
           "oof", "percent", "scores"]
