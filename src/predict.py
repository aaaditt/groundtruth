"""
predict.py -- live demo: "Here's one day of vibration from <city>. What day is it?"

The model is trained on that station's normal days, EXCLUDING the whole week
containing the date you ask about, so it's a genuine blind guess.

Examples:
  python src/predict.py --station AM.R7885 --date 2020-02-12   # normal Wednesday, New York
  python src/predict.py --station AM.R7885 --date 2019-11-28   # Thanksgiving (a Thursday)
  python src/predict.py --station AM.R7885 --date 2019-12-25   # Christmas Day (a Wednesday)
  python src/predict.py --station HL.ATH   --date 2020-04-01   # Athens, during lockdown
"""
import argparse, os, sys
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))  # repo root, for `import groundtruth`
from groundtruth.models import load, make_model, FEATURES, DAY_NAMES  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--station", required=True)
    ap.add_argument("--date", required=True, help="YYYY-MM-DD (local date at the station)")
    a = ap.parse_args()
    df = load()
    g = df[df["station"] == a.station]
    if g.empty:
        sys.exit(f"Unknown station {a.station}. See outputs/station_scores.csv for options.")
    day = g[g["date"] == pd.Timestamp(a.date)]
    if day.empty:
        sys.exit(f"No usable data for {a.station} on {a.date} (data covers ~Nov 2019 - May 2020).")
    day = day.iloc[0]
    train = g[(g["period"] == "baseline") & (g["week"] != day["week"])]
    model = make_model().fit(train[FEATURES].values, train["day_of_week"].values)
    proba = model.predict_proba(day[FEATURES].values.astype(float).reshape(1, -1))[0]
    order = np.argsort(proba)[::-1]

    print(f"\n{day['city']} ({a.station}), {a.date}   [period: {day['period']}]")
    print(f"Model's guess : {DAY_NAMES[model.classes_[order[0]]]}")
    print(f"Actual day    : {DAY_NAMES[int(day['day_of_week'])]}")
    print("Top guesses   : " + ", ".join(f"{DAY_NAMES[model.classes_[i]]} {proba[i]:.0%}" for i in order[:3]))
    p = os.path.join("outputs", "daily_anomaly_scores.csv")
    if os.path.exists(p):
        s = pd.read_csv(p, parse_dates=["date"])
        s = s[(s["station"] == a.station) & (s["date"] == pd.Timestamp(a.date))]
        if not s.empty:
            print(f"Anomaly score : {s['anomaly_score'].iloc[0]:.2f}  ({'FLAGGED as unusual' if s['flagged'].iloc[0] else 'looks normal'})")


if __name__ == "__main__":
    main()
