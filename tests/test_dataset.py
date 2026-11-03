"""Checks on the committed dataset (data/processed/daily_features.csv) and on the
cross-validation rules that keep the evaluation honest."""
import numpy as np
import pandas as pd
import pytest

from groundtruth.calendars import load_weekend_rules, is_weekend
from groundtruth.models import load, make_cv, FEATURES


@pytest.fixture(scope="module")
def df():
    return load()


def test_one_row_per_station_day(df):
    assert not df.duplicated(["station", "date"]).any()


def test_no_missing_features(df):
    assert df[FEATURES].notna().all().all()


def test_data_spans_less_than_a_year(df):
    # `week` is the ISO week number WITHOUT the year (see groundtruth/models.py).
    # Safe only while no week number can repeat. When multi-year data arrives this
    # fails, and the week id must become (year, week) -- a deliberate change.
    assert (df["date"].max() - df["date"].min()).days < 364


def test_period_precedence(df):
    # lockdown > holiday > festive > baseline (src/build_dataset.py)
    ny = df[df["station"] == "AM.R7885"].set_index("date")["period"]
    assert ny["2019-11-28"] == "holiday"    # Thanksgiving
    assert ny["2019-12-25"] == "holiday"    # Christmas Day beats the festive window
    assert ny["2019-12-27"] == "festive"
    assert ny["2020-03-11"] == "baseline"
    assert ny["2020-03-12"] == "lockdown"   # Table S1 lockdown date for New York


def test_weekend_labels_match_the_calendar(df):
    rules = load_weekend_rules()
    for (st, iso2), g in df.groupby(["station", "country_code"]):
        assert (g["is_weekend"].values == is_weekend(g["date"], iso2, rules)).all(), st


@pytest.mark.parametrize("station", ["AM.R7885", "HL.ATH", "BE.UCC"])
def test_week_held_out_cv_never_leaks(df, station):
    """Per-station CV: no calendar week may appear in both training and test."""
    g = df[(df["station"] == station) & (df["period"] == "baseline")]
    weeks = g["week"].values
    for train, test in make_cv().split(g[FEATURES], groups=weeks):
        assert not set(weeks[train]) & set(weeks[test])


def test_global_cv_tests_only_unseen_stations(df):
    b = df[df["period"] == "baseline"]
    st = b["station"].values
    for train, test in make_cv().split(b[FEATURES], groups=st):
        assert not set(st[train]) & set(st[test])


def test_training_days_are_baseline_only(df):
    # Holidays and lockdown are what we test detection ON; they must never be trained on.
    base = df[df["period"] == "baseline"]
    assert base["is_public_holiday"].eq(0).all()
    assert (pd.to_datetime(base["date"]) < pd.to_datetime(base["lockdown_date"])).all()
