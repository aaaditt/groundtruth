"""
export_site_research.py -- data for the website's Research page and "Guess the day" game.

Both come from the PUBLISHED 2019-20 results (Lecocq et al. data), not from the live
MUSTANG data -- the two are never mixed.

  site/data/stations_2020.json  every station in Table S1 with its coordinates and
                                per-station accuracy (outputs/station_scores.csv)
  site/data/game.json           real days from 8 cities: the day's 24-hour shape, the
                                true weekday, and the model's OUT-OF-FOLD guess from
                                outputs/tables/day_scores.csv (the model never trained
                                on the week that day is in). Normal days are a fixed
                                random sample (seed 0); every weekday public holiday
                                before lockdown is included.
  site/data/bands.json          the frequency-band test (outputs/tables/band_test.csv)

Run:  python src/export_site_research.py
"""
import json
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))  # repo root, for `import groundtruth`
from groundtruth.features import SHAPE_COLS  # noqa: E402
from groundtruth.models import load  # noqa: E402
from groundtruth.places import display_name  # noqa: E402

TABLE_S1 = os.path.join("data", "external", "2020_Science_GlobalQuieting", "Supplementary Files",
                        "Table S1 - Lockdown stations.csv")
OUT = os.path.join("site", "data")
COORDS = os.path.join("outputs", "tables", "history_station_coords.csv")
PLACES = os.path.join("outputs", "tables", "station_places.csv")   # src/check_places.py
# Showcase cities plus the best exact-day stations with a recognisable city name
GAME_STATIONS = ["AM.R7885", "HL.ATH", "BE.UCC", "CI.USC", "CN.MNTQ", "S1.AUKSC", "EI.DSB", "GB.EDI"]
NORMAL_PER_STATION = 24


def stations():
    meta = pd.read_csv(TABLE_S1, encoding="latin-1")
    meta = meta.drop_duplicates("Station_Code").set_index("Station_Code")
    scores = pd.read_csv("outputs/station_scores.csv").set_index("station")   # no country_code column
    feats = load()
    # Official coordinates (FDSN station service) where we have checked them: Table S1
    # puts Nilore (II.NIL) in Paraguay and Davao (IU.DAV) in Malaysia. See src/history.py.
    coords = pd.read_csv(COORDS).set_index("station") if os.path.exists(COORDS) else pd.DataFrame()
    # Honest labels: sensor-to-city distances for the stations with official coordinates
    places = pd.read_csv(PLACES, keep_default_na=False).set_index("station")
    out = []
    for code, g in feats.groupby("station"):
        m = meta.loc[code]
        lat, lon = float(m["latitude"]), float(m["longitude"])
        if code in coords.index:
            lat, lon = float(coords.loc[code, "lat"]), float(coords.loc[code, "lon"])
        r = scores.loc[code] if code in scores.index else None
        city = g["city"].iloc[0]
        near_km = None
        if code in places.index:
            pl = places.loc[code]
            km = pl["near_city_km"] if pl["near_city"] else pl["paper_city_km"]
            near_km = None if km == "" else float(km)
        out.append({"code": code, "city": display_name(code, city), "paper_city": city,
                    "near_km": near_km,
                    # Raspberry Shake (AM) positions are rounded by the network for privacy
                    "approx_location": code.startswith("AM."),
                    "country": g["country"].iloc[0],
                    "lat": round(lat, 4), "lon": round(lon, 4),
                    "pop_density": None if pd.isna(g["pop_density"].iloc[0]) else float(g["pop_density"].iloc[0]),
                    "days": int(len(g)),
                    "weekend_bal_acc": None if r is None else round(float(r["weekend_bal_acc"]), 3),
                    "dow_acc": None if r is None else round(float(r["dow_acc"]), 3)})
    return out


def game():
    feats = load().set_index(["station", "date"])
    sc = load("outputs/tables/day_scores.csv")
    sc = sc[sc["station"].isin(GAME_STATIONS)]
    picks = []
    rng = np.random.default_rng(0)
    for code in GAME_STATIONS:
        g = sc[sc["station"] == code]
        if g.empty:
            continue
        normal = g[g["period"] == "baseline"]
        normal = normal.iloc[np.sort(rng.choice(len(normal), size=min(NORMAL_PER_STATION, len(normal)), replace=False))]
        hol = g[(g["period"] == "holiday") & (g["is_weekend"] == 0)]
        picks.append(pd.concat([normal, hol]))
    days = pd.concat(picks)
    rows = []
    for _, r in days.iterrows():
        shape = feats.loc[(r["station"], r["date"]), SHAPE_COLS].values.astype(float)
        rows.append({"station": r["station"], "city": r["city"], "date": r["date"].strftime("%Y-%m-%d"),
                     "dow": int(r["day_of_week"]), "holiday": r["holiday_name"] if isinstance(r["holiday_name"], str) else "",
                     "pred_dow": int(r["pred_dow"]), "p_true_dow": round(float(r["p_true_dow"]), 3),
                     "p_weekend": round(float(r["p_weekend"]), 3),
                     "shape": [round(float(v), 3) for v in shape]})
    # each city's average normal Wednesday and Sunday, as faint reference lines
    ref = {}
    f = feats.reset_index()
    for code in GAME_STATIONS:
        b = f[(f["station"] == code) & (f["period"] == "baseline")]
        if b.empty:
            continue
        ref[code] = {k: [round(float(v), 3) for v in b[b["day_of_week"] == d][SHAPE_COLS].mean().values]
                     for k, d in [("weekday", 2), ("sunday", 6)]}
    return {"days": rows, "reference": ref}


def main():
    os.makedirs(OUT, exist_ok=True)
    st = stations()
    gm = game()
    bands = pd.read_csv("outputs/tables/band_test.csv").round(3).to_dict(orient="records")
    for name, obj in [("stations_2020.json", st), ("game.json", gm), ("bands.json", bands)]:
        with open(os.path.join(OUT, name), "w", encoding="utf-8") as fh:
            json.dump(obj, fh, ensure_ascii=False, separators=(",", ":"))
    n_hol = sum(1 for d in gm["days"] if d["holiday"])
    print(f"-> {OUT}/stations_2020.json ({len(st)} stations), game.json ({len(gm['days'])} days, "
          f"{n_hol} holidays), bands.json ({len(bands)} rows)")


if __name__ == "__main__":
    main()
