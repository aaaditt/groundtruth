"""Tests for the live models (groundtruth/live.py, src/train_live.py). Real data only:
real calendar dates, and the committed outputs/tables/live_days.csv built from
MUSTANG by src/train_live.py."""
import os

import numpy as np
import pandas as pd
import pytest

from groundtruth import live
from groundtruth.models import FEATURES, load

REPO = os.path.join(os.path.dirname(__file__), "..")
DAYS = os.path.join(REPO, "outputs", "tables", "live_days.csv")
TABLE = os.path.join(REPO, "outputs", "tables", "live_models.csv")


def _blank(dates):
    """A features frame with real dates and no feature values: label_days only looks at dates."""
    return pd.DataFrame(index=pd.DatetimeIndex(pd.to_datetime(dates), name="date"))


def test_labels_follow_the_published_rules():
    d = live.label_days(_blank(["2025-12-25", "2025-12-29", "2026-03-10", "2026-03-14"]), "BE")
    assert list(d["period"]) == ["holiday", "festive", "baseline", "baseline"]
    assert list(d["is_weekend"]) == [0, 0, 0, 1]


def test_uae_weekend_rule_is_date_aware():
    # Friday 2021-12-31 was a weekend day in the UAE; Friday 2022-01-07 was not.
    d = live.label_days(_blank(["2021-12-31", "2022-01-07", "2022-01-09"]), "AE")
    assert list(d["is_weekend"]) == [1, 0, 1]


def test_weeks_from_different_years_are_different_groups():
    d = live.label_days(_blank(["2025-10-01", "2026-09-30"]), "BE")
    assert d.index[0].isocalendar().week == d.index[1].isocalendar().week == 40
    assert d["week_id"].iloc[0] != d["week_id"].iloc[1]


@pytest.fixture(scope="module")
def days():
    if not os.path.exists(DAYS):
        pytest.skip("run src/train_live.py first")
    return load(DAYS)


def test_training_window_is_respected(days):
    assert days["date"].min() >= pd.Timestamp(live.TRAIN_START)
    assert days["date"].max() < pd.Timestamp(live.TRAIN_END)


def test_level_is_scaled_on_baseline_days_only(days):
    for _, g in days.groupby("station"):
        base = g.loc[g["period"] == "baseline", "level"]
        assert abs(base.median()) < 1e-6          # median of the reference = 0 by construction


def test_published_live_scores_reproduce(days):
    table = pd.read_csv(TABLE).set_index("station")
    for st, g in days.groupby("station"):
        g = g.set_index("date")
        got = live.evaluate(g)
        assert got["weekend_bal_acc"] == pytest.approx(table.loc[st, "weekend_bal_acc"], abs=1e-9)
        assert got["dow_acc"] == pytest.approx(table.loc[st, "dow_acc"], abs=1e-9)
        assert np.isfinite(g[FEATURES].values).all()
