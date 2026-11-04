"""history.py -- the "vs recent normal" number behind the globe page.

For each station-day:
    change = 10 ** (level_raw - median level_raw of the SAME WEEKDAY over the previous
                    WEEKS weeks) - 1                         (reported in %)
Only ordinary days (period "baseline": no public holiday, not 21 Dec - 6 Jan) can be
reference days, and at least MIN_REF of them must exist; otherwise the day has no value.

Same weekday   -> no weekend definition is needed, so one-day-weekend countries work.
Previous weeks -> slow changes at the site (new sensor, building work) don't show up as
                  city life. The cost: a long event fades after ~WEEKS weeks.
The day itself never enters its own reference, and neither does any holiday.
"""
import numpy as np
import pandas as pd

WEEKS = 8
MIN_REF = 3


def relative_change(d, weeks=WEEKS, min_ref=MIN_REF):
    """d: one station, indexed by local date, with columns level_raw and period.
    Returns a Series of % changes (NaN where there is not enough reference)."""
    lvl = d["level_raw"]
    ok = d["period"] == "baseline"
    out = pd.Series(np.nan, index=d.index)
    for t in d.index:
        ref = [lvl[r] for r in (t - pd.Timedelta(weeks=k) for k in range(1, weeks + 1))
               if r in lvl.index and ok[r]]
        if len(ref) >= min_ref:
            out[t] = 100 * (10 ** (lvl[t] - np.median(ref)) - 1)
    return out
