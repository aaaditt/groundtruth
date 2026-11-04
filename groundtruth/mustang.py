"""mustang.py -- Route A: recent noise levels from EarthScope's MUSTANG service.

MUSTANG (Casey et al. 2018, doi:10.1785/0220170191) computes a power spectrum for
every hour of data at EarthScope, every 30 minutes, for thousands of stations, and
serves them for free. So instead of downloading raw waveforms (hundreds of MB per
station-month) we download ready-made spectra (a few MB) -- that is "Route A".

What we compute from each spectrum: the 4-14 Hz DISPLACEMENT RMS, the same quantity
Lecocq et al. (2020) used. MUSTANG reports ACCELERATION power in dB re 1 (m/s^2)^2/Hz,
so per frequency bin:
    acceleration power   P_a = 10 ** (dB / 10)
    displacement power   P_d = P_a / (2 pi f)^4       (integrating twice in time)
    displacement variance    = sum of P_d * bin width over 4-14 Hz
    displacement RMS         = sqrt(variance)          [metres]
The result is a time series of RMS values, which goes through exactly the same
feature code as the Lecocq data (groundtruth.features.daily_features).

Time stamps: each spectrum covers one hour; we keep MUSTANG's own label, the START of
that hour, with no adjustment. So local hour h is the median of the spectra starting at
h:00 and h:30. (We first tried labelling by the window's middle; against the Lecocq data
on 6 stations, start labels agreed better at every one of them -- see docs/10-work-log.md.)

Data from this route is NEVER mixed with Lecocq data in one model or comparison of
levels: only unit-free quantities (day shapes, rankings) are compared across sources.
"""
import gzip
import io
import os
import re
from datetime import date, datetime, timedelta, timezone

import numpy as np
import pandas as pd

from groundtruth import client
from groundtruth.models import REPO

URL = "https://service.earthscope.org/mustang/noise-psd/1/query"
CACHE = os.path.join(REPO, "data", "cache", "mustang")
BAND = (4.0, 14.0)
SAFE_AFTER_DAYS = 10   # MUSTANG back-fills late data; only cache months older than this


def _month_starts(start, end):
    m = date(start.year, start.month, 1)
    while m < end:
        nxt = date(m.year + (m.month == 12), m.month % 12 + 1, 1)
        yield m, nxt
        m = nxt


def fetch_month(target, month_start, month_end):
    """Raw MUSTANG text for one calendar month (UTC). Cached on disk once the month is
    safely in the past, so re-running never re-downloads old data.

    The cache is gzip-compressed: the spectra are plain text and shrink ~5x
    (4.8 MB -> 0.9 MB per station-month). Older uncompressed .txt files still work."""
    path = os.path.join(CACHE, target, f"{month_start:%Y-%m}.txt.gz")
    if os.path.exists(path):
        with gzip.open(path, "rt", encoding="utf-8") as f:
            return f.read()
    legacy = path[:-3]
    if os.path.exists(legacy):
        with open(legacy, encoding="utf-8") as f:
            return f.read()
    r = client.get(URL, params={"target": f"{target}.M", "format": "text",
                              "starttime": f"{month_start}T00:00:00",
                              "endtime": f"{month_end}T00:00:00"})
    text = r.text if r.status_code == 200 else ""
    if (datetime.now(timezone.utc).date() - month_end).days > SAFE_AFTER_DAYS:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with gzip.open(path, "wt", encoding="utf-8") as f:
            f.write(text)
    return text


def compress_cache():
    """One-off: convert old uncompressed .txt cache files to .txt.gz (content unchanged)."""
    for root, _, files in os.walk(CACHE):
        for name in files:
            if name.endswith(".txt"):
                src = os.path.join(root, name)
                with open(src, encoding="utf-8") as f, \
                        gzip.open(src + ".gz", "wt", encoding="utf-8") as g:
                    g.write(f.read())
                os.remove(src)


_START = re.compile(r"^start: (\S+)$", re.M)


def parse(text):
    """MUSTANG text -> DataFrame(start [UTC], freq [Hz], db).

    One pass over the lines, remembering the current "start:" label, then ONE
    pd.read_csv over all the numbers (about 10x faster than one read_csv per spectrum).
    pandas' own number parser is kept on purpose, so the values are bit-identical to
    the earlier per-spectrum version (tests/test_mustang_parse.py checks this)."""
    lines, starts = [], []
    cur = None
    for ln in text.splitlines():
        m = _START.match(ln)
        if m:
            cur = m.group(1)
        elif cur is not None and ln and ln[0].isdigit():
            lines.append(ln)
            starts.append(cur)
    if not lines:
        return pd.DataFrame(columns=["start", "freq", "db"])
    out = pd.read_csv(io.StringIO("\n".join(lines)), header=None, names=["freq", "db"])
    out["start"] = pd.to_datetime(pd.Series(starts), utc=True)
    return out


def _parse_per_spectrum(text):
    """The original parser, kept only so the test can prove the fast one is identical."""
    rows = []
    blocks = _START.split(text)          # [preamble, start1, body1, start2, body2, ...]
    for start, body in zip(blocks[1::2], blocks[2::2]):
        lines = [ln for ln in body.splitlines() if ln and ln[0].isdigit()]
        if not lines:
            continue
        b = pd.read_csv(io.StringIO("\n".join(lines)), header=None, names=["freq", "db"])
        b["start"] = start
        rows.append(b)
    if not rows:
        return pd.DataFrame(columns=["start", "freq", "db"])
    out = pd.concat(rows, ignore_index=True)
    out["start"] = pd.to_datetime(out["start"], utc=True)
    return out


def band_rms(psd, band=BAND):
    """One 4-14 Hz displacement RMS (metres) per spectrum, indexed by the window's
    start time (UTC), as MUSTANG labels it. Bins are 1/8 octave wide, so each bin's width is
    f * (2**(1/16) - 2**(-1/16))."""
    p = psd[(psd["freq"] >= band[0]) & (psd["freq"] <= band[1])].copy()
    width = p["freq"] * (2 ** (1 / 16) - 2 ** (-1 / 16))
    p["var"] = 10 ** (p["db"] / 10) / (2 * np.pi * p["freq"]) ** 4 * width
    s = np.sqrt(p.groupby("start")["var"].sum())
    s.index.name = "time"                          # label = start of the 1-hour window
    return s.sort_index().rename("rms")


def rms_series(target, start, end):
    """4-14 Hz displacement RMS for [start, end) (dates, UTC), fetched month by month."""
    parts = [band_rms(parse(fetch_month(target, a, b))) for a, b in _month_starts(start, end)]
    parts = [p for p in parts if len(p)]
    if not parts:
        return pd.Series(dtype=float, name="rms")
    s = pd.concat(parts)
    s = s[~s.index.duplicated()]
    t0 = pd.Timestamp(start, tz="UTC")
    t1 = pd.Timestamp(end, tz="UTC")
    return s[(s.index >= t0) & (s.index < t1)].rename("rms")


def available(target, day):
    """True if MUSTANG has at least one spectrum for this target on this UTC day.
    One small request; not cached (used to survey coverage)."""
    r = client.get(URL, params={"target": f"{target}.M", "format": "text",
                              "starttime": f"{day}T00:00:00",
                              "endtime": f"{day}T01:00:00"})
    return r.status_code == 200 and "start:" in r.text
