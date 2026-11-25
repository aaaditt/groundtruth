"""
quake_waveform.py -- "subtract the people", second by second (Result 22).

Pre-registered in docs/20-quake-waveform-preregistration.md (commit 5e70864) before any
waveform was downloaded or this script was written. The logic is in groundtruth/quakewave.py.

For each of the 33 globe stations, 2021-2026, ordinary days only:
  * up to 100 catalogued earthquakes (USGS ComCat, M >= 2, <= 100 km), chosen at random
  * 100 quiet 15-minute chunks at random times, away from any earthquake
  * for each: download the waveform around it (EarthScope), turn it into one number per
    second (4-14 Hz displacement), score it with three detectors (raw, rolling, learned)
  * each detector's threshold = 99th percentile of its quiet scores (1% false alarms)
  * then count which earthquakes each detector finds, and test learned vs raw (McNemar)

This is DETECTION of earthquakes that already happened, not prediction.

Downloads are cached in data/cache/quakewave/ (catalogues, StationXML and one small .npy of
per-second values per window), so a rerun only downloads what is missing.

Outputs
  outputs/tables/quake_waveform_events.csv    one row per station-earthquake pair
  outputs/tables/quake_waveform_stations.csv  per station: windows, thresholds, found
  outputs/plots/quake_waveform_found.png      found earthquakes by magnitude, per detector
Run:  python src/quake_waveform.py            (first run downloads for about an hour)
"""
import os
import sys
from concurrent.futures import ThreadPoolExecutor

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))  # repo root
sys.path.insert(0, os.path.dirname(__file__))                      # src/
from groundtruth import quakewave as Q  # noqa: E402
from groundtruth.mustang import rms_series  # noqa: E402
from groundtruth.noisefloor import distance_km, mcnemar_exact  # noqa: E402
from history import roster  # noqa: E402

START, END = pd.Timestamp("2021-01-01", tz="UTC"), pd.Timestamp("2026-10-01", tz="UTC")
MIN_MAG, MAX_KM, QUIET_MIN_MAG = 2.0, 100.0, 1.5
MAX_EVENTS, N_CHUNKS, MAX_TRIES = 100, 100, 300
PAD = 30                  # seconds of extra recording each side, cut off after filtering
DETECTORS = ["raw", "rolling", "learned"]
CACHE = os.path.join("data", "cache", "quakewave")
TABLES, PLOTS = os.path.join("outputs", "tables"), os.path.join("outputs", "plots")
USGS = "https://earthquake.usgs.gov/fdsnws/event/1/query"
FDSN = "https://service.earthscope.org"


# ---------------------------------------------------------------- earthquake catalogue
def usgs(name, **params):
    """One ComCat query per year (stays under the 20,000-event limit), cached as CSV."""
    from groundtruth import client
    parts = []
    for y in range(START.year, END.year + 1):
        path = os.path.join(CACHE, "catalogue", f"{name}_{y}.csv")
        if not os.path.exists(path):
            q = {"format": "csv", "starttime": f"{y}-01-01", "endtime": f"{y + 1}-01-01",
                 "orderby": "time-asc", "limit": 20000, **params}
            r = client.get(USGS, params=q)
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                f.write(r.text if r.status_code == 200 else "")
        if os.path.getsize(path) > 0:
            p = pd.read_csv(path)
            if len(p) >= 20000:
                print(f"  WARNING: {name} {y} hit the 20,000-event limit")
            parts.append(p)
    if not parts:
        return pd.DataFrame(columns=["time", "latitude", "longitude", "mag", "id"])
    ev = pd.concat(parts, ignore_index=True)
    ev["time"] = pd.to_datetime(ev["time"], utc=True, format="mixed")
    return ev[(ev["time"] >= START) & (ev["time"] < END)]


# ---------------------------------------------------------------- waveforms
def client():
    from obspy.clients.fdsn import Client
    return Client(FDSN, timeout=60)


