"""
check_places.py -- how far is each globe seismometer from the city it is named after?

Why: the dots on the globe sit where the SENSOR is (FDSN station service,
outputs/tables/history_station_coords.csv). The names come from the paper's Table S1,
and sometimes name a city tens of km away (Table S1's "Sao Paulo" sensor is in
Valinhos). Rule, fixed before measuring: a sensor more than RELABEL_KM from the city
it is named after gets an honest label, "Site (near City)" (groundtruth/places.py).

Where city positions come from: the GeoNames gazetteer, cities1000 (every place with
1,000+ people; CC-BY 4.0, https://www.geonames.org/). Not from memory.
    Download once (about 11 MB zipped, not committed):
      https://download.geonames.org/export/dump/cities1000.zip
      -> unzip into data/external/geonames/cities1000.txt

How a name is matched: same country, and the name equals the GeoNames name, ASCII name
or one of its alternate names (ignoring case and accents). If several places match, the
MOST POPULOUS one is taken: "Santiago, Chile" means the capital, not a village of the
same name. (Taking the nearest match would favour a namesake village next to the sensor
and hide exactly the errors we are looking for.)

Output: outputs/tables/station_places.csv (committed; the tests read it)
Run:    python src/check_places.py
"""
import math
import os
import sys
import unicodedata

import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))  # repo root
sys.path.insert(0, os.path.dirname(__file__))                      # src/, for history.py
from groundtruth.places import DISPLAY, RELABEL_KM, display_name  # noqa: E402
from history import roster  # noqa: E402

GAZETTEER = os.path.join("data", "external", "geonames", "cities1000.txt")
OUT = os.path.join("outputs", "tables", "station_places.csv")
# GeoNames column layout: https://download.geonames.org/export/dump/readme.txt
COLS = ["geonameid", "name", "asciiname", "alternatenames", "lat", "lon", "fclass", "fcode",
        "country", "cc2", "admin1", "admin2", "admin3", "admin4", "population", "elevation",
        "dem", "timezone", "modified"]


def fold(s):
    """'São Paulo' -> 'sao paulo' (lower case, accents removed)."""
    s = unicodedata.normalize("NFKD", str(s))
    return "".join(c for c in s if not unicodedata.combining(c)).casefold().strip()


def km(lat1, lon1, lat2, lon2):
    """Great-circle distance in km (haversine, Earth radius 6371 km)."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = (math.sin((p2 - p1) / 2) ** 2
         + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2)
    return 2 * 6371 * math.asin(math.sqrt(a))


def load_gazetteer():
    g = pd.read_csv(GAZETTEER, sep="\t", names=COLS, keep_default_na=False, quoting=3,
                    dtype={"country": str, "alternatenames": str})
    # every name a place goes by, folded, so a lookup is a dictionary hit
    names = {}
    for i, (n, a, alt) in enumerate(zip(g["name"], g["asciiname"], g["alternatenames"])):
        for x in {n, a, *alt.split(",")}:
            if x:
                names.setdefault(fold(x), []).append(i)
    return g, names


def find(g, names, name, country):
    """Most populous place called `name` in `country` (a row of g), or None."""
    rows = [i for i in names.get(fold(name), []) if g.at[i, "country"] == country]
    if not rows:
        return None
    return g.loc[rows].sort_values("population", ascending=False).iloc[0]


def nearest(g, lat, lon, min_pop=0):
    """Nearest GeoNames place with at least `min_pop` people (a row of g)."""
    c = g[g["population"] >= min_pop]
    # rough filter first (a 3-degree box), then exact distances
    box = c[(c["lat"].sub(lat).abs() < 3) & (c["lon"].sub(lon).abs() < 3)]
    c = box if len(box) else c
    d = [km(lat, lon, a, b) for a, b in zip(c["lat"], c["lon"])]
    return c.iloc[min(range(len(d)), key=d.__getitem__)], min(d)


def main():
    if not os.path.exists(GAZETTEER):
        sys.exit(f"Missing {GAZETTEER}; see the download note at the top of this file.")
    g, names = load_gazetteer()
    ros = roster()                        # the globe's 33 stations, FDSN coordinates
    rows = []
    for _, r in ros.iterrows():
        st, lat, lon = r["station"], r["lat"], r["lon"]
        hit = find(g, names, r["city"], r["country"])
        near1, d1 = nearest(g, lat, lon)                    # any place of 1,000+
        near100k, d100k = nearest(g, lat, lon, 100_000)      # nearest sizeable city
        row = {"station": st, "paper_city": r["city"], "country": r["country"],
               "site_name": r["site_name"], "lat": lat, "lon": lon,
               "paper_city_geonameid": None if hit is None else int(hit["geonameid"]),
               "paper_city_km": None if hit is None else round(km(lat, lon, hit["lat"], hit["lon"]), 1),
               "nearest_place": near1["name"], "nearest_place_km": round(d1, 1),
               "nearest_100k": near100k["name"], "nearest_100k_km": round(d100k, 1),
               "near_city": "", "near_city_geonameid": None, "near_city_km": None,
               "label": display_name(st, r["city"])}
        if st in DISPLAY and DISPLAY[st][1]:
            near = DISPLAY[st][1]
            # the named "near" city: the place of that name CLOSEST to the sensor
            cand = [i for i in names.get(fold(near), []) if g.at[i, "country"] == r["country"]]
            if cand:
                best = min(cand, key=lambda i: km(lat, lon, g.at[i, "lat"], g.at[i, "lon"]))
                row.update(near_city=near, near_city_geonameid=int(g.at[best, "geonameid"]),
                           near_city_km=round(km(lat, lon, g.at[best, "lat"], g.at[best, "lon"]), 1))
            else:
                row.update(near_city=near)
        rows.append(row)
    out = pd.DataFrame(rows)
    for c in ["paper_city_geonameid", "near_city_geonameid"]:
        out[c] = out[c].astype("Int64")
    out.to_csv(OUT, index=False)

    pd.set_option("display.width", 200)
    show = ["station", "paper_city", "paper_city_km", "site_name", "nearest_place",
            "nearest_place_km", "nearest_100k", "nearest_100k_km", "label"]
    print(out[show].sort_values("paper_city_km", ascending=False, na_position="first")
          .to_string(index=False, max_colwidth=34))
    far = out[(out["paper_city_km"] > RELABEL_KM) | out["paper_city_km"].isna()]
    print(f"\nOver {RELABEL_KM} km from the named city, or the name is not a GeoNames place: "
          f"{len(far)} of {len(out)}")
    print(f"-> {OUT}")


if __name__ == "__main__":
    main()
