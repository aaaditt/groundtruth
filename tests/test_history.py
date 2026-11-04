"""The globe page's history: the "vs recent normal" metric, and the published file.
Real data only: the committed pilot table (outputs/tables/history_days.csv.gz, MUSTANG,
Brussels 2019-2026) and site/data/history.json written by src/history.py."""
import json
import os

import numpy as np
import pandas as pd
import pytest

from groundtruth.history import MIN_REF, WEEKS, relative_change

REPO = os.path.join(os.path.dirname(__file__), "..")
PILOT = os.path.join(REPO, "outputs", "tables", "history_days.csv.gz")
SITE = os.path.join(REPO, "site", "data", "history.json")


@pytest.fixture(scope="module")
def brussels():
    d = pd.read_csv(PILOT, parse_dates=["date"], keep_default_na=False,
                    usecols=["date", "station", "level_raw", "period"])
    return d[d["station"] == "BE.UCC..HHZ"].set_index("date")


def by_hand(d, day):
    refs = [day - pd.Timedelta(weeks=k) for k in range(1, WEEKS + 1)]
    lv = [d.loc[r, "level_raw"] for r in refs if r in d.index and d.loc[r, "period"] == "baseline"]
    return 100 * (10 ** (d.loc[day, "level_raw"] - np.median(lv)) - 1), refs


def test_matches_a_hand_calculation(brussels):
    day = pd.Timestamp("2020-12-25")                        # Christmas Day, Brussels
    got = relative_change(brussels.loc["2020-10-01":"2021-01-31"]).loc[day]
    want, _ = by_hand(brussels, day)
    assert got == pytest.approx(want, rel=1e-12)
    assert got < -15                                       # and it was clearly quieter


def test_holidays_are_never_reference_days(brussels):
    # 1 Jan 2021 is a Friday; 25 Dec 2020 (a holiday Friday) lies in its 8-week window.
    day = pd.Timestamp("2021-01-01")
    _, refs = by_hand(brussels, day)
    assert pd.Timestamp("2020-12-25") in refs
    assert brussels.loc["2020-12-25", "period"] == "holiday"
    got = relative_change(brussels.loc["2020-10-01":"2021-01-31"]).loc[day]
    want, _ = by_hand(brussels, day)                       # by_hand skips non-baseline days
    assert got == pytest.approx(want, rel=1e-12)


def test_a_day_never_uses_itself_or_the_future(brussels):
    # Changing a day's own level, or any later day, must not change its reference.
    window = brussels.loc["2022-01-01":"2022-04-30"].copy()
    day = pd.Timestamp("2022-03-16")
    before = relative_change(window).loc[day]
    window.loc[window.index > day, "level_raw"] += 1.0
    assert relative_change(window).loc[day] == pytest.approx(before, rel=1e-12)


def test_not_enough_reference_gives_no_value(brussels):
    first = brussels.index.min()
    out = relative_change(brussels.loc[first:first + pd.Timedelta(days=13)])
    assert out.isna().all()                                # at most 1 earlier same weekday


@pytest.fixture(scope="module")
def site():
    with open(SITE, encoding="utf-8") as f:
        return json.load(f)


def test_site_file_is_consistent(site):
    n = len(site["stations"][0]["values"])
    days = (pd.Timestamp(site["end_exclusive"]) - pd.Timestamp(site["start"])).days
    assert n == days
    assert site["weeks"] == WEEKS and site["min_ref"] == MIN_REF
    for s in site["stations"]:
        assert len(s["values"]) == n
        assert -90 <= s["lat"] <= 90 and -180 <= s["lon"] <= 180
        assert all(v is None or abs(v) <= site["clip_pct"] for v in s["values"])
        assert all(0 <= int(k) < n for k in s["holidays"])


def test_site_uses_official_coordinates(site):
    # Table S1 puts Nilore in Paraguay and Davao in Malaysia; the site must not.
    st = {s["id"]: s for s in site["stations"]}
    nil, dav = st["II.NIL.10.BHZ"], st["IU.DAV.00.BHZ"]
    assert 33 < nil["lat"] < 34.5 and 72.5 < nil["lon"] < 74      # near Islamabad
    assert 6.5 < dav["lat"] < 7.5 and 125 < dav["lon"] < 126       # Davao, Mindanao