def inventory(cl, net, sta, loc, cha):
    from obspy import read_inventory
    path = os.path.join(CACHE, "stationxml", f"{net}.{sta}.{loc}.{cha}.xml")
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        inv = cl.get_stations(network=net, station=sta, location=loc or "--", channel=cha,
                              starttime=START.to_pydatetime(), endtime=END.to_pydatetime(), level="response")
        inv.write(path, format="STATIONXML")
    return read_inventory(path)


def window(cl, inv, sid, t0, seconds):
    """Per-second log RMS for [t0, t0 + seconds), or None if the recording has gaps or is
    missing. Cached as .npy; a failed download is cached as an empty file."""
    from obspy import UTCDateTime
    path = os.path.join(CACHE, "windows", sid, f"{int(t0.timestamp())}_{seconds}.npy")
    if os.path.exists(path):
        return np.load(path) if os.path.getsize(path) > 0 else None
    os.makedirs(os.path.dirname(path), exist_ok=True)
    net, sta, loc, cha = sid.split(".")
    a = UTCDateTime(t0.to_pydatetime()) - PAD
    b = a + seconds + 2 * PAD
    x, no_data = None, False
    try:
        st = cl.get_waveforms(net, sta, loc or "--", cha, a, b)
        st.merge(method=0)
        if len(st) == 1 and not np.ma.isMaskedArray(st[0].data) and st[0].stats.sampling_rate >= 40:
            tr = st[0].trim(a, b, nearest_sample=True)
            sr = tr.stats.sampling_rate
            if abs(tr.stats.starttime - a) < 1 / sr and len(tr.data) >= int((seconds + 2 * PAD) * sr) - 1:
                sens = inv.get_response(sid, t0.to_pydatetime()).instrument_sensitivity
                full = Q.processed_log_rms(tr.data, sr, sens.value, sens.input_units)
                x = full[PAD:PAD + seconds]
        no_data = x is None              # recording exists but has gaps / is too short
    except Exception as ex:          # no data (204), server error, unknown response, ...
        no_data = "No data" in str(ex) or "204" in str(ex)
        if not no_data:
            print(f"    {sid} {t0}: {type(ex).__name__}: {str(ex)[:120]}")
            return None              # an error is NOT cached: a rerun tries again
    if x is None or len(x) < seconds:
        if no_data:
            open(path, "wb").close() # cache "no usable data" so reruns skip it
        return None
    np.save(path, x)
    return x


