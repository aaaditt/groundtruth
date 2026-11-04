"""Per-day scores for disruption detection, computed honestly.

For every station-day this gives:
  p_true_dow  : probability the 7-class model gives to the day's TRUE weekday
  confusion   : 1 - p_true_dow  ("how surprised is the model by this day?")
  p_sunday    : probability of "Sunday"
  p_weekend   : weekday-vs-weekend model's probability of "weekend"
  anomaly     : robust distance from normal days of the same day type (no labels used)

Honesty rule: a NORMAL (baseline) day is always scored by models and statistics fitted
on OTHER weeks (week-held-out, same folds as everywhere else). Holiday, festive and
lockdown days were never in training, so they are scored by a model fitted on all
normal days. Without this, normal days would look "too normal" and every detector
would look better than it is.
"""
import numpy as np
import pandas as pd

from groundtruth.models import make_model, make_cv, FEATURES


def day_type(dow, weekend):
    """Working days together (0); each weekend day on its own (1 + weekday number)."""
    return np.where(weekend == 1, 1 + dow, 0)


def _anomaly(X_ref, t_ref, X, t):
    """Root-mean-square of clipped robust z-scores vs reference days of the same type."""
    out = np.full(len(X), np.nan)
    for k in np.unique(t):
        ref = X_ref[t_ref == k]
        if len(ref) < 3:
            continue
        mu = np.median(ref, axis=0)
        sd = 1.4826 * np.median(np.abs(ref - mu), axis=0) + 1e-6
        m = t == k
        out[m] = np.sqrt((np.clip((X[m] - mu) / sd, -10, 10) ** 2).mean(axis=1))
    return out


def _fit_predict(Xtr, dtr, wtr, ttr, Xte, dte, tte):
    """Fit on training days, score test days. Returns a dict of arrays for the test days."""
    m7 = make_model().fit(Xtr, dtr)
    m2 = make_model().fit(Xtr, wtr)
    P7 = np.zeros((len(Xte), 7))
    P7[:, m7.classes_] = m7.predict_proba(Xte)
    P2 = m2.predict_proba(Xte)
    p_we = P2[:, list(m2.classes_).index(1)] if 1 in m2.classes_ else np.zeros(len(Xte))
    return {"p_true_dow": P7[np.arange(len(Xte)), dte], "p_sunday": P7[:, 6],
            "pred_dow": P7.argmax(1), "p_weekend": p_we,
            "pred_weekend": m2.predict(Xte), "anomaly": _anomaly(Xtr, ttr, Xte, tte)}


def score_station(g):
    """g = all days of ONE station (from groundtruth.models.load). Returns g + score columns."""
    g = g.sort_values("date").reset_index(drop=True)
    X = g[FEATURES].values
    dow, wk = g["day_of_week"].values, g["is_weekend"].values
    t = day_type(dow, wk)
    base = (g["period"] == "baseline").values
    cols = {c: np.full(len(g), np.nan) for c in
            ["p_true_dow", "p_sunday", "pred_dow", "p_weekend", "pred_weekend", "anomaly"]}
    bi = np.where(base)[0]
    for tr, te in make_cv().split(X[bi], groups=g["week"].values[bi]):
        tr, te = bi[tr], bi[te]
        res = _fit_predict(X[tr], dow[tr], wk[tr], t[tr], X[te], dow[te], t[te])
        for c, v in res.items():
            cols[c][te] = v
    other = np.where(~base)[0]
    if len(other):
        res = _fit_predict(X[bi], dow[bi], wk[bi], t[bi], X[other], dow[other], t[other])
        for c, v in res.items():
            cols[c][other] = v
    for c, v in cols.items():
        g[c] = v
    g["confusion"] = 1 - g["p_true_dow"]
    # thresholds: 95th percentile of this station's (out-of-fold) normal days
    for c in ["confusion", "anomaly"]:
        g[f"{c}_flag"] = g[c] > np.nanquantile(g.loc[base, c], 0.95)
    return g
