"""Shared helpers: loading the processed dataset and building models."""
import os
import pandas as pd
from sklearn.ensemble import RandomForestClassifier

DATA = os.path.join("data", "processed", "daily_features.csv")
SHAPE_COLS = [f"shape_{h:02d}" for h in range(24)]
FEATURES = SHAPE_COLS + ["level"]
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def load(path=DATA):
    df = pd.read_csv(path, parse_dates=["date"])
    df["week"] = df["date"].dt.isocalendar().week.astype(int)
    return df


def make_model(seed=0):
    # 100 trees, small leaves: a sturdy default that needs no feature scaling
    return RandomForestClassifier(n_estimators=100, min_samples_leaf=2, random_state=seed, n_jobs=1)