# ---------------------------------------------------------------- one station
def run_station(r, global_big):
    sid = r["id"]
    net, sta, loc, cha = sid.split(".")
    from weekday_experiment import station_table   # day labels; its pickle cache is written locally only
    days = station_table(r)
    ordinary = set(days.index[days["period"] == "baseline"].date)
    tz = r["timezone"]

    local = usgs(f"{r['station']}_local", latitude=r["lat"], longitude=r["lon"], maxradiuskm=MAX_KM,
                 minmagnitude=QUIET_MIN_MAG)
    regional = usgs(f"{r['station']}_regional", latitude=r["lat"], longitude=r["lon"], maxradiuskm=1000,
                    minmagnitude=4.5)
    local = local.assign(dist_km=distance_km(r["lat"], r["lon"], local["latitude"].to_numpy(float),
                                             local["longitude"].to_numpy(float)))   # float: an empty table has object columns
    noisy = pd.DatetimeIndex(pd.concat([local["time"], regional["time"], global_big["time"]])).sort_values()
    on_ordinary = np.array([t.date() in ordinary for t in local["time"].dt.tz_convert(tz)], dtype=bool)
    primary = local[(local["mag"] >= MIN_MAG) & (local["dist_km"] <= MAX_KM) & on_ordinary]
    n_primary_all = len(primary)
    if len(primary) > MAX_EVENTS:
        primary = primary.iloc[np.sort(np.random.default_rng(0).choice(len(primary), MAX_EVENTS, replace=False))]

    cl = client()
    try:
        inv = inventory(cl, net, sta, loc, cha)
    except Exception as ex:
        print(f"{sid}: no StationXML ({type(ex).__name__})")
        return None, None
    mlog = np.log10(rms_series(sid, (START - pd.Timedelta(weeks=9)).date(), END.date()))
    mlog = mlog[np.isfinite(mlog)]

    # quiet chunks: random times, ordinary day, far from any earthquake (docs/20 section 4)
    rng = np.random.default_rng(0)
    span = int((END - START).total_seconds()) - Q.CHUNK_S
    cand = []                        # up to MAX_TRIES eligible times = download attempts
    for _ in range(100 * MAX_TRIES):
        if len(cand) >= MAX_TRIES:
            break
        t = START + pd.Timedelta(seconds=int(rng.integers(0, span)))
        if t.tz_convert(tz).date() in ordinary and Q.quiet_ok(t, noisy):
            cand.append(t)
    quiet_scores, n_chunks = {d: [] for d in DETECTORS}, 0
    with ThreadPoolExecutor(6) as ex:
        # fetch in batches, in random order, until N_CHUNKS chunks have data
        for i in range(0, len(cand), 25):
            if n_chunks >= N_CHUNKS:
                break
            batch = cand[i:i + 25]
            for t, x in zip(batch, ex.map(lambda t: window(cl, inv, sid, t, Q.CHUNK_S), batch)):
                if x is None or n_chunks >= N_CHUNKS:
                    continue
                n_chunks += 1
                for j in range(Q.QUIET_PER_CHUNK):
                    s0 = Q.HISTORY_S + j * Q.DETECT_S
                    tw = t + pd.Timedelta(seconds=s0)
                    sc = Q.detector_scores(x, s0, Q.learned_normal(mlog, tw, tz, ordinary))
                    if sc:
                        for d in DETECTORS:
                            if sc[d] is not None:
                                quiet_scores[d].append(sc[d])
        thr = {d: (float(np.percentile(v, 99)) if v else np.nan) for d, v in quiet_scores.items()}

        rows = []
        starts = [t - pd.Timedelta(seconds=Q.HISTORY_S) for t in primary["time"]]
        xs = list(ex.map(lambda t: window(cl, inv, sid, t, Q.HISTORY_S + Q.DETECT_S), starts))
    for (_, e), x in zip(primary.iterrows(), xs):
        if x is None:
            continue
        sc = Q.detector_scores(x, Q.HISTORY_S, Q.learned_normal(mlog, e["time"], tz, ordinary))
        if not sc or any(sc[d] is None for d in DETECTORS):
            continue
        rows.append({"station": sid, "city": r["city"], "event": e["id"], "time": e["time"],
                     "mag": e["mag"], "dist_km": round(float(e["dist_km"]), 1),
                     **{f"score_{d}": sc[d] for d in DETECTORS},
                     **{f"found_{d}": bool(sc[d] > thr[d]) for d in DETECTORS}})
    ev = pd.DataFrame(rows)
    st = {"station": sid, "city": r["city"], "events_in_catalogue": n_primary_all,
          "events_sampled": len(primary), "events_scored": len(ev), "quiet_chunks": n_chunks,
          **{f"quiet_windows_{d}": len(quiet_scores[d]) for d in DETECTORS},
          **{f"threshold_{d}": thr[d] for d in DETECTORS},
          **{f"found_{d}": int(ev[f"found_{d}"].sum()) if len(ev) else 0 for d in DETECTORS}}
    return ev, st


def compare(ev, a, b):
    a_only = int((ev[f"found_{a}"] & ~ev[f"found_{b}"]).sum())
    b_only = int((ev[f"found_{b}"] & ~ev[f"found_{a}"]).sum())
    return a_only, b_only, mcnemar_exact(a_only, b_only)


