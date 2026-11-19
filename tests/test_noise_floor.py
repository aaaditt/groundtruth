"""Tests for the learned noise floor (groundtruth/noisefloor.py), all on real data: the
vendored 15-minute RMS of Mammoth Lakes (NC.MCY) and the committed daily table."""
import os
import sys

import numpy as np
import pandas as pd
import pytest

from groundtruth.models import load
from groundtruth.noisefloor import (load_raw_log_rms, score_out_of_fold, fit_floor, apply_floor,
                                    window_max, quiet_mask, _ns, mcnemar_exact)

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
REPO = os.path.join(os.path.dirname(__file__), "..")
RMS = os.path.join(REPO, "data", "external", "2020_Science_GlobalQuieting", "PaperZero_RMS",
                   "NC.MCY..EHZ.csv")
TZ = "America/Los_Angeles"


@pytest.fixture(scope="module")
def mcy():
    x = load_raw_log_rms(RMS, TZ)
    days = load()
    base = set(days.loc[(days["station"] == "NC.MCY") & (days["period"] == "baseline"), "date"].dt.date)
    on_base = pd.Series(np.isin(x.index.date, list(base)), index=x.index)
    return x, on_base, score_out_of_fold(x, on_base)


def test_loud_samples_are_kept(mcy):
    """features.clean_rms drops samples > 100x the median; an earthquake is exactly such a
    burst, so the noise-floor loader must keep them (and only drop impossible values)."""
    x, _, _ = mcy
    raw = pd.read_csv(RMS, index_col=0)["4.0-14.0"]
    raw = raw[(raw > 0) & np.isfinite(raw)]
    assert x.max() == pytest.approx(np.log10(raw.max()))
    assert (x > np.log10(raw.median() / 100)).all()


def test_learned_score_is_out_of_fold(mcy):
    """Each baseline sample's learned score must come from a floor fitted WITHOUT its own
    week. Rebuild every fold independently: no week may be on both sides, and refitting
    on the training weeks must reproduce every stored score exactly."""
    from sklearn.model_selection import GroupKFold
    x, on_base, sc = mcy
    base = x[on_base]
    iso = base.index.isocalendar()
    weeks = (iso["year"].astype(int) * 100 + iso["week"].astype(int)).values
    for tr, te in GroupKFold(5).split(base, groups=weeks):
        assert not set(weeks[tr]) & set(weeks[te])            # no week on both sides
        _, z = apply_floor(base.iloc[te], fit_floor(base.iloc[tr]))
        got = sc.loc[z.index, "learned"]
        assert np.allclose(got.values, z.values, equal_nan=True)
    # and it is NOT what an in-sample floor (one that saw every week) would give
    _, z_all = apply_floor(base, fit_floor(base))
    assert not np.allclose(sc.loc[base.index, "learned"].values, z_all.values, equal_nan=True)


def test_time_units_do_not_matter():
    """pandas can store times in micro- or nanoseconds; _ns must give the same numbers."""
    t = pd.DatetimeIndex(["2020-01-15 08:00:00+00:00", "2020-01-15 08:15:00+00:00"])
    assert (_ns(t.as_unit("us")) == _ns(t.as_unit("ns"))).all()
    assert _ns(t)[1] - _ns(t)[0] == pd.Timedelta("15min").value


def test_window_max_and_quiet(mcy):
    _, on_base, sc = mcy
    s = sc.loc[on_base, "raw"]
    t = s.index[100:101]
    expect = s[(s.index >= t[0] - pd.Timedelta("30min")) & (s.index <= t[0] + pd.Timedelta("30min"))].max()
    assert window_max(s, t)[0] == pytest.approx(expect)
    # a sample 45 minutes from an "event" is not quiet at a 1-hour gap, but is at 30 min
    ev = pd.DatetimeIndex([t[0] + pd.Timedelta("45min")])
    assert not quiet_mask(t, ev, gap=pd.Timedelta("1h"))[0]
    assert quiet_mask(t, ev, gap=pd.Timedelta("30min"))[0]


def test_thresholds_give_about_one_percent_false_alarms(mcy):
    """At the 99th percentile of quiet windows, ~1% of those windows exceed the threshold."""
    _, on_base, sc = mcy
    s = sc.loc[on_base & sc["learned"].notna(), "learned"]
    w = window_max(s, s.index)
    thr = np.nanpercentile(w, 99)
    assert 0.005 <= np.mean(w > thr) <= 0.015


def test_mcnemar():
    assert mcnemar_exact(0, 0) == 1.0
    assert mcnemar_exact(10, 10) == pytest.approx(1.0)
    assert mcnemar_exact(15, 2) < 0.01
