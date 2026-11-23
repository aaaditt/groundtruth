"""
noisefloor.py -- the learned human noise floor, and three ways to look for earthquakes.

The rest of the project treats the city's hum as the SIGNAL. This module flips it: it
learns what a station normally sounds like at each hour of each weekday, subtracts that,
and asks whether small earthquakes stand out better in what is left
(docs/17-noise-floor-preregistration.md).

Everything works on log10 of the 15-minute RMS (4-14 Hz), one value per sample.

Three detector scores per sample:
  raw      : the log-RMS itself -> a fixed threshold, same at 3 a.m. and at rush hour
  rolling  : log-RMS minus the median of the surrounding 2 hours -> adapts, learns nothing
  learned  : (log-RMS - normal) / spread, where "normal" and "spread" are the median and
             MAD for this station, weekday and local hour, taken from OTHER weeks only
"""
import numpy as np
import pandas as pd
from sklearn.model_selection import GroupKFold

from groundtruth.features import BAND

DETECTORS = ["raw", "rolling", "learned"]
MIN_CELL = 8            # a (weekday, hour) cell needs at least this many samples
MIN_SPREAD = 0.01       # log10 units; stops a near-constant cell dividing by ~0
WINDOW = pd.Timedelta("30min")   # an event's score = best score within +/- 30 min


def load_raw_log_rms(path, tz):
    """15-minute log10 RMS in LOCAL time, with only impossible values and drop-outs
    removed. Unlike features.clean_rms we KEEP the very loud samples: a small earthquake
    is exactly a short loud burst, and the 100x-above-median filter would delete it."""
    df = pd.read_csv(path, index_col=0)
    if BAND not in df.columns:
        return None
    s = df[BAND].astype(float)
    s.index = pd.to_datetime(df.index, utc=True, format="mixed").tz_convert(tz)
    s = s[(s > 0) & np.isfinite(s)]
    s = s[s > s.median() / 100]          # sensor drop-outs write near-zero values
    s = s[~s.index.duplicated()].sort_index()
    return np.log10(s)


def _cell_keys(index):
    """(weekday, local hour) for every sample, e.g. (1, 8) = Tuesday 08:00-08:59."""
    return pd.MultiIndex.from_arrays([index.dayofweek, index.hour], names=["dow", "hour"])


def fit_floor(x):
    """The noise floor: median and robust spread (1.4826 x MAD) of log-RMS for each
    (weekday, hour) cell. Cells with too few samples are left out."""
    keys = _cell_keys(x.index)
    g = pd.Series(x.values, index=keys).groupby(level=["dow", "hour"])
    med = g.median()
    mad = g.apply(lambda v: 1.4826 * np.median(np.abs(v - np.median(v))))
    n = g.size()
    floor = pd.DataFrame({"normal": med, "spread": np.maximum(mad, MIN_SPREAD), "n": n})
    return floor[floor["n"] >= MIN_CELL]


def apply_floor(x, floor):
    """Expected level and residual z-score for each sample, from a fitted floor."""
    cells = floor.reindex(_cell_keys(x.index))
    normal = pd.Series(cells["normal"].values, index=x.index)
    spread = pd.Series(cells["spread"].values, index=x.index)
    return normal, (x - normal) / spread


def score_out_of_fold(x, eval_mask, n_splits=5):
    """Detector scores for every sample. The learned floor for a sample comes from
    baseline samples in OTHER weeks (GroupKFold by ISO week), so no sample is ever
    judged against a normal that already contains it.

    x         : log-RMS series (local time)
    eval_mask : boolean Series, True for samples on baseline days
    """
    out = pd.DataFrame({"x": x})
    out["raw"] = x
    # centred 2-hour window (9 samples); the median ignores a single loud sample
    out["rolling"] = x - x.rolling("2h", center=True, min_periods=5).median()
    out["learned"] = np.nan
    base = x[eval_mask]
    iso = base.index.isocalendar()
    weeks = (iso["year"].astype(int) * 100 + iso["week"].astype(int)).values
    if len(np.unique(weeks)) < n_splits:
        return out
    for tr, te in GroupKFold(n_splits).split(base, groups=weeks):
        floor = fit_floor(base.iloc[tr])
        _, z = apply_floor(base.iloc[te], floor)
        out.loc[z.index, "learned"] = z.values
    return out


def _ns(times):
    """Times as integer NANOseconds since 1970 (UTC). pandas may store times in micro- or
    nanoseconds; comparing the two silently gives nonsense, so always convert first."""
    return pd.DatetimeIndex(times).tz_convert("UTC").as_unit("ns").asi8


def window_max(scores, times):
    """For each time t in `times`, the highest score within +/- 30 minutes of t.
    `scores` must be sorted by time. Returns an array (NaN where there are no samples)."""
    idx = _ns(scores.index)
    vals = scores.values
    lo = np.searchsorted(idx, _ns(times - WINDOW), side="left")
    hi = np.searchsorted(idx, _ns(times + WINDOW), side="right")
    out = np.full(len(times), np.nan)
    for i, (a, b) in enumerate(zip(lo, hi)):
        if b > a:
            v = vals[a:b]
            if np.isfinite(v).any():
                out[i] = np.nanmax(v)
    return out


def quiet_mask(sample_times, event_times, gap=pd.Timedelta("2h")):
    """True for samples more than `gap` away from every given event time."""
    if len(event_times) == 0:
        return np.ones(len(sample_times), dtype=bool)
    ev = np.sort(_ns(event_times))
    st = _ns(sample_times)
    pos = np.searchsorted(ev, st)
    before = np.abs(st - ev[np.clip(pos - 1, 0, len(ev) - 1)])
    after = np.abs(ev[np.clip(pos, 0, len(ev) - 1)] - st)
    return np.minimum(before, after) > gap.value


def mcnemar_exact(a_only, b_only):
    """Two-sided exact McNemar test: of the pairs found by exactly one detector, is the
    split further from 50/50 than chance? Returns the p-value."""
    from scipy.stats import binomtest
    n = a_only + b_only
    if n == 0:
        return 1.0
    return float(binomtest(a_only, n, 0.5).pvalue)


def distance_km(lat1, lon1, lat2, lon2):
    """Great-circle distance (haversine), in km."""
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dp, dl = p2 - p1, np.radians(np.asarray(lon2) - lon1)
    a = np.sin(dp / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
    return 6371.0 * 2 * np.arcsin(np.sqrt(a))
