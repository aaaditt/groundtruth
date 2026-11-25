"""site/data/sources.json (src/sources_export.py): every station the site shows can be
traced to its seismic network, and every DOI it gives looks like a DOI."""
import json
import os
import re

SITE = os.path.join(os.path.dirname(__file__), "..", "site", "data")


def load(name):
    with open(os.path.join(SITE, name), encoding="utf-8") as f:
        return json.load(f)


def test_every_station_has_its_network():
    nets = load("sources.json")["networks"]
    codes = [s["code"] for s in load("stations_2020.json")] + [s["id"] for s in load("history.json")["stations"]]
    for c in codes:
        n = nets.get(c.split(".")[0])
        assert n and n["name"], f"{c}: network missing from sources.json"


def test_dois_are_well_formed():
    src = load("sources.json")
    for code, n in src["networks"].items():
        if n["doi"]:
            assert re.match(r"^10\.\d{4,9}/\S+$", n["doi"]), code
    for d in src["datasets"]:
        assert d["name"] and d["what"] and d["used_for"] and d["url"].startswith("https://"), d["id"]
        if d["doi"]:
            assert re.match(r"^10\.\d{4,9}/\S+$", d["doi"]), d["id"]


def test_pages_show_the_source_with_dom_nodes_only():
    """Both map pages call sourceLine(), which builds links with el() (no innerHTML)."""
    site = os.path.join(SITE, "..")
    common = open(os.path.join(site, "common.js"), encoding="utf-8").read()
    body = common[common.index("function sourceLine"):common.index("function el(")]
    assert "innerHTML" not in body
    for page in ("research.js", "globe.js"):
        assert "sourceLine(" in open(os.path.join(site, page), encoding="utf-8").read(), page
