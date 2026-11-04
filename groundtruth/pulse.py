"""pulse.py -- score NEW days for the City Pulse dashboard.

For one live station:
  1. the training days are the committed outputs/tables/live_days.csv
     (1 Oct 2025 - 30 Sep 2026, built by src/train_live.py);
  2. new days (from 1 Oct 2026 on) are downloaded from MUSTANG and turned into the
     same 25 features, with `level` scaled against the TRAINING normal days;
  3. both go through groundtruth.detect.score_station, the same honest scorer used for
     the published results (Result 8): new days are scored by models fitted on all
     training normal days, and flags are set at the 95th percentile of the training
     days' OUT-OF-FOLD scores. So "flagged" means "more unusual than 95% of normal
     days were, when the model had not seen them".

New days are labelled period = "live" so they can never be used for training. Their
calendar label (normal / holiday / festive) is kept in `calendar`.
"""
import numpy as np
import pandas as pd

from groundtruth import live
from groundtruth.detect import score_station
from groundtruth.models import FEATURES, make_model

DOW_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def score_new(train, new):
    """train: one station's rows from live_days.csv (with a `date` column).
    new: the same station's new days (from live.station_days, date index).
    Returns (scored new days, thresholds)."""
    train = train.copy()
    new = new.reset_index().copy()
    new["calendar"] = new["period"]
    new["period"] = "live"                       # never training data
    g = pd.concat([train, new], ignore_index=True)
    g["week"] = g["week_id"]                     # year-aware weeks for this multi-year data
    s = score_station(g)
    base = s["period"] == "baseline"
    thresholds = {c: float(np.nanquantile(s.loc[base, c], 0.95)) for c in ["confusion", "anomaly"]}
    out = s[s["period"] == "live"].copy()
    # full 7-day probabilities for the dashboard card. Same model score_station fits for
    # non-training days (all normal days, random_state=0), so the numbers agree.
    b = s[base]
    m7 = make_model().fit(b[FEATURES].values, b["day_of_week"].values)
    P = np.zeros((len(out), 7))
    if len(out):
        P[:, m7.classes_] = m7.predict_proba(out[FEATURES].values)
    for k in range(7):
        out[f"p_{k}"] = P[:, k]
    return out.reset_index(drop=True), thresholds


def day_record(r):
    """One scored day -> a small dict for the website."""
    return {
        "date": r["date"].strftime("%Y-%m-%d"),
        "dow": int(r["day_of_week"]),
        "is_weekend": int(r["is_weekend"]),
        "calendar": r["calendar"],
        "holiday": r["holiday_name"] if isinstance(r["holiday_name"], str) else "",
        "pred_dow": int(r["pred_dow"]),
        "p_true_dow": round(float(r["p_true_dow"]), 3),
        "p_weekend": round(float(r["p_weekend"]), 3),
        "probs": [round(float(r[f"p_{k}"]), 3) for k in range(7)],
        "confusion": round(float(r["confusion"]), 3),
        "anomaly": round(float(r["anomaly"]), 3),
        "confusion_flag": bool(r["confusion_flag"]),
        "anomaly_flag": bool(r["anomaly_flag"]),
    }


def describe(r):
    """Plain-language one-liner for a day, e.g. 'Looked like a Sunday (61%) -- it was a
    Thursday, a public holiday (Thanksgiving)'."""
    guess, true = DOW_NAMES[r["pred_dow"]], DOW_NAMES[r["dow"]]
    p = r["probs"][r["pred_dow"]]
    s = f"Looked like a {guess} ({p:.0%})"
    s += " -- correct." if r["pred_dow"] == r["dow"] else f" -- it was a {true}."
    if r["holiday"]:
        s += f" Public holiday: {r['holiday']}."
    if r["anomaly_flag"] or r["confusion_flag"]:
        s += " Unusual day."
    return s


__all__ = ["score_new", "day_record", "describe", "DOW_NAMES", "live"]
