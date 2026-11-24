"""Tests for nightly walk-forward learning (groundtruth.pulse.score_walk_forward, docs/19).
Real data only: the committed live_days.csv. As in test_pulse.py, Brussels' model is
'trained' up to 1 Aug 2026 and Aug-Sep 2026 play the new days."""
import pandas as pd
import pytest

from groundtruth import pulse
from groundtruth.models import load
from test_pulse import DAYS


@pytest.fixture(scope="module")
def split():
    d = load(DAYS)
    d = d[d["station"] == "BE.UCC..HHZ"]
    cut = pd.Timestamp("2026-08-01")
    train = d[d["date"] < cut]
    new = d[d["date"] >= cut].set_index("date")
    new = new[new.index < pd.Timestamp("2026-08-29")]     # four weeks keeps the test quick
    return train, new


@pytest.fixture(scope="module")
def walked(split):
    return pulse.score_walk_forward(*split)


def test_every_new_day_is_scored_once(split, walked):
    _, new = split
    assert len(walked) == len(new)
    assert walked["date"].is_unique


def test_first_day_matches_the_frozen_model(split, walked):
    """Nothing has been learned before the first new day, so it must agree with score_new."""
    scored, _ = pulse.score_new(*split)
    first = scored.sort_values("date").iloc[0]
    assert walked.iloc[0]["learn_pred_dow"] == first["pred_dow"]
    assert walked.iloc[0]["learn_p_weekend"] == pytest.approx(first["p_weekend"])


def test_predict_before_learn(split, walked):
    """Day t's guess must not change when every day after t is deleted: the model that
    scored t cannot have seen t or anything later."""
    train, new = split
    t = new.index[10]
    short = pulse.score_walk_forward(train, new[new.index <= t])
    a = walked.set_index("date").loc[t]
    b = short.set_index("date").loc[t]
    assert a["learn_pred_dow"] == b["learn_pred_dow"]
    assert a["learn_p_weekend"] == pytest.approx(b["learn_p_weekend"])


def test_only_ordinary_days_are_learned(split, walked):
    """The training set grows by one after each ordinary day and never after a holiday."""
    train, new = split
    base = (train["period"] == "baseline").sum()
    ordinary_before = (new["period"] == "baseline").cumsum().shift(fill_value=0).values
    assert (walked["learn_train_days"].values == base + ordinary_before).all()
