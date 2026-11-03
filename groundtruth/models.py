"""Shared model settings: the feature list, the model, the cross-validation splitter,
and loading the processed dataset.

Every experiment script imports these from here, so "the model" and "the way we test
it" are defined exactly once. If you change make_model() or make_cv(), every number in
the project changes -- rerun run_all.sh and update the docs.
"""
import os
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GroupKFold

from groundtruth.features import SHAPE_COLS, DAY_NAMES  # noqa: F401  (re-exported)

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA = os.path.join(REPO, "data", "processed", "daily_features.csv")
FEATURES = SHAPE_COLS + ["level"]
SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def week_id(dates):
    """Year-aware week label, e.g. 202003 = ISO week 3 of 2020. Use this for any data
    that can span more than a year (all recent / live data)."""
    iso = pd.DatetimeIndex(dates).isocalendar()
    return (iso["year"].astype(int) * 100 + iso["week"].astype(int)).values


def load(path=DATA):
    """The Lecocq-based dataset behind the published results.

    `week` here is the ISO week NUMBER without the year, kept exactly as it was so the
    published numbers reproduce (GroupKFold's fold assignment depends on the labels).
    For this data it groups days identically to week_id(): tests/test_dataset.py
    checks that. New multi-year data must use week_id()."""
    df = pd.read_csv(path, parse_dates=["date"])
    df["week"] = df["date"].dt.isocalendar().week.astype(int)
    return df


def make_model(seed=0):
    # 100 trees, small leaves: a sturdy default that needs no feature scaling
    return RandomForestClassifier(n_estimators=100, min_samples_leaf=2, random_state=seed, n_jobs=1)


def make_cv():
    """5-fold cross-validation that keeps each GROUP together.

    Per-station models pass groups = week, so a whole calendar week is either all
    training or all testing (consecutive days are alike; splitting a week would leak).
    The global model passes groups = station, so it is always tested on unseen cities."""
    return GroupKFold(5)
