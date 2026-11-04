"""Stage 4 tests, all on real data (the committed dataset and committed real-data tables)."""
import os
import sys

import numpy as np
import pandas as pd
import pytest

from groundtruth.detect import score_station
from groundtruth.models import load, make_model, FEATURES

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
from holiday_holdout import holiday_type  # noqa: E402
from uae_experiment import weekly, exact_perm, SUN  # noqa: E402

REPO = os.path.join(os.path.dirname(__file__), "..")


@pytest.fixture(scope="module")
def brussels():
    df = load()
    return score_station(df[df["station"] == "BE.UCC"])


def test_every_day_is_scored(brussels):
    for c in ["confusion", "anomaly", "p_sunday", "p_weekend"]:
        assert brussels[c].notna().all(), c
    assert ((brussels["confusion"] >= 0) & (brussels["confusion"] <= 1)).all()


def test_normal_day_flag_rate_is_about_five_percent(brussels):
    # thresholds are the 95th percentile of normal days, so ~5% of them get flagged
    base = brussels[brussels["period"] == "baseline"]
    for c in ["confusion_flag", "anomaly_flag"]:
        assert 0.03 <= base[c].mean() <= 0.07, c


def test_normal_days_are_scored_out_of_fold(brussels):
    """A model that has SEEN a day is more sure about it. Scoring normal days in-sample
    would make them look too normal; the out-of-fold confusion must be clearly higher."""
    base = brussels[brussels["period"] == "baseline"]
    m = make_model().fit(base[FEATURES].values, base["day_of_week"].values)
    p_in = m.predict_proba(base[FEATURES].values)[np.arange(len(base)), base["day_of_week"].values]
    assert (1 - p_in).mean() < base["confusion"].mean() - 0.1


def test_holidays_are_more_confusing_than_normal_days(brussels):
    wd = brussels[brussels["is_weekend"] == 0]
    assert wd.loc[wd["period"] == "holiday", "confusion"].mean() > wd.loc[wd["period"] == "baseline", "confusion"].mean()


@pytest.mark.parametrize("name,expected", [
    ("Christmas Day", "Christmas & Easter"),
    ("Good Friday", "Christmas & Easter"),
    ("Thanksgiving Day", "civic / national"),
    ("Martin Luther King Jr. Day", "civic / national"),
    ("Chinese New Year", "new year"),
    ("Epiphany", "other religious"),
    ("Holi", "other religious"),
    ("Substitute Holiday", "other"),      # must NOT match the festival "Holi"
    ("Public Holiday", "other"),
])
def test_holiday_types(name, expected):
    assert holiday_type(name) == expected


def test_uae_result_reproduces_from_committed_daily_activity():
    """Recompute the pre-registered statistic from the committed daily table and check it
    matches the committed result table (no network needed)."""
    act = pd.read_csv(os.path.join(REPO, "outputs", "tables", "uae_daily_activity.csv"),
                      index_col=0, parse_dates=[0, "monday"])
    res = pd.read_csv(os.path.join(REPO, "outputs", "tables", "uae_experiment.csv"))
    main = act[act["analysis"] == "main"]
    w = weekly(main, SUN)
    obs, p1, _, _ = exact_perm(w["S"], w["after"])
    row = res[res["analysis"] == "main (real change)"].iloc[0]
    assert obs == pytest.approx(row["Sun_delta_log10"], abs=1e-9)
    assert p1 == pytest.approx(row["Sun_p_one_sided"], abs=1e-9)
    assert obs < 0
