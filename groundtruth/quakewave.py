"""quakewave.py -- "subtract the people", second by second (pre-registered in docs/20).

Result 19 tried to find small earthquakes in 15-minute averages, where a quake that lasts
seconds is blurred away. This module works on the WAVEFORM: the recording itself, many
samples a second. The steps, for one window of recording:

  1. waveform -> displacement, 4-14 Hz              (processed_log_rms)
  2. -> one number per second: log10 of that second's RMS
  3. three detectors score each second              (detector_scores)
       raw      : the number itself
       rolling  : minus the median of the 300 seconds before the window
       learned  : minus what this city NORMALLY sounds like at this weekday and hour
                  (from 8 weeks of MUSTANG spectra BEFORE the window), divided by its spread
  4. a window's score = its highest second.

Each detector then gets its own threshold, set on quiet windows so that all three raise
false alarms equally often (1%). Then: which finds more catalogued earthquakes?
"""
import numpy as np
import pandas as pd

BAND = (4.0, 14.0)
HISTORY_S = 300          # the rolling detector's look-back, seconds
DETECT_S = 90            # detection window from the origin time, seconds
CHUNK_S = 900            # a quiet chunk: 15 minutes
QUIET_PER_CHUNK = 6      # 90-second quiet windows scored per chunk
REF_WEEKS = 8            # the learned normal looks back this many weeks ...
MIN_REF = 6              # ... and needs at least this many MUSTANG values
MIN_SPREAD = 0.01        # log10 units; stops a near-constant hour dividing by ~0


def _demean_taper(x, frac=0.02):
    """Remove the mean and fade the first and last 2% to zero (a Tukey window), so the
    filter does not ring on the window's sharp edges."""
    from scipy.signal.windows import tukey
    return (x - x.mean()) * tukey(len(x), 2 * frac)


def processed_log_rms(data, sampling_rate, sensitivity, input_units):
    """Raw samples (counts, no gaps) -> log10 RMS of each whole second of 4-14 Hz
    displacement. `sensitivity` converts counts to physical units; input_units is the
    StationXML input unit: velocity ("M/S") is integrated once, acceleration ("M/S**2")
    twice, to get displacement, the quantity Lecocq et al. (2020) and MUSTANG use."""
    from scipy.integrate import cumulative_trapezoid
    from scipy.signal import butter, sosfiltfilt
    x = np.asarray(data, dtype=np.float64) / sensitivity
    u = input_units.upper().replace(" ", "")
    n_int = 2 if ("**2" in u or "S^2" in u or "/S2" in u) else 1 if u in ("M/S", "M/SEC") else None
    if n_int is None:
        raise ValueError(f"unexpected input units {input_units!r}")
    for _ in range(n_int):
        x = cumulative_trapezoid(_demean_taper(x), dx=1 / sampling_rate, initial=0)
    sos = butter(4, BAND, btype="bandpass", fs=sampling_rate, output="sos")
    x = sosfiltfilt(sos, _demean_taper(x))           # zero-phase: forward and backward
    sr = int(round(sampling_rate))
    n = len(x) // sr
    rms = np.sqrt((x[: n * sr].reshape(n, sr) ** 2).mean(axis=1))
    with np.errstate(divide="ignore"):
        return np.log10(rms)


def learned_normal(mustang_log, t_utc, tz, ordinary_dates):
    """Median and spread of log10 MUSTANG RMS at the same local weekday and hour as t, over
    the REF_WEEKS weeks before t's local day, ordinary days only. Returns (median, spread)
    or (nan, nan) when fewer than MIN_REF values exist. Uses only days strictly before t's
    day, so the window itself is never part of its own normal.

    mustang_log: Series of log10 RMS indexed by UTC start time. ordinary_dates: set of
    local dates (datetime.date) that are ordinary (baseline) days."""
    t_local = pd.Timestamp(t_utc).tz_convert(tz)
    # local midnight; on a day when the clocks jump at midnight (e.g. Chile) it doesn't
    # exist, so take the first moment after the jump
    day0 = t_local.tz_localize(None).normalize().tz_localize(tz, nonexistent="shift_forward",
                                                              ambiguous=True)
    lo = day0 - pd.Timedelta(weeks=REF_WEEKS)
    s = mustang_log[(mustang_log.index >= lo.tz_convert("UTC")) & (mustang_log.index < day0.tz_convert("UTC"))]
    if s.empty:
        return np.nan, np.nan
    loc = s.index.tz_convert(tz)
    keep = ((loc.dayofweek == t_local.dayofweek) & (loc.hour == t_local.hour)
            & np.array([d in ordinary_dates for d in loc.date]))
    ref = s.values[keep]
    if len(ref) < MIN_REF:
        return np.nan, np.nan
    med = float(np.median(ref))
    return med, float(1.4826 * np.median(np.abs(ref - med)))


def detector_scores(x, start, normal):
    """Score one detection window. x: per-second log RMS of a longer stretch; `start` is the
    index of the window's first second (the HISTORY_S seconds before it are the rolling
    history); normal: (median, spread) from learned_normal. Returns {detector: score}, the
    highest second in the window, or None for a detector that cannot be scored."""
    hist = x[start - HISTORY_S:start]
    win = x[start:start + DETECT_S]
    if start < HISTORY_S or len(win) < DETECT_S or not np.isfinite(win).all():
        return None
    out = {"raw": float(win.max())}
    h = hist[np.isfinite(hist)]
    out["rolling"] = float((win - np.median(h)).max()) if len(h) >= HISTORY_S // 2 else None
    med, spread = normal
    out["learned"] = (float(((win - med) / max(spread, MIN_SPREAD)).max())
                      if np.isfinite(med) else None)
    return out


def quiet_ok(t, noisy_times, chunk_s=CHUNK_S, gap=pd.Timedelta("1h")):
    """True if no noisy event lies within `gap` of the chunk [t, t + chunk_s]."""
    lo, hi = t - gap, t + pd.Timedelta(seconds=chunk_s) + gap
    i = noisy_times.searchsorted(lo)
    return i >= len(noisy_times) or noisy_times[i] > hi


__all__ = ["BAND", "HISTORY_S", "DETECT_S", "CHUNK_S", "QUIET_PER_CHUNK", "REF_WEEKS", "MIN_REF",
           "processed_log_rms", "learned_normal", "detector_scores", "quiet_ok"]
