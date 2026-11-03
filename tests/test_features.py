"""Feature extraction, tested on a real two-week excerpt from New York (AM.R7885).

The most dangerous bug in this project is getting LOCAL time wrong: rush hour would
land in the wrong hour column and the model would learn garbage. These tests pin it.
"""
import os

import numpy as np
import pandas as pd
import pytest

from groundtruth.features import load_station_rms, daily_features, SHAPE_COLS
from groundtruth.models import DATA

FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures", "AM.R7885_2020-03-01_2020-03-16.csv")
TZ = "US/Eastern"  # from Table S1


@pytest.fixture(scope="module")
def rms():
    return load_station_rms(FIXTURE, TZ)


@pytest.fixture(scope="module")
def days(rms):
    return daily_features(rms)


def test_timestamps_become_local_time(rms):
    # 2020-03-02 15:29:58 UTC is in winter time (UTC-5) -> 10:29:58 in New York
    t = rms.index[rms.index.tz_convert("UTC") >= pd.Timestamp("2020-03-02 15:29", tz="UTC")][0]
    assert (t.hour, t.minute) == (10, 29)
    # 2020-03-10 15:29:58 UTC is in summer time (UTC-4) -> 11:29:58 in New York
    t = rms.index[rms.index.tz_convert("UTC") >= pd.Timestamp("2020-03-10 15:29", tz="UTC")][0]
    assert (t.hour, t.minute) == (11, 29)


def test_daylight_saving_day_is_kept(rms, days):
    # On 2020-03-08 clocks jumped 02:00 -> 03:00: the local hour 02 never existed.
    on_dst_day = rms[rms.index.date == pd.Timestamp("2020-03-08").date()]
    assert 2 not in set(on_dst_day.index.hour)
    assert len(set(on_dst_day.index.hour)) == 23
    # ...but 23 hours is >= the 20-hour minimum, so the day survives (hour 02 is
    # filled by interpolating its neighbours).
    assert pd.Timestamp("2020-03-08") in days.index
    assert days.loc["2020-03-08", SHAPE_COLS].notna().all()


def test_partial_edge_days_are_dropped(days):
    # The excerpt starts at 00:00 UTC on 1 March = 19:00 on 29 Feb in New York:
    # only 5 local hours of 29 Feb, so that day must be dropped, not half-counted.
    assert pd.Timestamp("2020-02-29") not in days.index
    assert pd.Timestamp("2020-03-16") not in days.index
    assert list(days.index) == list(pd.date_range("2020-03-01", "2020-03-15"))


def test_shape_is_relative_to_the_day(days):
    # shape = hourly log-level minus the day's mean, so every row averages to zero.
    # This is what stops the model learning "this sensor is loud" instead of rhythm.
    assert np.allclose(days[SHAPE_COLS].mean(axis=1), 0, atol=1e-12)


def test_day_of_week_is_local(days):
    assert days.loc["2020-03-02", "day_of_week"] == 0   # a Monday
    assert days.loc["2020-03-08", "day_of_week"] == 6   # a Sunday


def test_matches_committed_dataset(days):
    """Recompute the features from the raw excerpt and compare with the committed
    data/processed/daily_features.csv. If these drift apart, the published numbers no
    longer come from the code in this repository."""
    ref = pd.read_csv(DATA, parse_dates=["date"])
    ref = ref[ref["station"] == "AM.R7885"].set_index("date").loc[days.index]
    np.testing.assert_allclose(days[SHAPE_COLS].values, ref[SHAPE_COLS].values, rtol=0, atol=1e-9)
    np.testing.assert_allclose(days["level_raw"].values, ref["level_raw"].values, rtol=0, atol=1e-9)
