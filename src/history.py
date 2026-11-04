"""
history.py -- years of daily history for the globe page (site/globe.html).

Which stations: every station from the published data (Lecocq et al. 2020) that
MUSTANG still served in BOTH 2020 and 2026 (outputs/tables/mustang_coverage.csv,
from src/survey_mustang.py), plus the live Sharjah station. 32 + 1 = 33. None are
chosen by how good their results look: weak-signal towns stay in, marked as such
with their published accuracy.

What each day gets (decided before the data was downloaded, docs/10-work-log.md):
    change = 10 ** (level_raw - median level_raw of the SAME WEEKDAY over the
                    previous 8 weeks) - 1                       (as a %)
    Reference days must be ordinary days (period "baseline": no public holiday, not
    21 Dec - 6 Jan) and at least 3 of the 8 must exist, else the day gets no value.
Why this design:
  * same weekday  -> no weekend definition needed (works for 1-day weekends too)
  * previous 8 weeks only -> slow changes at the SITE (new sensor, building work;
    see Sharjah in docs/04 Result 14) don't masquerade as city life
  * the day itself and holidays never enter their own reference
Consequence, said on the page: a long event (a lockdown) fades from view after about
8 weeks, because it becomes the new "recent normal".

Outputs: outputs/tables/history_levels.csv.gz  (slim: one row per station-day)
         outputs/tables/history_summary.csv    (per station)
         site/data/history.json                (everything the globe page needs)

Run:  python src/history.py --download STATION_ID ...   (fill the cache only; can be
                                                        run as several processes)
      python src/history.py                             (build outputs from the cache)
"""
import argparse
import json
import os
import sys
from datetime import date

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))  # repo root
from groundtruth.features import clean_rms, daily_features  # noqa: E402
from groundtruth.history import MIN_REF, WEEKS, relative_change  # noqa: E402
from groundtruth.live import label_days  # noqa: E402
from groundtruth.models import load  # noqa: E402
from groundtruth.mustang import rms_series  # noqa: E402
from groundtruth.places import display_name  # noqa: E402
from groundtruth.stations import load_stations  # noqa: E402

START, END = date(2019, 1, 1), date(2026, 10, 1)
CLIP = 80                                          # % shown on the site is clipped to +-80
TABLES = os.path.join("outputs", "tables")
SITE = os.path.join("site", "data", "history.json")
TABLE_S1 = os.path.join("data", "external", "2020_Science_GlobalQuieting", "Supplementary Files",
                        "Table S1 - Lockdown stations.csv")


COORDS = os.path.join(TABLES, "history_station_coords.csv")
# Display names (the published tables keep Table S1's names) come from
# groundtruth/places.py; the sensor-to-city distances from src/check_places.py.
PLACES = os.path.join(TABLES, "station_places.csv")
STATION_URL = "https://service.earthscope.org/fdsnws/station/1/query"


def official_coords(stations):
    """Latitude/longitude/site name from the FDSN station service (latest epoch), saved
    to a committed table so the site never depends on a live query. Table S1 has at
    least two stations in the wrong place (Nilore and Davao), so its coordinates are
    not used for the globe."""
    if os.path.exists(COORDS):
        return pd.read_csv(COORDS, keep_default_na=False).set_index("station")
    from groundtruth import client
    rows = []
    for st in stations:
        net, sta = st.split(".")
        r = client.get(STATION_URL, params={"net": net, "sta": sta, "level": "station",
                                            "format": "text"})
        lines = [ln.split("|") for ln in r.text.splitlines() if ln and not ln.startswith("#")]
        if not lines:
            continue
        last = max(lines, key=lambda x: x[6])            # latest epoch by start time
        rows.append({"station": st, "lat": float(last[2]), "lon": float(last[3]),
                     "site_name": last[5], "epoch_start": last[6],
                     "queried": str(date.today())})
    out = pd.DataFrame(rows)
    out.to_csv(COORDS, index=False)
    return out.set_index("station")


