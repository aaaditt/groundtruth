"""Tests for the exact-weekday experiment (docs/15, groundtruth/weekday.py).

The fold tests use calendar dates only (no measurements). The table tests read the committed
outputs of src/weekday_experiment.py, which come from the real MUSTANG data."""
import os

import numpy as np
import pandas as pd
import pytest

from groundtruth import weekday as W

T = os.path.join(os.path.dirname(__file__), "..", "outputs", "tables")
START = "2019-01-01"
DATES = pd.date_range(START, "2026-09-29", freq="D")


def test_blocks_are_28_days_and_each_block_has_one_fold():
    b = W.block_of(DATES, START)
    assert b[0] == 0 and b[27] == 0 and b[28] == 1
    fold_of = W.block_folds(b)
    assert set(fold_of) == set(b) and set(fold_of.values()) == set(range(5))


def test_part_b_training_windows_never_touch_a_test_block():
    b = W.block_of(DATES, START)
    fold_of = W.block_folds(b)
    drop = W.window_touches_fold(DATES, START, fold_of)
    folds = np.array([fold_of[x] for x in b])
    for f in range(5):
        train = (folds != f) & ~drop[f]
        assert train.sum() > 0.7 * (folds != f).sum()      # the buffer drops only edge days
        for off in range(-W.HALF, W.HALF + 1):
            nb = W.block_of(DATES[train] + pd.Timedelta(days=off), START)
            assert not any(fold_of.get(x, -1) == f for x in nb)


def test_week_matrix_puts_neighbours_in_order_and_gaps_as_nan():
    idx = pd.DatetimeIndex(["2020-01-06", "2020-01-07", "2020-01-09"])
    d = pd.DataFrame({"x": idx.day.astype(float)}, index=idx)     # the value is the day of month
    m = W.week_matrix(d, ["x"])
    assert m.shape == (3, 7)
    row = m[1]                                                    # centred on 7 Jan
    assert row[3] == 7 and row[2] == 6 and row[5] == 9
    assert np.isnan(row[4]) and np.isnan(row[0])


def test_feature_sets_match_the_preregistration():
    s = W.feature_sets()
    assert [len(s[k]) for k in ["A0", "A1", "A2", "A3"]] == [25, 49, 75, 147]


def test_weekend_balanced_accuracy_uses_each_days_own_rule():
    # Sharjah: Fri/Sat before 2022, Sat/Sun after. A Friday guessed as Friday is a weekend
    # hit under the old rule and a weekday hit under the new one.
    a = W.accuracy_table([4, 4, 0, 6], [4, 4, 0, 6], [{4, 5}, {5, 6}, {4, 5}, {5, 6}])
    assert a["exact"] == 1 and a["weekend_bal"] == 1


def _table(name):
    p = os.path.join(T, name)
    if not os.path.exists(p):
        pytest.skip(f"{name} not built yet")
    return pd.read_csv(p)


def test_part_a_scores_every_config_on_the_same_days():
    a = _table("weekday_partA.csv")
    assert a.groupby("station")["n"].nunique().max() == 1
    assert a["config"].nunique() == 8


def test_part_b_scores_control_and_week_on_the_same_days():
    b = _table("weekday_partB.csv")
    assert set(b["config"]) == {"B0", "B"}
    assert b.groupby("station")["n"].nunique().max() == 1


def test_confusion_counts_match_the_station_tables():
    a, b, c = _table("weekday_partA.csv"), _table("weekday_partB.csv"), _table("weekday_confusion.csv")
    n = c.groupby("config")["count"].sum()
    assert n["A0-RF"] == a[a["config"] == "A0-RF"]["n"].sum()
    assert n["B-GB"] == b[b["config"] == "B"]["n"].sum()
    for cfg, g in c.groupby("config"):
        exact = g[g["true"] == g["pred"]]["count"].sum() / g["count"].sum()
        src, name = (a, cfg) if cfg.startswith("A") else (b, cfg.split("-")[0])
        rows = src[src["config"] == name]
        assert abs(exact - (rows["exact"] * rows["n"]).sum() / rows["n"].sum()) < 1e-3
