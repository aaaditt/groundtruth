"""
noise_floor.py -- slide 06 "Subtract the people, see what's underneath", and "The loop".

Pre-registered in docs/17-noise-floor-preregistration.md (read that first).

The idea: a model that knows what a station normally sounds like at 08:00 on a Tuesday
gives a LEARNED NOISE FLOOR. Subtract it, and a small earthquake hidden under rush hour
might stand out. We test that against real earthquakes from the USGS catalogue:

  * three detectors (raw / rolling / learned, see groundtruth/noisefloor.py);
  * each gets its own threshold so it raises false alarms in ~1% of quiet hours;
  * count how many catalogued earthquakes (M >= 2.0, within 100 km) each one finds,
    on baseline days only, with the learned floor always fitted on OTHER weeks.

Downloads (once, cached in data/cache/noise_floor/, ~6 minutes at 1 request/second):
  station positions (FDSN station service) and the USGS earthquake catalogue.

Outputs:
  outputs/tables/noise_floor_station_coords.csv   checked station positions
  outputs/tables/noise_floor_events.csv           one row per station-earthquake pair
  outputs/tables/noise_floor_summary.csv          found / missed per detector
  outputs/plots/noise_floor_found.png             found share by magnitude
  outputs/plots/noise_floor_example.png           one earthquake, raw vs residual

Run:
  python src/noise_floor.py                          # the full experiment (all stations)
  python src/noise_floor.py --stations NC.MCY BK.BKS # quick test, prints only (saves nothing)
  python src/noise_floor.py --export AK.FA12        # "the loop": hand back a cleaned record
"""
import argparse, glob, io, os, sys, time

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))  # repo root
from groundtruth.models import load  # noqa: E402
from groundtruth.noisefloor import (DETECTORS, load_raw_log_rms, score_out_of_fold,  # noqa: E402
                                    fit_floor, apply_floor, window_max, quiet_mask,
                                    mcnemar_exact, distance_km)

ROOT = os.path.join("data", "external", "2020_Science_GlobalQuieting")
RMS_DIR = os.path.join(ROOT, "PaperZero_RMS")
TABLE_S1 = os.path.join(ROOT, "Supplementary Files", "Table S1 - Lockdown stations.csv")
CACHE = os.path.join("data", "cache", "noise_floor")
TABLES = os.path.join("outputs", "tables")
PLOTS = os.path.join("outputs", "plots")
COORDS = os.path.join(TABLES, "noise_floor_station_coords.csv")
CLEAN_DIR = os.path.join("outputs", "clean_signal")

# --- fixed by the pre-registration (docs/17, sections 3-5); do not tune ---------------
MIN_MAG, MAX_KM = 2.0, 100.0            # primary events
PCTS = {"p99": 99.0, "p99.9": 99.9}      # false-alarm levels; p99 is the primary one
CAT_START, CAT_END = "2019-10-01", "2020-06-15"
STATION_DATE = "2020-01-15"              # choose the station epoch covering this date
QUIET_MIN_MAG, QUIET_GAP = 1.5, pd.Timedelta("1h")   # Amendment 1 (docs/17)
# -------------------------------------------------------------------------------------

USGS = "https://earthquake.usgs.gov/fdsnws/event/1/query"
STATION_SERVICES = [  # tried in order; "EIDA" = ask the EIDA routing service which
    "https://service.earthscope.org/fdsnws/station/1/query",   # European data centre
    "EIDA",                                                     # holds the station
    "https://data.raspberryshake.org/fdsnws/station/1/query",
]
EIDA_ROUTING = "https://www.orfeus-eu.org/eidaws/routing/1/query"


def _eida_station_url(client, net, sta):
    """The station-service URL of the European data centre that holds NET.STA."""
    r = client.get(EIDA_ROUTING, params={"net": net, "sta": sta, "service": "station",
                                         "format": "post"}, timeout=60, retries=1)
    first = r.text.strip().splitlines()[0] if r.status_code == 200 and r.text.strip() else ""
    return first if first.startswith("https://") else None


