"""The presentation videos draw every number from presentation/video/public/data/*.json
(written by src/presentation_data.py). These tests make sure those numbers are the same
ones the README and docs/04 report, so the slides can never drift from the results."""
import json
import os
import sys

import pytest

REPO = os.path.join(os.path.dirname(__file__), "..")
DATA = os.path.join(REPO, "presentation", "video", "public", "data")
sys.path.insert(0, os.path.join(REPO, "src"))


def j(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def readme():
    with open(os.path.join(REPO, "README.md"), encoding="utf-8") as f:
        return f.read()


def shown(x, digits=1):
    """How a share is written in the README, e.g. 0.94913 -> '94.9%'."""
    return f"{x * 100:.{digits}f}%"


def test_headline_numbers_match_readme(readme):
    r, m, a = j("results.json"), j("mistakes.json"), j("applied.json")
    for value in [r["weekend_median"], r["dow_median"], r["best"]["dow"],
                  r["unseen_city_pooled_weekend"], m["holidays_called_weekend"],
                  a["exact_one_day_median"], a["exact_week_median"]]:
        assert shown(value) in readme, shown(value)
    assert f"**{m['confusion_pr_auc_median']:.2f}**" in readme
    assert f"+{r['shape_vs_level']['median_gain_dow'] * 100:.0f} pp" in readme
    assert f"{r['shape_vs_level']['stations_gain_gt_2pp']} of {r['n_stations']} stations gain" in readme
    nf = a["noise_floor"]
    assert f"{nf['learned']} vs {nf['raw']}, p = {nf['p']:.3f}" in readme


def test_band_and_uae_numbers_match_docs():
    with open(os.path.join(REPO, "docs", "04-results.md"), encoding="utf-8") as f:
        docs = f.read()
    b = {x["band"]: x for x in j("bands.json")["bands"]}
    assert f"**{b['0.1-1 Hz']['weekend_median'] * 100:.1f}%** (chance)" in docs
    assert f"**{b['4-14 Hz']['weekend_median'] * 100:.1f}%**" in docs
    u = j("applied.json")["uae"]
    assert f"**{u['sunday_change'] * 100:.0f}%**" in docs.replace("−", "-")
    assert f"**{u['p']:.3f}**" in docs


def test_data_counts_match_docs():
    with open(os.path.join(REPO, "docs", "04-results.md"), encoding="utf-8") as f:
        docs = f.read()
    s = j("stations.json")
    assert f"{s['n_stations']} stations, {s['n_station_days']:,} station-days" in docs
    assert sum(s["days_by_period"].values()) == s["n_station_days"]


def test_forest_votes_are_a_real_hundred():
    f = j("forest.json")
    assert sum(f["day"]["votes"].values()) == f["n_trees"] == 100
    assert f["day"]["date"] == "2020-01-15"   # an ordinary Wednesday, out of fold


def test_christmas_is_a_holiday_never_trained_on():
    m = j("mistakes.json")
    xmas = m["christmas"]["brussels"]
    assert xmas["period"] == "holiday" and xmas["date"] == "2019-12-25"


def test_named_holidays_match_docs():
    """Christmas Day and Veterans Day, as shown on the mistakes slide, match docs/04's table."""
    with open(os.path.join(REPO, "docs", "04-results.md"), encoding="utf-8") as f:
        docs = f.read()
    named = {h["name"]: h for h in j("mistakes.json")["named_holidays"]}
    for name in ("Christmas Day", "Veterans Day"):
        h = named[name]
        assert f"| {name} (n={h['n']}) | {h['called_weekend'] * 100:.0f}% |" in docs, name
