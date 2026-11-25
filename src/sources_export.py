"""
sources_export.py -- where every recording comes from, for the website and the talk.

Every seismometer belongs to a seismic NETWORK: the first part of its code (BE.UCC is
station UCC of network BE, the Belgian Seismic Network). Each network is registered with
the International Federation of Digital Seismograph Networks (FDSN), which gives it a
name and a DOI, the reference to cite when you use its data.

This script reads the station codes the site shows (site/data/stations_2020.json, the
158 stations of Lecocq et al. 2020; site/data/history.json, the 33 globe stations),
looks each network up in the FDSN network registry, and writes

  site/data/sources.json   the datasets we use, and every network with its name and DOI

The registry is downloaded once and cached in data/cache/fdsn_networks.json (not
committed). Temporary networks (codes starting with a digit or X, Y, Z) reuse their code
over the years, so for those we pick the entry that was running in 2019-2020.

Run:  python src/sources_export.py
"""
import json
import os
import urllib.request

REPO = os.path.join(os.path.dirname(__file__), "..")
SITE = os.path.join(REPO, "site", "data")
CACHE = os.path.join(REPO, "data", "cache", "fdsn_networks.json")
REGISTRY = "https://www.fdsn.org/ws/networks/1/query?format=json"

# the datasets, cited as in docs/02-data-and-sources.md
DATASETS = [
    {"id": "lecocq2020", "name": "Lecocq et al. (2020), Science",
     "what": "15-minute readings, 4–14 Hz, Oct 2019 – May 2020",
     "used_for": "the 2019–20 models, holidays, lockdowns, the UAE test",
     "doi": "10.1126/science.abd2438",
     "url": "https://github.com/ThomasLecocq/2020_Science_GlobalQuieting"},
    {"id": "mustang", "name": "EarthScope MUSTANG noise-psd",
     "what": "public noise spectra, every half hour, 2019 – today",
     "used_for": "the globe, Ask, City Pulse every night",
     "doi": "10.1785/0220170191",
     "url": "https://service.earthscope.org/mustang/noise-psd/1/"},
    {"id": "comcat", "name": "USGS ComCat earthquake catalogue",
     "what": "earthquakes: time, place, magnitude",
     "used_for": "the two earthquake tests",
     "doi": "10.5066/F7MS3QZH",
     "url": "https://earthquake.usgs.gov/fdsnws/event/1/"},
    {"id": "holidays", "name": "Public calendars",
     "what": "holidays (Python package), weekends (Wikipedia)",
     "used_for": "the labels: never from the seismic data",
     "doi": None,
     "url": "https://github.com/vacanza/holidays"},
]


def registry():
    if not os.path.exists(CACHE):
        os.makedirs(os.path.dirname(CACHE), exist_ok=True)
        req = urllib.request.Request(REGISTRY, headers={"User-Agent": "groundtruth-sources/1.0"})
        with urllib.request.urlopen(req, timeout=60) as r:
            with open(CACHE, "wb") as f:
                f.write(r.read())
    with open(CACHE, encoding="utf-8") as f:
        return json.load(f)["networks"]


def temporary(code):
    return code[0].isdigit() or code[0] in "XYZ"


def pick(entries, code):
    """The registry entry for `code` that was running during 2019-2020."""
    def overlaps(e):
        start = (e.get("start_date") or "1900")[:10]
        end = (e.get("end_date") or "2100")[:10]
        return start <= "2020-12-31" and end >= "2019-01-01"
    ok = [e for e in entries if e["fdsn_code"] == code and overlaps(e)]
    if not ok:
        return None
    if not temporary(code):
        ok.sort(key=lambda e: e.get("start_date") or "")      # the permanent, earliest entry
    return ok[0]


def main():
    with open(os.path.join(SITE, "stations_2020.json"), encoding="utf-8") as f:
        old = [s["code"].split(".")[0] for s in json.load(f)]
    with open(os.path.join(SITE, "history.json"), encoding="utf-8") as f:
        new = [s["id"].split(".")[0] for s in json.load(f)["stations"]]
    entries = registry()
    nets = {}
    for code in sorted(set(old) | set(new)):
        e = pick(entries, code)
        nets[code] = {"name": e["name"] if e else None, "doi": e.get("doi") if e else None,
                      "stations_2020": old.count(code), "stations_globe": new.count(code)}
    out = {"about": "Written by src/sources_export.py from the FDSN network registry "
                    "(https://www.fdsn.org/ws/networks/1/query). Never edit by hand.",
           "datasets": DATASETS, "networks": nets}
    with open(os.path.join(SITE, "sources.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
    missing = [c for c, n in nets.items() if not n["name"]]
    no_doi = [c for c, n in nets.items() if n["name"] and not n["doi"]]
    print(f"site/data/sources.json: {len(nets)} networks ({len(set(old))} for 2019-20, "
          f"{len(set(new))} on the globe), {sum(1 for n in nets.values() if n['doi'])} with a DOI")
    print(f"  not in the registry: {missing or 'none'}")
    print(f"  registered without a DOI: {no_doi or 'none'}")


if __name__ == "__main__":
    main()