# ---------------------------------------------------------------- downloads (cached)
def station_coords(codes):
    """Position of each station in early 2020, from the FDSN station service (Table S1
    has stations in the wrong country, see CLAUDE.md). Saved to a committed table."""
    have = pd.read_csv(COORDS, keep_default_na=False) if os.path.exists(COORDS) else pd.DataFrame(
        columns=["station", "lat", "lon", "site_name", "service", "queried"])
    found = set(have.loc[have["service"] != "not found", "station"])
    missing = [c for c in codes if c not in found]       # "not found" ones are retried
    have = have[have["station"].isin(found)]
    if missing:
        from groundtruth import client
        rows = []
        for code in missing:
            net, sta = code.split(".")
            row = {"station": code, "lat": "", "lon": "", "site_name": "", "service": "not found",
                   "queried": time.strftime("%Y-%m-%d")}
            for url in STATION_SERVICES:
                try:
                    if url == "EIDA":
                        url = _eida_station_url(client, net, sta)
                        if url is None:
                            continue
                    r = client.get(url, params={"net": net, "sta": sta, "level": "station",
                                                "format": "text", "startbefore": STATION_DATE,
                                                "endafter": STATION_DATE}, timeout=60, retries=1)
                except Exception:      # one service down must not stop the others
                    continue
                lines = [ln.split("|") for ln in r.text.splitlines()
                         if r.status_code == 200 and ln and not ln.startswith("#")]
                if lines:
                    row.update(lat=float(lines[0][2]), lon=float(lines[0][3]),
                               site_name=lines[0][5], service=url.split("/")[2])
                    break
            print(f"  position {code:10s} {row['service']}")
            rows.append(row)
        have = pd.concat([have, pd.DataFrame(rows)], ignore_index=True)
        os.makedirs(TABLES, exist_ok=True)
        have.to_csv(COORDS, index=False)
    have = have[have["service"] != "not found"].copy()
    have[["lat", "lon"]] = have[["lat", "lon"]].astype(float)
    return have.set_index("station")


