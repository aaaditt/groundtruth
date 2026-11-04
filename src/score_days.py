"""
score_days.py -- score every station-day once, for promises 3 and 4.

Uses groundtruth/detect.py: week-held-out scores for normal days, a model fitted on all
normal days for holiday / festive / lockdown days. Stations need >= 70 normal days.

Output: outputs/tables/day_scores.csv  (read by confusion_detector.py, holiday_holdout.py)

Run:  python src/score_days.py      (~5 min; uses all CPU cores)
"""
import os, sys
import pandas as pd
from joblib import Parallel, delayed

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))  # repo root, for `import groundtruth`
from groundtruth.models import load  # noqa: E402
from groundtruth.detect import score_station  # noqa: E402

OUT = os.path.join("outputs", "tables", "day_scores.csv")
KEEP = ["station", "city", "country_code", "date", "day_of_week", "is_weekend", "period", "holiday_name",
        "lockdown_date", "p_true_dow", "confusion", "p_sunday", "pred_dow", "p_weekend", "pred_weekend",
        "anomaly", "confusion_flag", "anomaly_flag"]


def main():
    df = load()
    n_base = df[df["period"] == "baseline"].groupby("station").size()
    keep = n_base[n_base >= 70].index
    parts = Parallel(n_jobs=-1)(delayed(score_station)(g) for _, g in df[df["station"].isin(keep)].groupby("station"))
    out = pd.concat(parts, ignore_index=True)[KEEP]
    out["holiday_name"] = out["holiday_name"].fillna("")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    out.to_csv(OUT, index=False)
    print(f"{out['station'].nunique()} stations, {len(out)} station-days -> {OUT}")
    print(out.groupby("period")[["confusion", "anomaly", "confusion_flag", "anomaly_flag"]].mean().round(3).to_string())


if __name__ == "__main__":
    main()
