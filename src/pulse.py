"""
pulse.py -- the daily City Pulse job: score every new day for every live station.

Run by .github/workflows/pulse.yml once a day; also runs on a laptop.

For each station in config/stations.yaml:
  live + mustang : download MUSTANG from 1 Oct 2026 to today, score each complete local
                   day with the station's live model (groundtruth/pulse.py)
  anything else  : listed with its status and "no data" -- never an estimate

Outputs (the website reads these; the CSV is also the open dataset)
  site/data/pulse.json       everything the dashboard shows
  site/data/pulse_days.csv   one row per station-day scored so far

Run:  python src/pulse.py
"""
import json
import os
import sys
from datetime import datetime, timedelta, timezone

import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))  # repo root, for `import groundtruth`
from groundtruth import live, pulse  # noqa: E402
from groundtruth.models import load  # noqa: E402
from groundtruth.stations import load_stations  # noqa: E402

OUT = os.path.join("site", "data")
LIVE_DAYS = os.path.join("outputs", "tables", "live_days.csv")
LIVE_MODELS = os.path.join("outputs", "tables", "live_models.csv")
CSV_COLS = ["station", "city", "date", "dow", "is_weekend", "calendar", "holiday", "pred_dow",
            "p_true_dow", "p_weekend", "confusion", "anomaly", "confusion_flag", "anomaly_flag"]


def track_record(days):
    """How the model has done on NEW normal days so far (never seen in training).
    Holidays/festive days are excluded: they are what the detectors should flag."""
    n = [d for d in days if d["calendar"] == "baseline"]
    if not n:
        return None
    wk = [d for d in n if d["is_weekend"]]
    wd = [d for d in n if not d["is_weekend"]]
    rec = lambda g, want: sum((d["p_weekend"] > .5) == want for d in g) / len(g) if g else None  # noqa: E731
    parts = [r for r in (rec(wk, True), rec(wd, False)) if r is not None]
    return {"normal_days": len(n),
            "weekend_bal_acc": round(sum(parts) / len(parts), 3),
            "dow_acc": round(sum(d["pred_dow"] == d["dow"] for d in n) / len(n), 3)}


def station_entry(st):
    return {"id": st.id, "city": st.city, "country": st.country, "timezone": st.timezone,
            "lat": st.lat, "lon": st.lon, "status": st.status, "route": st.route,
            "notes": " ".join(st.notes.split()), "days": [], "latest": None, "error": None}


def main():
    now = datetime.now(timezone.utc)
    train_all = load(LIVE_DAYS)
    cards = pd.read_csv(LIVE_MODELS).set_index("station")
    stations, rows = [], []
    for st in load_stations():
        e = station_entry(st)
        if st.status == "live" and st.route == "mustang" and st.id in cards.index:
            c = cards.loc[st.id]
            e["model"] = {"version": c["model_version"], "train_start": c["train_start"],
                          "train_end": c["train_end"], "normal_days": int(c["baseline_days"]),
                          "weekend_bal_acc": round(float(c["weekend_bal_acc"]), 3),
                          "dow_acc": round(float(c["dow_acc"]), 3)}
            try:
                train = train_all[train_all["station"] == st.id]
                ref = train.loc[train["period"] == "baseline", "level_raw"]
                new = live.station_days(st, live.TRAIN_END, (now + timedelta(days=1)).date(), level_ref=ref)
                if new.empty:
                    e["error"] = "MUSTANG returned no complete days since the model was trained"
                else:
                    scored, thr = pulse.score_new(train, new)
                    e["thresholds"] = {k: round(v, 3) for k, v in thr.items()}
                    e["days"] = [pulse.day_record(r) for _, r in scored.iterrows()]
                    for d in e["days"]:
                        d["summary"] = pulse.describe(d)
                        rows.append({"station": st.id, "city": st.city,
                                     **{k: d[k] for k in CSV_COLS[2:]}})
                    e["latest"] = e["days"][-1]["date"]
                    e["track_record"] = track_record(e["days"])
            except Exception as ex:          # one station failing must not stop the others
                e["error"] = f"{type(ex).__name__}: {ex}"
        stations.append(e)
        state = e["latest"] or e["error"] or st.status
        print(f"{st.id:16s} {st.city:16s} days={len(e['days']):3d}  latest={state}", flush=True)

    os.makedirs(OUT, exist_ok=True)
    doc = {"generated_utc": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
           "model_version": live.MODEL_VERSION,
           "train_window": [str(live.TRAIN_START), str(live.TRAIN_END)],
           "dow_names": pulse.DOW_NAMES,
           "stations": stations}
    with open(os.path.join(OUT, "pulse.json"), "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=1, ensure_ascii=False)
    pd.DataFrame(rows, columns=CSV_COLS).to_csv(os.path.join(OUT, "pulse_days.csv"), index=False)
    print(f"-> {OUT}/pulse.json, pulse_days.csv ({len(rows)} station-days)")


if __name__ == "__main__":
    main()
