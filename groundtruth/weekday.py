"""weekday.py -- the exact-weekday experiment (pre-registered in docs/15-weekday-preregistration.md).

Result 16 reads weekday vs weekend well (93%) but the exact weekday at only 47%. This module
tests two levers, both fixed in advance:

  Part A  richer features from ONE day: half-hour detail and three frequency bands.
  Part B  a week of context: the same per-day features for the 3 days before and after.

Everything else is Result 16's method: one model per station, trained only on ordinary
("baseline") days, every day guessed by a model that never saw its week (Part A) or its
28-day block (Part B).
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.model_selection import GroupKFold

from groundtruth import ask
from groundtruth.features import clean_rms
from groundtruth.models import make_cv, make_model, week_id
from groundtruth.mustang import _month_starts, band_rms, fetch_month, parse

# Three displacement-RMS bands. 4-14 Hz is the project's usual band (Lecocq et al. 2020);
# every station's MUSTANG spectra reach at least 19.7 Hz, so 14-20 Hz exists everywhere.
BANDS = {"b1": (1.0, 4.0), "b2": (4.0, 14.0), "b3": (14.0, 20.0)}
BLOCK_DAYS = 28      # Part B folds: 28-day blocks counted from the start of the record
HALF = 3             # Part B window: 3 days either side


def band_frame(target, start, end):
    """One row per MUSTANG spectrum (UTC start time), one column per band in BANDS.
    Each month is parsed once and all three bands are computed from that parse."""
    parts = []
    for a, b in _month_starts(start, end):
        psd = parse(fetch_month(target, a, b))
        if len(psd):
            parts.append(pd.DataFrame({k: band_rms(psd, band) for k, band in BANDS.items()}))
    if not parts:
        return pd.DataFrame(columns=list(BANDS))
    f = pd.concat(parts)
    f = f[~f.index.duplicated()].sort_index()
    t0, t1 = pd.Timestamp(start, tz="UTC"), pd.Timestamp(end, tz="UTC")
    return f[(f.index >= t0) & (f.index < t1)]


def day_table(s, step, prefix):
    """Per-day shape and raw level from one cleaned series (local time).

    step "1h": 24 values per day (the median of the two spectra starting in each hour,
    exactly as features.daily_features); needs 20 of 24. step "30min": 48 values, one per
    spectrum; needs 40 of 48 (the same 5/6 share). Missing slots are interpolated along the
    day. shape = log10 values minus the day's mean; the mean is the raw level."""
    n, need = (24, 20) if step == "1h" else (48, 40)
    v = np.log10(s).resample(step).median()
    frame = pd.DataFrame({"v": v})
    frame["date"] = frame.index.date
    frame["slot"] = (frame.index.hour * 60 + frame.index.minute) // (60 if step == "1h" else 30)
    table = frame.pivot_table(index="date", columns="slot", values="v", aggfunc="median")
    table = table.reindex(columns=range(n))
    table = table[table.notna().sum(axis=1) >= need]
    table = table.interpolate(axis=1, limit_direction="both")
    level = table.mean(axis=1)
    tag = "h" if step == "1h" else "m"
    shape = table.sub(level, axis=0)
    shape.columns = [f"{prefix}_{tag}{k:02d}" for k in range(n)]
    shape[f"{prefix}_{tag}level_raw"] = level
    shape.index = pd.to_datetime(shape.index)
    return shape


def feature_sets():
    """The four pre-registered feature sets, as column lists (A0 is Result 16 exactly)."""
    def cols(bands, tag, n):
        out = []
        for b in bands:
            out += [f"{b}_{tag}{k:02d}" for k in range(n)] + [f"{b}_{tag}level"]
        return out
    return {"A0": cols(["b2"], "h", 24), "A1": cols(["b2"], "m", 48),
            "A2": cols(list(BANDS), "h", 24), "A3": cols(list(BANDS), "m", 48)}


def add_levels(d):
    """Result 16's rolling_level for every band and step: each day's raw level as a robust
    z-score against the ordinary days of the previous 8 weeks."""
    for c in [c for c in d.columns if c.endswith("level_raw")]:
        d[c.replace("level_raw", "level")] = ask.rolling_level(d.assign(level_raw=d[c]))
    return d


def make_gb():
    return HistGradientBoostingClassifier(class_weight="balanced", random_state=0)


