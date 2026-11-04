"""
class_weight_check.py -- before/after for the class-weighting change (Stage 4, promise 1).

Trains the per-station forest twice per station, identical week-held-out folds:
  class_weight=None        (the model used up to 2026-11-03)
  class_weight="balanced"  (the model from 2026-11-04: each class counts equally in
                            training, matching the balanced-accuracy metric)
Hard-codes both settings, so it still shows the comparison after make_model() changed.

Output: outputs/tables/class_weight_comparison.csv
Run:  python src/class_weight_check.py outputs/tables/class_weight_comparison.csv   (~2 min)
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))  # repo root
import pandas as pd
from joblib import Parallel, delayed
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_predict
from sklearn.metrics import balanced_accuracy_score, accuracy_score
from groundtruth.models import load, FEATURES, make_cv


def one(st, g):
    X, y, w = g[FEATURES].values, g.is_weekend.values, g.week.values
    r = {"station": st, "city": g.city.iloc[0], "wk_frac": y.mean()}
    for cw in [None, "balanced"]:
        mk = lambda: RandomForestClassifier(n_estimators=100, min_samples_leaf=2, random_state=0, n_jobs=1, class_weight=cw)
        r[f"bal_{cw}"] = balanced_accuracy_score(y, cross_val_predict(mk(), X, y, groups=w, cv=make_cv()))
        r[f"dow_{cw}"] = accuracy_score(g.day_of_week, cross_val_predict(mk(), X, g.day_of_week.values, groups=w, cv=make_cv()))
    return r


if __name__ == "__main__":
    df = load(); base = df[df.period == "baseline"]
    rows = Parallel(n_jobs=-1)(delayed(one)(st, g) for st, g in base.groupby("station") if len(g) >= 70)
    r = pd.DataFrame(rows)
    r.to_csv(sys.argv[1], index=False)
    print(r[["bal_None", "bal_balanced", "dow_None", "dow_balanced"]].median())
    print("one-day weekends:"); print(r[r.wk_frac < 0.2].to_string())
    d = r.bal_balanced - r.bal_None
    print("changed >1pp up:", (d > .01).sum(), "down:", (d < -.01).sum())
    print(r.loc[d.abs() > .01].sort_values("bal_None").to_string())
