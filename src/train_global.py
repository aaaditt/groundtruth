"""
train_global.py -- ONE model for every city. Can it work on a city it has never seen?

We pool normal-life days from all stations and use leave-cities-out
cross-validation (GroupKFold by station): the model is always tested on
seismometers that contributed zero training days. Uses the day's SHAPE plus
its within-station loudness z-score, both comparable across stations.

Run:  python src/train_global.py
"""
import os, sys
import pandas as pd
from sklearn.model_selection import cross_val_predict
from sklearn.metrics import balanced_accuracy_score, accuracy_score
from sklearn.ensemble import RandomForestClassifier

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))  # repo root, for `import groundtruth`
from groundtruth.models import load, FEATURES, make_cv  # noqa: E402


def main():
    df = load()
    b = df[df["period"] == "baseline"]
    X, st = b[FEATURES].values, b["station"].values
    m = lambda: RandomForestClassifier(n_estimators=150, min_samples_leaf=5, random_state=0, n_jobs=-1)
    p2 = cross_val_predict(m(), X, b["is_weekend"].values, groups=st, cv=make_cv())
    p7 = cross_val_predict(m(), X, b["day_of_week"].values, groups=st, cv=make_cv())
    out = b[["station", "city", "day_of_week", "is_weekend"]].copy()
    out["pred_weekend"], out["pred_dow"] = p2, p7
    per = out.groupby(["station", "city"]).apply(
        lambda g: pd.Series({"weekend_bal_acc": balanced_accuracy_score(g.is_weekend, g.pred_weekend),
                             "dow_acc": accuracy_score(g.day_of_week, g.pred_dow)}), include_groups=False)
    os.makedirs("outputs", exist_ok=True)
    per.sort_values("weekend_bal_acc", ascending=False).to_csv("outputs/global_model_unseen_city_scores.csv")
    print(f"Pooled {len(b)} days from {b.station.nunique()} stations; tested only on UNSEEN stations")
    print(f"Weekday/weekend balanced accuracy: {balanced_accuracy_score(b.is_weekend, p2):.1%} (chance 50%)")
    print(f"Day-of-week accuracy:              {accuracy_score(b.day_of_week, p7):.1%} (chance 14.3%)")
    print(f"Per unseen station, median weekday/weekend balanced accuracy: {per.weekend_bal_acc.median():.1%}")


if __name__ == "__main__":
    main()
