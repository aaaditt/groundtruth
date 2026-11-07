"""Ask the ground (site/data/ask/*.json, src/ask.py): every guess shown on the site must come
from a model that never trained on that day's week. These tests read the committed files and
tables only, all built from real MUSTANG data."""
import glob
import json
import os
from datetime import date, timedelta

import numpy as np
import pandas as pd
import pytest

from groundtruth import ask

ROOT = os.path.join(os.path.dirname(__file__), "..")
ASK = os.path.join(ROOT, "site", "data", "ask")
SCORES = os.path.join(ROOT, "outputs", "tables", "ask_scores.csv")


def files():
    out = {}
    for p in sorted(glob.glob(os.path.join(ASK, "*.json"))):
        with open(p, encoding="utf-8") as f:
            d = json.load(f)
        out[d["id"]] = d
    return out


FILES = files()


def day_date(f, i):
    return date.fromisoformat(f["start"]) + timedelta(days=i)


def test_one_file_per_history_station():
    with open(os.path.join(ROOT, "site", "data", "history.json"), encoding="utf-8") as f:
        hist = json.load(f)
    assert sorted(FILES) == sorted(s["id"] for s in hist["stations"])


@pytest.mark.parametrize("sid", sorted(FILES))
def test_each_week_sits_in_one_fold(sid):
    f = FILES[sid]
    folds = {}
    for i, shape, probs, period, hol, fold, level, *_ in f["days"]:
        if fold is None:
            continue
        iso = day_date(f, i).isocalendar()
        folds.setdefault(iso[0] * 100 + iso[1], set()).add(fold)
    assert folds, f"{sid}: no scored days"
    assert all(len(v) == 1 for v in folds.values()), f"{sid}: a week was split across folds"


@pytest.mark.parametrize("sid", sorted(FILES))
def test_probs_sum_to_100_and_unscored_days_have_no_probs(sid):
    for i, shape, probs, period, hol, fold, level, *_ in FILES[sid]["days"]:
        assert len(shape) == 24
        if probs is None:
            assert fold is None
        else:
            assert len(probs) == 7 and abs(sum(probs) - 100) <= 4
            assert fold in range(5)
            assert level is not None and -10 <= level <= 10   # scored days always have a level


def test_lockdown_window_never_baseline():
    seen = 0
    for f in FILES.values():
        for i, shape, probs, period, hol, fold, level, *_ in f["days"]:
            d = day_date(f, i)
            if date(2020, 3, 1) <= d <= date(2020, 6, 30):
                assert period == "lockdown"
                seen += 1
    assert seen > 1000


def test_scores_table_matches_files():
    t = pd.read_csv(SCORES).set_index("station")
    assert sorted(t.index) == sorted(FILES)
    for sid, f in FILES.items():
        rows = [(i, probs) for i, shape, probs, period, hol, fold, level, *_ in f["days"]
                if probs is not None and period == "baseline"]
        hits = [int(np.argmax(p)) == day_date(f, i).weekday() for i, p in rows]
        assert t.loc[sid, "n_scored_baseline"] == len(rows)
        assert abs(t.loc[sid, "dow_acc"] - np.mean(hits)) < 0.001


def test_weekend_flag_follows_the_rule_in_force():
    uae = [f for f in FILES.values() if f["country"] == "AE"]
    assert len(uae) == 1
    w = uae[0]["weekend"]
    assert w == [["2006-09-01", [4, 5]], ["2022-01-01", [5, 6]]]


def test_rolling_level_uses_only_earlier_baseline_days():
    # real Brussels days from the committed 2019-2026 day table
    h = pd.read_csv(os.path.join(ROOT, "outputs", "tables", "history_days.csv.gz"))
    b = h[h["city"] == "Brussels"].copy()
    b["date"] = pd.to_datetime(b["date"])
    b = b.set_index("date").sort_index().loc["2019-01-01":"2019-06-30"]
    lvl = ask.rolling_level(b)
    t = pd.Timestamp("2019-05-15")
    ref = b.loc[(b.index < t) & (b.index >= t - pd.Timedelta(days=56)) & (b["period"] == "baseline"), "level_raw"]
    mad = 1.4826 * (ref - ref.median()).abs().median() + 1e-9
    expect = float(np.clip((b.loc[t, "level_raw"] - ref.median()) / mad, -10, 10))
    assert abs(lvl.loc[t] - expect) < 1e-9
    assert lvl.iloc[:5].isna().all()          # the first days have too few earlier days


