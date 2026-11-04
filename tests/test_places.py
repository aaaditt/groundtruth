"""Honest labels on the website (groundtruth/places.py).

The dots are where the SENSOR is (FDSN station service); the labels must not name a
city the sensor is far from. Real data only: the committed tables
outputs/tables/station_places.csv (src/check_places.py, GeoNames distances) and
history_station_coords.csv (FDSN), and the published site files."""
import json
import os
import unicodedata

import pandas as pd
import pytest

from groundtruth.places import DISPLAY, RELABEL_KM, SITE_NOT_FROM_FDSN, display_name

REPO = os.path.join(os.path.dirname(__file__), "..")
TABLES = os.path.join(REPO, "outputs", "tables")


def fold(s):
    s = unicodedata.normalize("NFKD", str(s))
    return "".join(c for c in s if not unicodedata.combining(c)).casefold()


@pytest.fixture(scope="module")
def places():
    return pd.read_csv(os.path.join(TABLES, "station_places.csv"),
                       keep_default_na=False).set_index("station")


@pytest.fixture(scope="module")
def coords():
    return pd.read_csv(os.path.join(TABLES, "history_station_coords.csv"),
                       keep_default_na=False).set_index("station")


def load_site(name):
    with open(os.path.join(REPO, "site", "data", name), encoding="utf-8") as f:
        return json.load(f)


def test_label_format():
    assert display_name("BL.VABB", "Sao Paulo") == "Valinhos (near Campinas)"
    assert display_name("GT.LPAZ", "La Paz") == "Near La Paz"
    assert display_name("IU.DAV", "Dabaw") == "Davao"
    assert display_name("BE.UCC", "Brussels") == "Brussels"      # not relabelled


def test_every_far_station_is_relabelled(places):
    # The rule: more than RELABEL_KM from the named city -> must have an honest label.
    far = places[pd.to_numeric(places["paper_city_km"], errors="coerce") > RELABEL_KM]
    assert len(far) >= 6
    assert set(far.index) <= set(DISPLAY), set(far.index) - set(DISPLAY)


def test_unmatched_names_are_relabelled_or_part_of_the_site_name(places):
    # Names GeoNames does not know ("Connecticut", "Cape Verde", "Nilore") are fine only if
    # the station's own FDSN site name contains them (the sensor IS there).
    for st, r in places[places["paper_city_km"] == ""].iterrows():
        assert st in DISPLAY or fold(r["paper_city"]) in fold(r["site_name"]), st


def test_site_part_comes_from_the_fdsn_site_name(coords):
    for st, (site, _) in DISPLAY.items():
        if site and st not in SITE_NOT_FROM_FDSN:
            assert fold(site) in fold(coords.loc[st, "site_name"]), st


def test_near_city_is_close_to_the_sensor(places):
    for st, (_, near) in DISPLAY.items():
        if near:
            r = places.loc[st]
            assert r["near_city"] == near
            assert r["near_city_geonameid"] != ""            # found in the gazetteer
            assert float(r["near_city_km"]) <= 100, st


def test_globe_uses_the_labels_and_keeps_the_paper_name(places, coords):
    for s in load_site("history.json")["stations"]:
        st = ".".join(s["id"].split(".")[:2])
        assert s["city"] == display_name(st, s["paper_city"])
        assert s["paper_city"] == places.loc[st, "paper_city"]
        # coordinates are the FDSN ones, never moved by hand
        assert s["lat"] == pytest.approx(coords.loc[st, "lat"], abs=1e-4)
        assert s["lon"] == pytest.approx(coords.loc[st, "lon"], abs=1e-4)


def test_research_map_uses_the_same_labels(coords):
    seen = 0
    for s in load_site("stations_2020.json"):
        assert s["city"] == display_name(s["code"], s["paper_city"])
        if s["code"] in coords.index:
            seen += 1
            assert s["lat"] == pytest.approx(coords.loc[s["code"], "lat"], abs=1e-4)
    assert seen == 32          # every globe station from the paper (Sharjah is not in it)
