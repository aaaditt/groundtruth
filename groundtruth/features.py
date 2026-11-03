"""
features.py -- turn the paper's 15-minute RMS files into one row per LOCAL day.

For each station:
  1. Read the 4-14 Hz RMS column (the band Lecocq et al. 2020 use for human noise).
  2. Convert timestamps from UTC to the station's local time zone (rush hour is
     a local-time thing!).
  3. Take the median RMS in each local hour -> 24 numbers per day. Median, not
     mean, so a single passing truck or small earthquake doesn't dominate.
  4. Work in log10 (seismic amplitudes span orders of magnitude).
  5. Split into two kinds of feature:
       shape_00..shape_23 : that day's log-profile minus its own mean
                            -> WHEN the day was busy (comparable across stations)
       level              : the day's mean log-RMS, robust z-scored within the station
                            -> HOW busy overall (only meaningful within a station)
Days with fewer than 20 valid hours are dropped.
Note: stations store RMS in different units (m vs nm), which is another reason
we only ever compare a station against itself, or compare day SHAPES.
"""
import numpy as np
import pandas as pd

BAND = "4.0-14.0"
SHAPE_COLS = [f"shape_{h:02d}" for h in range(24)]
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def load_station_rms(path, tz):
    df = pd.read_csv(path, index_col=0)
    if BAND not in df.columns:
        return None
    s = df[BAND].astype(float)
    idx = pd.to_datetime(df.index, utc=True, format="mixed")
    s.index = idx.tz_convert(tz)
    s = s[(s > 0) & np.isfinite(s)]
    # Drop glitches: samples >100x above or below the station's typical level
    # (sensor dropouts write near-zero values; clipping/spikes write huge ones).
    med = s.median()
    s = s[(s > med / 100) & (s < med * 100)]
    return s


def daily_features(s, min_hours=20):
    hourly = np.log10(s).resample("1h").median()
    frame = pd.DataFrame({"v": hourly})
    frame["date"] = frame.index.date
    frame["hour"] = frame.index.hour
    table = frame.pivot_table(index="date", columns="hour", values="v", aggfunc="median")
    table = table.reindex(columns=range(24))
    table = table[table.notna().sum(axis=1) >= min_hours]
    # fill the odd missing hour by interpolating along the day
    table = table.interpolate(axis=1, limit_direction="both")
    level = table.mean(axis=1)
    shape = table.sub(level, axis=0)
    shape.columns = SHAPE_COLS
    out = shape.copy()
    out["level_raw"] = level
    out.index = pd.to_datetime(out.index)
    out.index.name = "date"
    out["day_of_week"] = out.index.day_of_week
    # is_weekend is NOT set here: weekends differ by country (and change over
    # time), so build_dataset.py sets it from config/weekends.csv.
    return out
