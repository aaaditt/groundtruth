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


def load(path=DATA):
    df = pd.read_csv(path, parse_dates=["date"])
    # NOTE: ISO week NUMBER only, no year. Fine for the Lecocq data (Oct 2019 - May
    # 2020, so no week number repeats), but on multi-year data week 10 of 2021 and
    # week 10 of 2022 would become one group. tests/test_dataset.py fails if the
    # data ever spans more than a year, so this gets fixed on purpose, not by accident.
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
