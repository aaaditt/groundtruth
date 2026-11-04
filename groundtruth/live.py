"""live.py -- per-station "live" models trained on recent MUSTANG data (Route A).

The published results use the Lecocq et al. (2020) data from 2019-20. The dashboard
needs models that know what each city sounds like NOW. So for each live station in
config/stations.yaml we:

  1. download 12 months of MUSTANG spectra (groundtruth.mustang, cached, compressed),
  2. turn them into the same 25 daily features as the published work
     (groundtruth.features: 24-hour shape + level),
  3. label each day with the SAME rules as src/build_dataset.py:
        holiday  = official public holiday (national calendar)
        festive  = 21 Dec - 6 Jan, other days
        baseline = everything else  <- the only days a model trains on
  4. train a weekday/weekend model and an exact-day model on baseline days, and
     score them honestly: whole weeks held out (GroupKFold on week_id), balanced
     accuracy for weekday vs weekend.

Rule (docs/12-master-plan.md): MUSTANG data is never mixed with Lecocq data in a
model. Each live model sees one station, one source.
"""
from dataclasses import dataclass
from datetime import date

import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, balanced_accuracy_score
from sklearn.model_selection import cross_val_predict

from groundtruth.calendars import is_weekend, load_weekend_rules, public_holidays
from groundtruth.features import SHAPE_COLS, clean_rms, daily_features
from groundtruth.models import FEATURES, make_cv, make_model, week_id
from groundtruth.mustang import rms_series

# The 12 most recent COMPLETE months when the models were built (2026-11-04).
# MUSTANG back-fills late data for ~10 days, so October 2026 was not final yet.
# Fixed (not "today minus a year") so the numbers in the docs reproduce exactly.
TRAIN_START, TRAIN_END = date(2025, 10, 1), date(2026, 10, 1)
MODEL_VERSION = "live-1"


def robust_scale(values, ref):
    """Robust z-score of `values` against the reference sample `ref` (median / MAD),
    clipped to +-10 -- the same scaling build_dataset.py uses for `level`."""
    mad = 1.4826 * (ref - ref.median()).abs().median() + 1e-9
    return ((values - ref.median()) / mad).clip(-10, 10)


def label_days(feats, country, rules=None):
    """Add is_weekend, holiday_name, period and week_id, exactly as build_dataset.py
    does for the published data (minus lockdown, which has no meaning here)."""
    rules = load_weekend_rules() if rules is None else rules
    d = feats.copy()
    d["is_weekend"] = is_weekend(d.index, country, rules)
    cal = public_holidays(country, None, sorted(set(d.index.year)))
    d["holiday_name"] = [cal.get(t.date(), "") for t in d.index]
    festive = ((d.index.month == 12) & (d.index.day >= 21)) | ((d.index.month == 1) & (d.index.day <= 6))
    d["period"] = np.select([d["holiday_name"].values != "", festive],
                            ["holiday", "festive"], default="baseline")
    d["week_id"] = week_id(d.index)
    return d


def station_days(station, start=TRAIN_START, end=TRAIN_END):
    """One row per local day for a live station: 25 features + labels.
    `level` is scaled against this station's own baseline days in [start, end)."""
    s = rms_series(station.id, start, end)
    if s.empty:
        return pd.DataFrame()
    s.index = s.index.tz_convert(station.timezone)
    d = label_days(daily_features(clean_rms(s)), station.country)
    # The first/last local day can be cut off by the UTC download window; drop them
    # if they fall outside [start, end).
    d = d[(d.index >= pd.Timestamp(start)) & (d.index < pd.Timestamp(end))]
    base = d["period"] == "baseline"
    d["level"] = robust_scale(d["level_raw"], d.loc[base, "level_raw"])
    return d


@dataclass
class LiveModel:
    """Everything the dashboard needs to score a new day for one station."""
    station_id: str
    version: str
    train_start: date
    train_end: date
    weekend_model: object      # 2 classes: 0 = working day, 1 = weekend
    dow_model: object          # 7 classes: 0 = Monday ... 6 = Sunday
    level_median: float        # to scale a new day's level_raw like the training days
    level_mad: float
    n_train_days: int


def evaluate(d):
    """Honest scores on baseline days: whole weeks held out. Returns a dict."""
    b = d[d["period"] == "baseline"]
    X, groups = b[FEATURES].values, b["week_id"].values
    yw, yd = b["is_weekend"].values, b["day_of_week"].values
    pw = cross_val_predict(make_model(), X, yw, groups=groups, cv=make_cv())
    pd_ = cross_val_predict(make_model(), X, yd, groups=groups, cv=make_cv())
    return {"weekend_bal_acc": balanced_accuracy_score(yw, pw),
            "dow_acc": accuracy_score(yd, pd_)}


def train(station, d):
    """Fit the final models on ALL baseline days of the window."""
    b = d[d["period"] == "baseline"]
    ref = b["level_raw"]
    mad = 1.4826 * (ref - ref.median()).abs().median() + 1e-9
    wm = make_model().fit(b[FEATURES].values, b["is_weekend"].values)
    dm = make_model().fit(b[FEATURES].values, b["day_of_week"].values)
    return LiveModel(station.id, MODEL_VERSION, TRAIN_START, TRAIN_END, wm, dm,
                     float(ref.median()), float(mad), len(b))


def coverage_by_month(d, start=TRAIN_START, end=TRAIN_END):
    """Number of usable days per calendar month (so gaps are visible, not hidden)."""
    months = pd.period_range(start, pd.Timestamp(end) - pd.Timedelta(days=1), freq="M")
    got = d.index.to_period("M").value_counts()
    return {str(m): int(got.get(m, 0)) for m in months}


__all__ = ["TRAIN_START", "TRAIN_END", "MODEL_VERSION", "LiveModel", "station_days",
           "label_days", "evaluate", "train", "coverage_by_month", "robust_scale", "SHAPE_COLS"]
