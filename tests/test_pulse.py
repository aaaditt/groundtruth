"""Tests for the City Pulse scorer (groundtruth/pulse.py) and its published output.
Real data only: the committed live_days.csv (MUSTANG, Oct 2025 - Sep 2026) and the
committed site/data/pulse.json."""
import json
import os

import numpy as np
import pandas as pd
import pytest

from groundtruth import live, pulse
from groundtruth.models import load

REPO = os.path.join(os.path.dirname(__file__), "..")
DAYS = os.path.join(REPO, "outputs", "tables", "live_days.csv")
PULSE = os.path.join(REPO, "site", "data", "pulse.json")


@pytest.fixture(scope="module")
def brussels():
    """Pretend Brussels' model was trained up to 1 Aug 2026 and Aug-Sep are 'new'."""
    d = load(DAYS)
    d = d[d["station"] == "BE.UCC..HHZ"]
    cut = pd.Timestamp("2026-08-01")
    train = d[d["date"] < cut]
    new = d[d["date"] >= cut].set_index("date")
    return train, new, pulse.score_new(train, new)


def test_every_new_day_is_scored(brussels):
    _, new, (scored, _) = brussels
    assert len(scored) == len(new)
    assert (scored["period"] == "live").all()          # new days can never be training data
    assert scored["calendar"].isin(["baseline", "holiday", "festive"]).all()


def test_probabilities_are_consistent(brussels):
    _, _, (scored, _) = brussels
    P = scored[[f"p_{k}" for k in range(7)]].values
    assert np.allclose(P.sum(1), 1)
    # the 7 probabilities shown on the card come from the same model as pred_dow
    assert (P.argmax(1) == scored["pred_dow"].values).all()


def test_thresholds_exist_for_both_detectors(brussels):
    train, _, (_, thr) = brussels
    assert set(thr) == {"confusion", "anomaly"}
    assert all(np.isfinite(v) for v in thr.values())


def test_day_record_is_plain_json(brussels):
    _, _, (scored, _) = brussels
    rec = pulse.day_record(scored.iloc[0])
    rec["summary"] = pulse.describe(rec)
    json.dumps(rec)
    assert len(rec["probs"]) == 7


def test_published_pulse_file():
    if not os.path.exists(PULSE):
        pytest.skip("run src/pulse.py first")
    with open(PULSE, encoding="utf-8") as f:
        doc = json.load(f)
    assert doc["train_window"] == [str(live.TRAIN_START), str(live.TRAIN_END)]
    for st in doc["stations"]:
        dates = [d["date"] for d in st["days"]]
        assert dates == sorted(dates)
        assert all(x >= str(live.TRAIN_END) for x in dates)     # only days the model never saw
        if st["status"] != "live":
            assert st["days"] == []                             # offline means no data, never a guess