def main():
    os.makedirs(TABLES, exist_ok=True)
    global_big = usgs("global_M6.5", minmagnitude=6.5)
    events, stations = [], []
    for _, r in roster().iterrows():
        ev, st = run_station(r, global_big)
        if st is None:
            continue
        stations.append(st)
        if len(ev):
            events.append(ev)
        print(f"{st['city']:28s} events {st['events_scored']:3d}/{st['events_sampled']:3d} "
              f"(catalogue {st['events_in_catalogue']:5d})  quiet chunks {st['quiet_chunks']:3d}  found "
              + "  ".join(f"{d} {st[f'found_{d}']:3d}" for d in DETECTORS), flush=True)
    ev = pd.concat(events, ignore_index=True)
    sts = pd.DataFrame(stations)
    ev.to_csv(os.path.join(TABLES, "quake_waveform_events.csv"), index=False, float_format="%.4f")
    sts.to_csv(os.path.join(TABLES, "quake_waveform_stations.csv"), index=False, float_format="%.4f")

    n = len(ev)
    found = {d: int(ev[f"found_{d}"].sum()) for d in DETECTORS}
    print(f"\n{n} station-earthquake pairs at {ev['station'].nunique()} stations. Found: {found}")
    if max(found.values()) < 20:
        print("PRIMARY: inconclusive (fewer than 20 found by any detector)")
    lo, ro, p = compare(ev, "learned", "raw")
    verdict = "SUPPORTED" if (found["learned"] > found["raw"] and p < 0.05) else "NOT SUPPORTED"
    print(f"PRIMARY learned vs raw: learned only {lo}, raw only {ro}, exact McNemar p = {p:.4g} -> {verdict}")
    for a, b in [("rolling", "raw"), ("learned", "rolling")]:
        x, y, p2 = compare(ev, a, b)
        print(f"secondary {a} vs {b}: {a} only {x}, {b} only {y}, p = {p2:.4g}")
    top = ev["station"].value_counts().index[0]
    rest = ev[ev["station"] != top]
    x, y, p3 = compare(rest, "learned", "raw")
    print(f"secondary without {top} ({(ev['station'] == top).sum()} pairs): learned only {x}, raw only {y}, p = {p3:.4g}; "
          + ", ".join(f"{d} {int(rest[f'found_{d}'].sum())}" for d in DETECTORS))
    ev["mag_band"] = pd.cut(ev["mag"], [2, 3, 4, 10], right=False, labels=["2-3", "3-4", ">=4"])
    ev["dist_band"] = pd.cut(ev["dist_km"], [0, 30, 60, 100.01], right=False, labels=["0-30", "30-60", "60-100"])
    for band in ["mag_band", "dist_band"]:
        print(ev.groupby(band, observed=False)[[f"found_{d}" for d in DETECTORS]].agg(["sum", "count"]).to_string())

    # plot: share found by magnitude band
    g = ev.groupby("mag_band", observed=False)[[f"found_{d}" for d in DETECTORS]].mean() * 100
    cnt = ev.groupby("mag_band", observed=False).size()
    fig, ax = plt.subplots(figsize=(11, 6))
    w = 0.26
    colours = {"raw": "#888", "rolling": "#4a7fb5", "learned": "#d2691e"}
    for k, d in enumerate(DETECTORS):
        xs = np.arange(len(g)) + (k - 1) * w
        ax.bar(xs, g[f"found_{d}"], width=w, color=colours[d], label=d)
        for xi, v in zip(xs, g[f"found_{d}"]):
            ax.text(xi, v + 1, f"{v:.0f}%", ha="center", fontsize=11)
    ax.set_xticks(range(len(g)), [f"M {b}\n({c} pairs)" for b, c in zip(g.index, cnt)], fontsize=13)
    ax.set_ylabel("Earthquakes found at 1% false alarms (%)", fontsize=13)
    ax.set_ylim(0, 105)
    ax.set_title(f"Second-by-second: learned vs raw, p = {p:.2g} ({verdict.lower()})", fontsize=16, loc="left")
    ax.legend(fontsize=13, frameon=False)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    fig.text(0.01, 0.005, f"{n} station-earthquake pairs, {ev['station'].nunique()} stations, 2021-2026, ComCat M>=2 "
             "within 100 km, EarthScope waveforms. Pre-registered: docs/20. src/quake_waveform.py",
             fontsize=9, color="#777")
    fig.tight_layout(rect=(0, 0.03, 1, 1))
    fig.savefig(os.path.join(PLOTS, "quake_waveform_found.png"), dpi=150)
    print("wrote outputs/tables/quake_waveform_*.csv and outputs/plots/quake_waveform_found.png")


if __name__ == "__main__":
    main()