MODELS = {"RF": make_model, "GB": make_gb}


def oof_probs(X, y, groups, train_mask, fold_of_group, model_factory, drop_from_train=None):
    """Out-of-fold class probabilities (n x 7) for every row.

    Each row is predicted by the model of its own fold, trained on rows that are in other
    folds, in train_mask (baseline days), and not flagged in drop_from_train[fold]."""
    folds = np.array([fold_of_group[g] for g in groups])
    probs = np.full((len(y), 7), np.nan)
    for f in sorted(set(folds)):
        tr = train_mask & (folds != f)
        if drop_from_train is not None:
            tr &= ~drop_from_train[f]
        model = model_factory().fit(X[tr], y[tr])
        te = folds == f
        p = np.zeros((te.sum(), 7))
        p[:, model.classes_] = model.predict_proba(X[te])
        probs[te] = p
    return probs, folds


def week_folds(d):
    """Result 16's folds: GroupKFold(5) over the baseline days' week_id; any week with no
    baseline day is given a fold by its position (it is never trained on anyway)."""
    base = d[d["period"] == "baseline"]
    fold_of = {}
    for f, (_, te) in enumerate(make_cv().split(base, groups=base["week_id"])):
        for w in set(base["week_id"].values[te]):
            fold_of[w] = f
    for k, w in enumerate(sorted(set(d["week_id"]) - set(fold_of))):
        fold_of[w] = k % 5
    return fold_of


def block_of(dates, start):
    """28-day block number of each date, counted from `start`."""
    return ((pd.DatetimeIndex(dates) - pd.Timestamp(start)).days // BLOCK_DAYS).astype(int)


def block_folds(blocks):
    """GroupKFold(5) over the distinct blocks."""
    u = np.array(sorted(set(blocks)))
    fold_of = {}
    for f, (_, te) in enumerate(GroupKFold(5).split(u, groups=u)):
        for b in u[te]:
            fold_of[b] = f
    return fold_of


def window_touches_fold(dates, start, fold_of_block):
    """For each fold f, a boolean per date: does the window [t-HALF, t+HALF] contain a day of
    a block in fold f? Such days are dropped from fold f's training set in Part B, so no test
    day's features are ever seen in training."""
    dates = pd.DatetimeIndex(dates)
    out = {f: np.zeros(len(dates), bool) for f in set(fold_of_block.values())}
    for off in range(-HALF, HALF + 1):
        b = block_of(dates + pd.Timedelta(days=off), start)
        for f in out:
            out[f] |= np.array([fold_of_block.get(x, -1) == f for x in b])
    return out


def week_matrix(d, cols):
    """Per-day features of days t-3 .. t+3 side by side (7 blocks), NaN where a neighbour
    has no data. Indexed like d."""
    full = d[cols].reindex(pd.date_range(d.index.min(), d.index.max(), freq="D"))
    blocks = [full.shift(-off).reindex(d.index).values for off in range(-HALF, HALF + 1)]
    return np.hstack(blocks)


def accuracy_table(y, pred, weekend_days):
    """Exact accuracy, accuracy on true Tue/Wed/Thu, weekday-vs-weekend balanced accuracy and
    the 7x7 confusion counts. weekend_days[i] is the set of weekday numbers that were the
    weekend on row i's date (the rule in force then, so Sharjah's 2022 change is respected)."""
    from sklearn.metrics import balanced_accuracy_score
    y, pred = np.asarray(y), np.asarray(pred)
    cm = np.zeros((7, 7), int)
    for t, p in zip(y, pred):
        cm[t, p] += 1
    mid = np.isin(y, [1, 2, 3])
    true_we = np.array([t in w for t, w in zip(y, weekend_days)])
    pred_we = np.array([p in w for p, w in zip(pred, weekend_days)])
    return {"n": int(len(y)), "exact": float((pred == y).mean()),
            "tue_thu": float((pred[mid] == y[mid]).mean()) if mid.any() else np.nan,
            "weekend_bal": float(balanced_accuracy_score(true_we, pred_we)) if len(set(true_we)) == 2 else np.nan,
            "cm": cm}


__all__ = ["BANDS", "BLOCK_DAYS", "HALF", "band_frame", "day_table", "feature_sets", "add_levels",
           "MODELS", "oof_probs", "week_folds", "block_of", "block_folds", "window_touches_fold",
           "week_matrix", "accuracy_table"]