def roster():
    """One row per station: target, city, country code, time zone, lat, lon,
    published weekday-vs-weekend accuracy. All facts come from committed files."""
    cov = pd.read_csv(os.path.join(TABLES, "mustang_coverage.csv"), keep_default_na=False, dtype=str)
    cov = cov[(cov["mustang_2020-01-15"] == "True") & (cov["mustang_2026-10-01"] == "True")]
    s1 = pd.read_csv(TABLE_S1, encoding="latin-1", keep_default_na=False)
    s1 = s1.drop_duplicates("Station_Code").set_index("Station_Code")
    lec = load().drop_duplicates("station").set_index("station")
    scores = pd.read_csv(os.path.join("outputs", "station_scores.csv"), keep_default_na=False)
    scores = scores.set_index("station")
    rows = []
    for _, r in cov.iterrows():
        st = r["station"]
        rows.append({"id": r["target"], "station": st, "city": r["city"],
                     "country": lec.loc[st, "country_code"],
                     "timezone": s1.loc[st, "TimeZone"],
                     "lat": float(s1.loc[st, "latitude"]), "lon": float(s1.loc[st, "longitude"]),
                     "published_weekend_acc": float(scores.loc[st, "weekend_bal_acc"])
                     if st in scores.index else None})
    for s in load_stations():                       # live stations not in the paper
        if s.route == "mustang" and s.id not in {r["id"] for r in rows}:
            rows.append({"id": s.id, "station": ".".join(s.id.split(".")[:2]), "city": s.city,
                         "country": s.country, "timezone": s.timezone, "lat": s.lat,
                         "lon": s.lon, "published_weekend_acc": None})
    live = {s.id for s in load_stations() if s.status == "live"}
    out = pd.DataFrame(rows)
    out["live"] = out["id"].isin(live)
    coords = official_coords(out["station"].tolist())
    out["table_s1_lat"], out["table_s1_lon"] = out["lat"], out["lon"]
    out["lat"] = [coords.loc[s, "lat"] if s in coords.index else la for s, la in zip(out["station"], out["lat"])]
    out["lon"] = [coords.loc[s, "lon"] if s in coords.index else lo for s, lo in zip(out["station"], out["lon"])]
    out["site_name"] = [coords.loc[s, "site_name"] if s in coords.index else "" for s in out["station"]]
    # Table S1's zone for Puerto Williams is outdated; config/stations.yaml has the fix
    fix = {s.id: s.timezone for s in load_stations()}
    out["timezone"] = [fix.get(i, tz) for i, tz in zip(out["id"], out["timezone"])]
    return out.sort_values("id").reset_index(drop=True)


def days(row):
    """Daily level + labels for one station over [START, END)."""
    s = rms_series(row["id"], START, END)
    if s.empty:
        return pd.DataFrame()
    s.index = s.index.tz_convert(row["timezone"])
    d = label_days(daily_features(clean_rms(s)), row["country"])
    d = d[(d.index >= pd.Timestamp(START)) & (d.index < pd.Timestamp(END))]
    return d[["level_raw", "day_of_week", "is_weekend", "period", "holiday_name"]]


def fully_cached(sid):
    folder = os.path.join("data", "cache", "mustang", sid)
    n_months = (END.year - START.year) * 12 + END.month - START.month
    return os.path.isdir(folder) and len(os.listdir(folder)) >= n_months