def usgs(name, **params):
    """One USGS catalogue query, cached as CSV. Returns a DataFrame (maybe empty)."""
    path = os.path.join(CACHE, f"{name}.csv")
    if not os.path.exists(path):
        from groundtruth import client
        q = {"format": "csv", "starttime": CAT_START, "endtime": CAT_END,
             "orderby": "time-asc", "limit": 20000, **params}
        r = client.get(USGS, params=q)
        os.makedirs(CACHE, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(r.text if r.status_code == 200 else "")
    if os.path.getsize(path) == 0:
        return pd.DataFrame(columns=["time", "latitude", "longitude", "mag", "id"])
    ev = pd.read_csv(path)
    if len(ev) >= 20000:
        print(f"  WARNING: {name} hit the 20,000-event limit; the catalogue is truncated")
    ev["time"] = pd.to_datetime(ev["time"], utc=True, format="mixed")
    return ev


def catalogue(code, lat, lon, global_big):
    """Local events (any magnitude, <= 100 km), regional M>=4.5 (<= 1000 km) and the
    global M>=6.5 list. Returns (primary events, all event times used to define quiet)."""
    local = usgs(f"{code}_local", latitude=lat, longitude=lon, maxradiuskm=MAX_KM)
    regional = usgs(f"{code}_regional", latitude=lat, longitude=lon, maxradiuskm=1000,
                    minmagnitude=4.5)
    local = local.copy()
    local["dist_km"] = distance_km(lat, lon, local["latitude"].values, local["longitude"].values)
    primary = local[(local["mag"] >= MIN_MAG) & (local["dist_km"] <= MAX_KM)]
    # Amendment 1 (docs/17): tiny local events (M < 1.5) do not spoil a quiet hour
    noisy = pd.concat([local.loc[local["mag"] >= QUIET_MIN_MAG, "time"], regional["time"],
                       global_big["time"]])
    return primary, pd.DatetimeIndex(noisy)


# ---------------------------------------------------------------- the experiment
def station_inputs():
    meta = pd.read_csv(TABLE_S1, encoding="latin-1").drop_duplicates("Station_Code")
    meta = meta.set_index("Station_Code")
    files = {".".join(os.path.basename(f).split(".")[:2]): f
             for f in glob.glob(os.path.join(RMS_DIR, "*.csv"))}
    days = load()
    base = days[days["period"] == "baseline"].groupby("station")["date"].apply(
        lambda d: set(d.dt.date))
    return meta, files, base


def score_station(code, path, tz, baseline_days):
    x = load_raw_log_rms(path, tz)
    if x is None or len(x) < 1000:
        return None
    on_base = pd.Series(np.isin(x.index.date, list(baseline_days)), index=x.index)
    sc = score_out_of_fold(x, on_base)
    sc = sc[on_base & sc[DETECTORS].notna().all(axis=1)]   # same samples for everyone
    return sc


def run_station(code, sc, primary, noisy):
    """Thresholds from quiet samples, then the score of every primary earthquake."""
    times = sc.index
    quiet = quiet_mask(times, noisy, gap=QUIET_GAP)
    if quiet.sum() < 500:
        return None, None
    rows, thr = [], {"station": code, "quiet_samples": int(quiet.sum())}
    qt = times[quiet]
    for d in DETECTORS:
        s = sc[d]
        qmax = window_max(s, qt)
        for k, p in PCTS.items():
            thr[f"thr_{d}_{k}"] = float(np.nanpercentile(qmax, p))
    if len(primary):
        ev_local = pd.DatetimeIndex(primary["time"]).tz_convert(times.tz)
        keep = np.isin(ev_local.date, list(set(times.date)))     # baseline days only
        ev = primary[keep]
        ev_local = ev_local[keep]
        for d in DETECTORS:
            ev = ev.assign(**{f"score_{d}": window_max(sc[d], ev_local)})
        ev = ev.dropna(subset=[f"score_{d}" for d in DETECTORS])
        for _, e in ev.iterrows():
            row = {"station": code, "event_id": e["id"], "time_utc": e["time"],
                   "mag": e["mag"], "magType": e.get("magType", ""), "dist_km": round(e["dist_km"], 1),
                   "place": e.get("place", "")}
            for d in DETECTORS:
                row[f"score_{d}"] = e[f"score_{d}"]
                for k in PCTS:
                    row[f"found_{d}_{k}"] = bool(e[f"score_{d}"] > thr[f"thr_{d}_{k}"])
            rows.append(row)
    return rows, thr


def summarise(events, n_stations):
    lines, summary = [], []
    for k in PCTS:
        for a, b in [("learned", "raw"), ("learned", "rolling"), ("rolling", "raw")]:
            fa, fb = events[f"found_{a}_{k}"], events[f"found_{b}_{k}"]
            a_only, b_only = int((fa & ~fb).sum()), int((~fa & fb).sum())
            p = mcnemar_exact(a_only, b_only)
            summary.append({"false_alarm_level": k, "detector_a": a, "detector_b": b,
                            "pairs": len(events), "found_a": int(fa.sum()), "found_b": int(fb.sum()),
                            "a_only": a_only, "b_only": b_only, "p_mcnemar": round(p, 4)})
    s = pd.DataFrame(summary)
    lines.append(f"\n{len(events)} station-earthquake pairs (M>={MIN_MAG}, <= {MAX_KM:.0f} km, "
                 f"baseline days) at {events['station'].nunique()} of {n_stations} stations")
    for k in PCTS:
        found = {d: int(events[f'found_{d}_{k}'].sum()) for d in DETECTORS}
        lines.append(f"  found at {k}: " + ", ".join(f"{d} {n}" for d, n in found.items()))
    prim = s[(s.false_alarm_level == "p99") & (s.detector_a == "learned") & (s.detector_b == "raw")].iloc[0]
    any_found = int(events[[f"found_{d}_p99" for d in DETECTORS]].any(axis=1).sum())
    if any_found < 20:
        verdict = f"INCONCLUSIVE: only {any_found} events found by any detector (< 20)"
    elif prim.found_a > prim.found_b and prim.p_mcnemar < 0.05:
        verdict = "SUCCESS: learned finds more than raw, p < 0.05"
    else:
        verdict = "NOT SUPPORTED: learned does not find significantly more than raw"
    lines.append(f"\nPRIMARY (p99, learned vs raw): learned only {prim.a_only}, raw only "
                 f"{prim.b_only}, exact McNemar p = {prim.p_mcnemar:.4g}\n  -> {verdict}")
    return s, "\n".join(lines)


# ---------------------------------------------------------------- plots
def plot_found(events):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    bins = [2.0, 2.5, 3.0, 3.5, 4.0, 10]
    labels = ["2.0-2.5", "2.5-3.0", "3.0-3.5", "3.5-4.0", "4.0+"]
    band = pd.cut(events["mag"], bins, right=False, labels=labels)
    fig, ax = plt.subplots(figsize=(10, 5.5))
    w = 0.27
    for i, (d, c) in enumerate(zip(DETECTORS, ["#9aa3ad", "#c9a227", "#b5541c"])):
        share = events.groupby(band, observed=False)[f"found_{d}_p99"].mean() * 100
        ax.bar(np.arange(len(labels)) + (i - 1) * w, share.values, w, label=d, color=c)
    n = events.groupby(band, observed=False).size()
    ax.set_xticks(range(len(labels)))
    ax.set_xticklabels([f"M {l}\n(n={n[l]})" for l in labels], fontsize=12)
    ax.set_ylabel("% of catalogued earthquakes found", fontsize=13)
    ax.set_title("Same false-alarm rate (1% of quiet hours): which detector finds more?", fontsize=14)
    ax.legend(fontsize=12, frameon=False)
    ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout()
    os.makedirs(PLOTS, exist_ok=True)
    fig.savefig(os.path.join(PLOTS, "noise_floor_found.png"), dpi=150)
    plt.close(fig)


def plot_example(events, scores, thresholds):
    """The clearest case the learned floor finds and the raw threshold misses (if any):
    the day's record with its learned normal, and the residual with its threshold."""
    cand = events[events["found_learned_p99"] & ~events["found_raw_p99"]]
    if cand.empty:
        cand = events[events["found_learned_p99"]]
    if cand.empty:
        return None
    # clearest case = widest margin above the station's learned threshold
    t_by = thresholds.set_index("station")["thr_learned_p99"]
    margin = cand["score_learned"] - cand["station"].map(t_by)
    e = cand.loc[margin.idxmax()]
    sc = scores[e["station"]]
    t = pd.Timestamp(e["time_utc"]).tz_convert(sc.index.tz)
    day = sc[(sc.index >= t - pd.Timedelta("12h")) & (sc.index <= t + pd.Timedelta("12h"))]
    floor = fit_floor(sc["x"])          # display only: the floor over all baseline weeks
    normal, _ = apply_floor(day["x"], floor)
    thr = thresholds.set_index("station").loc[e["station"]]
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, (a1, a2) = plt.subplots(2, 1, figsize=(11, 7), sharex=True)
    a1.plot(day.index, day["x"], color="#1d2430", lw=1.5, label="recorded")
    a1.plot(normal.index, normal.values, color="#b5541c", lw=2, ls="--", label="learned normal for this hour and weekday")
    a1.axhline(thr["thr_raw_p99"], color="#9aa3ad", lw=1.2, label="raw threshold")
    a1.set_ylabel("log10 RMS (4-14 Hz)", fontsize=12)
    a1.legend(fontsize=10, frameon=False, loc="upper left")
    a2.plot(day.index, day["learned"], color="#b5541c", lw=1.5, label="residual (recorded - normal) / spread")
    a2.axhline(thr["thr_learned_p99"], color="#1d2430", lw=1.2, ls=":", label="learned threshold")
    a2.set_ylabel("residual (z)", fontsize=12)
    a2.legend(fontsize=10, frameon=False, loc="upper left")
    for a in (a1, a2):
        a.axvline(t, color="#c9a227", lw=2, alpha=0.7)
        a.spines[["top", "right"]].set_visible(False)
    fig.suptitle(f"{e['station']}: M{e['mag']:.1f}, {e['dist_km']:.0f} km away, "
                 f"{t:%a %d %b %Y %H:%M} local (yellow line)", fontsize=14)
    fig.tight_layout()
    fig.savefig(os.path.join(PLOTS, "noise_floor_example.png"), dpi=150)
    plt.close(fig)
    return e


# ---------------------------------------------------------------- "the loop"
def export(code):
    """Hand back a cleaned record: every 15-minute sample with the station's learned
    normal level and the residual. Fitted on all baseline weeks (a product, not a test)."""
    meta, files, base = station_inputs()
    if code not in files or code not in base.index:
        sys.exit(f"{code}: no RMS file or no baseline days")
    x = load_raw_log_rms(files[code], meta.loc[code, "TimeZone"])
    on_base = np.isin(x.index.date, list(base[code]))
    floor = fit_floor(x[on_base])
    normal, z = apply_floor(x, floor)
    days = load()
    period = days[days["station"] == code].set_index(days.loc[days["station"] == code, "date"].dt.date)["period"]
    out = pd.DataFrame({
        "time_local": x.index.strftime("%Y-%m-%d %H:%M"),
        "time_utc": x.index.tz_convert("UTC").strftime("%Y-%m-%d %H:%M"),
        "period": [period.get(d, "") for d in x.index.date],
        "log10_rms": x.values.round(4),
        "learned_normal": normal.values.round(4),
        "residual": (x - normal).values.round(4),
        "residual_z": z.values.round(3)})
    os.makedirs(CLEAN_DIR, exist_ok=True)
    path = os.path.join(CLEAN_DIR, f"{code}.csv")
    out.to_csv(path, index=False)
    print(f"{code}: {len(out)} samples -> {path}")
    print(f"  learned normal from {int(on_base.sum())} baseline samples, "
          f"{len(floor)} of 168 weekday-hour cells filled")
    print(f"  spread of the record:   raw {x.std():.3f}   after subtracting normal "
          f"{(x - normal).std():.3f}  (log10 units)")
    print(out.head(3).to_string(index=False))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stations", nargs="*", help="only these stations (quick test)")
    ap.add_argument("--export", help="write a cleaned record for one station and stop")
    args = ap.parse_args()
    if args.export:
        return export(args.export)

    t0 = time.time()
    meta, files, base = station_inputs()
    codes = [c for c in base.index if c in files and c in meta.index]
    if args.stations:
        unknown = [s for s in args.stations if s not in codes]
        if unknown:
            print(f"Unknown station(s), skipped: {' '.join(unknown)} (use NET.STA, e.g. BK.BKS)")
        codes = [c for c in codes if c in args.stations]
    coords = station_coords(codes)
    lost = [c for c in codes if c not in coords.index]
    if lost:
        print(f"No checked position for {len(lost)} stations (left out): {' '.join(lost)}")
    global_big = usgs("global_m6.5", minmagnitude=6.5)

    all_rows, all_thr, scores = [], [], {}
    for code in [c for c in codes if c in coords.index]:
        lat, lon = coords.loc[code, "lat"], coords.loc[code, "lon"]
        primary, noisy = catalogue(code, lat, lon, global_big)
        sc = score_station(code, files[code], meta.loc[code, "TimeZone"], base[code])
        if sc is None or sc.empty:
            continue
        rows, thr = run_station(code, sc, primary, noisy)
        if thr is None:
            continue
        all_thr.append(thr)
        all_rows += rows
        if rows:
            scores[code] = sc
            print(f"{code:10s} {len(rows):4d} earthquakes  found p99: "
                  + " ".join(f"{d}={sum(r[f'found_{d}_p99'] for r in rows)}" for d in DETECTORS))

    thresholds = pd.DataFrame(all_thr)
    if not all_rows:
        print(f"\nNo catalogued M>={MIN_MAG} earthquakes within {MAX_KM:.0f} km on baseline days "
              f"for these {len(thresholds)} stations: nothing to test.")
        return
    events = pd.DataFrame(all_rows)
    summary, text = summarise(events, len(thresholds))
    print(text)
    if args.stations:
        # a quick test must never overwrite the full experiment's published tables/plots
        print(f"\nQuick test on {len(thresholds)} stations: nothing saved. "
              f"Run without --stations for the full experiment. ({time.time() - t0:.0f} s)")
        return
    os.makedirs(TABLES, exist_ok=True)
    events.to_csv(os.path.join(TABLES, "noise_floor_events.csv"), index=False)
    summary.to_csv(os.path.join(TABLES, "noise_floor_summary.csv"), index=False)
    plot_found(events)
    e = plot_example(events, scores, thresholds)
    if e is not None:
        print(f"\nExample plot: {e['station']} M{e['mag']} {e['dist_km']} km, {e['time_utc']}")
    print(f"\nDone in {time.time() - t0:.0f} s. Tables in {TABLES}, plots in {PLOTS}")


if __name__ == "__main__":
    main()