def test_lockdown_days_are_guessed():
    # the spring 2020 lockdown is the most interesting stretch to ask about; when the 8 weeks
    # before a day hold too few ordinary days, the level falls back to the last ordinary days
    have = guessed = 0
    for f in FILES.values():
        for i, shape, probs, period, hol, fold, level, *_ in f["days"]:
            if period == "lockdown":
                have += 1
                guessed += probs is not None
    assert guessed / have >= 0.9, f"only {guessed}/{have} lockdown days have a guess"


def test_ordinary_weekdays_read_as_weekend_matches_files():
    t = pd.read_csv(SCORES).set_index("station")
    for sid, f in FILES.items():
        def weekend(d):
            days = f["weekend"][0][1]
            for since, ds in f["weekend"]:
                if d.isoformat() >= since:
                    days = ds
            return days
        hits = []
        for i, shape, probs, period, hol, fold, level, *_ in f["days"]:
            d = day_date(f, i)
            if probs is None or period != "baseline" or d.weekday() in weekend(d):
                continue
            hits.append(sum(probs[k] for k in weekend(d)) >= 50)
        assert abs(t.loc[sid, "weekday_as_weekend"] - np.mean(hits)) < 0.001


def test_rolling_level_falls_back_to_the_last_ordinary_days():
    # real Brussels days; a 10-week block relabelled "lockdown" leaves no ordinary days in the
    # 8 weeks before its later days, so they must use the last 28 ordinary days before the block
    h = pd.read_csv(os.path.join(ROOT, "outputs", "tables", "history_days.csv.gz"))
    b = h[h["city"] == "Brussels"].copy()
    b["date"] = pd.to_datetime(b["date"])
    b = b.set_index("date").sort_index().loc["2019-01-01":"2019-09-30"].copy()
    b.loc["2019-05-01":"2019-07-10", "period"] = "lockdown"
    lvl = ask.rolling_level(b)
    t = pd.Timestamp("2019-07-08")
    ref = b.loc[(b.index < t) & (b["period"] == "baseline"), "level_raw"].iloc[-28:]
    mad = 1.4826 * (ref - ref.median()).abs().median() + 1e-9
    expect = float(np.clip((b.loc[t, "level_raw"] - ref.median()) / mad, -10, 10))
    assert abs(lvl.loc[t] - expect) < 1e-9


@pytest.mark.parametrize("sid", sorted(FILES))
def test_week_guesses_sum_to_100_and_each_block_sits_in_one_fold(sid):
    """The week guess (Result 17 Part B): 28-day blocks from the record's start, one fold each."""
    f = FILES[sid]
    blocks = {}
    n = 0
    for i, shape, probs, period, hol, fold, level, wprobs, wfold in f["days"]:
        if wprobs is None:
            assert wfold is None
            continue
        n += 1
        assert len(wprobs) == 7 and abs(sum(wprobs) - 100) <= 4
        blocks.setdefault(i // 28, set()).add(wfold)
    assert n, f"{sid}: no week guesses"
    assert all(len(v) == 1 for v in blocks.values()), f"{sid}: a 28-day block was split across folds"


def test_week_scores_match_the_files():
    t = pd.read_csv(SCORES).set_index("station")
    for sid, f in FILES.items():
        hit = tot = 0
        for i, shape, probs, period, hol, fold, level, wprobs, wfold in f["days"]:
            if wprobs is None or period != "baseline":
                continue
            tot += 1
            hit += int(np.argmax(wprobs)) == day_date(f, i).weekday()
        if tot:
            assert abs(hit / tot - t.loc[sid, "week_dow_acc"]) < 0.001, sid