def build(only_cached=False):
    ros = roster()
    if only_cached:          # for previewing the site while downloads are running
        ros = ros[[fully_cached(s) for s in ros["id"]]]
    places = pd.read_csv(PLACES, keep_default_na=False).set_index("station")
    parts, stations = [], []
    for _, row in ros.iterrows():
        d = days(row)
        print(f"{row['city']:18s} {len(d):5d} days", flush=True)
        if d.empty:
            continue
        d["change_pct"] = relative_change(d)
        d.insert(0, "station", row["id"])
        parts.append(d)
        full = pd.date_range(START, pd.Timestamp(END) - pd.Timedelta(days=1), freq="D")
        v = d["change_pct"].reindex(full)
        hol = d.loc[d["holiday_name"] != "", "holiday_name"]
        pl = places.loc[row["station"]]
        # the city the label points to, and how far the sensor is from it (km, GeoNames)
        if pl["near_city"]:
            near, near_km = pl["near_city"], pl["near_city_km"]
        else:
            near, near_km = row["city"], pl["paper_city_km"]
        stations.append({
            "id": row["id"], "city": display_name(row["station"], row["city"]),
            "paper_city": row["city"], "near": near,
            "near_km": None if near_km == "" else float(near_km),
            "site": row["site_name"], "country": row["country"],
            "lat": round(row["lat"], 4), "lon": round(row["lon"], 4),
            "timezone": row["timezone"], "live": bool(row["live"]),
            "published_weekend_acc": None if pd.isna(row["published_weekend_acc"])
            else round(100 * row["published_weekend_acc"], 1),
            "n_days": int(d["change_pct"].notna().sum()),
            "values": [None if pd.isna(x) else int(round(max(-CLIP, min(CLIP, x)))) for x in v],
            "holidays": {str((t - pd.Timestamp(START)).days): n for t, n in hol.items()},
        })
    allp = pd.concat(parts)
    allp.index.name = "date"
    allp.to_csv(os.path.join(TABLES, "history_levels.csv.gz"))

    # Summary: does the metric mean anything? Median change on weekday public holidays
    # vs ordinary weekdays, per station (exploratory; reported, never tuned on).
    rows = []
    for sid, g in allp.groupby("station"):
        wk = g[(g["is_weekend"] == 0) & g["change_pct"].notna()]
        hol = wk[wk["period"] == "holiday"]["change_pct"]
        ordn = wk[wk["period"] == "baseline"]["change_pct"]
        rows.append({"station": sid, "days_with_value": int(g["change_pct"].notna().sum()),
                     "weekday_holidays": len(hol),
                     "holiday_median_pct": round(hol.median(), 1) if len(hol) else np.nan,
                     "ordinary_weekday_median_pct": round(ordn.median(), 1),
                     "holiday_quieter_by_10pct_share": round((hol <= -10).mean(), 3) if len(hol) else np.nan,
                     "ordinary_quieter_by_10pct_share": round((ordn <= -10).mean(), 3)})
    summ = pd.DataFrame(rows).merge(ros[["id", "city", "published_weekend_acc"]],
                                    left_on="station", right_on="id").drop(columns="id")
    summ.to_csv(os.path.join(TABLES, "history_summary.csv"), index=False)

    out = {"generated_from": "src/history.py", "source": "EarthScope MUSTANG noise-psd, 4-14 Hz",
           "start": str(START), "end_exclusive": str(END), "weeks": WEEKS, "min_ref": MIN_REF,
           "clip_pct": CLIP, "stations": stations}
    with open(SITE, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    print(summ.to_string(index=False))
    print(f"\nAll stations: weekday holidays median {summ['holiday_median_pct'].median():.1f}%, "
          f"ordinary weekdays {summ['ordinary_weekday_median_pct'].median():.1f}%; "
          f"share >=10% quieter: holidays {summ['holiday_quieter_by_10pct_share'].median():.2f}, "
          f"ordinary {summ['ordinary_quieter_by_10pct_share'].median():.2f}")
    print(f"site/data/history.json: {os.path.getsize(SITE) / 1e3:.0f} kB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--download", nargs="*", help="only fill the cache for these station ids")
    ap.add_argument("--list", action="store_true", help="print the roster")
    ap.add_argument("--only-cached", action="store_true",
                    help="preview: skip stations whose download is not finished")
    a = ap.parse_args()
    if a.list:
        print(roster().to_string())
    elif a.download is not None:
        for sid in a.download:
            rms_series(sid, START, END)
            print("cached", sid, flush=True)
    else:
        build(a.only_cached)


if __name__ == "__main__":
    main()
