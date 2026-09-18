"""
detect_disruptions.py -- the "Anomaly-Based Disruption Detection" part.

Having learned each city's normal weekly rhythm, we ask: which days BREAK it?
We have two real, independently-documented disruptions to check against:
  * Christmas / New Year holidays (21 Dec - 6 Jan)
  * COVID-19 lockdowns (official start date per city, paper Table S1)
The model never saw any holiday or lockdown day during training.

Two detectors, per station:
  A. "Did the weekday look like a weekend?"  Weekday/weekend classifier trained
     on normal days, applied to real WEEKDAYS in each period. For normal days
     we use week-held-out CV predictions so the comparison is fair.
  B. Anomaly score: distance of a day's 25 features from the normal-life average
     for its day type (Mon-Fri / Sat / Sun), expressed relative to how far
     normal days usually stray. A day is FLAGGED if it's further out than 95%
     of normal days (so ~5% false-alarm rate on normal days by construction).

Outputs: outputs/disruption_summary.csv, outputs/daily_anomaly_scores.csv,
         outputs/plots/disruptions_global.png, outputs/plots/<station>_timeline.png

Run:  python src/detect_disruptions.py --station AM.R7885
"""
import argparse, os, sys
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.model_selection import GroupKFold, cross_val_predict

sys.path.insert(0, os.path.dirname(__file__))
from common import load, make_model, FEATURES  # noqa: E402

PERIODS = ["baseline", "holiday", "lockdown"]


def day_type(dow):
    return np.where(dow < 5, 0, np.where(dow == 5, 1, 2))


def score_station(g):
    g = g.sort_values("date").copy()
    base = g["period"] == "baseline"
    X = g[FEATURES].values
    # A. weekend-likeness
    pred = np.full(len(g), np.nan)
    pred[base.values] = cross_val_predict(make_model(), X[base.values], g.loc[base, "is_weekend"].values,
                                          groups=g.loc[base, "week"].values, cv=GroupKFold(5))
    clf = make_model().fit(X[base.values], g.loc[base, "is_weekend"].values)
    if (~base).any():
        pred[~base.values] = clf.predict(X[~base.values])
    g["pred_weekend"] = pred
    # B. anomaly score
    dt = day_type(g["day_of_week"].values)
    score = np.zeros(len(g))
    for t in range(3):
        ref = X[base.values & (dt == t)]
        # robust centre/spread (median, MAD) and clipped z-scores: one glitchy
        # hour can't make a whole day look like a catastrophe
        mu = np.median(ref, axis=0)
        sd = 1.4826 * np.median(np.abs(ref - mu), axis=0) + 1e-6
        m = dt == t
        z = np.clip((X[m] - mu) / sd, -10, 10)
        score[m] = np.sqrt((z ** 2).mean(axis=1))
    g["anomaly_score"] = score
    g["flagged"] = score > np.quantile(score[base.values], 0.95)
    return g


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--station", default="AM.R7885")
    a = ap.parse_args()
    df = load()
    good = df[df["period"] == "baseline"].groupby("station").size()
    scored = pd.concat([score_station(g) for s, g in df[df["station"].isin(good[good >= 70].index)].groupby("station")])
    os.makedirs("outputs/plots", exist_ok=True)
    scored[["station", "city", "date", "day_of_week", "period", "pred_weekend", "anomaly_score", "flagged"]] \
        .to_csv("outputs/daily_anomaly_scores.csv", index=False)

    wk = scored[scored["is_weekend"] == 0]
    per_station = pd.DataFrame({
        "weekday_looks_like_weekend": wk.groupby(["station", "period"])["pred_weekend"].mean(),
        "flag_rate": scored.groupby(["station", "period"])["flagged"].mean(),
    }).reset_index()
    per_station.to_csv("outputs/disruption_summary.csv", index=False)
    summary = per_station.groupby("period")[["weekday_looks_like_weekend", "flag_rate"]].median().reindex(PERIODS)
    print(f"Stations: {scored.station.nunique()}   (median across stations)")
    print(summary.map(lambda v: f"{v:.0%}").to_string())

    fig, axes = plt.subplots(1, 2, figsize=(11, 4))
    cols = ["#7f7f7f", "#2ca02c", "#d62728"]
    labels = ["Normal days", "Christmas/New Year", "COVID lockdown"]
    axes[0].bar(labels, summary["weekday_looks_like_weekend"] * 100, color=cols)
    axes[0].set(ylabel="% of weekdays", title="Weekdays the model thinks are weekends")
    axes[1].bar(labels, summary["flag_rate"] * 100, color=cols)
    axes[1].set(ylabel="% of days", title="Days flagged as anomalous")
    for ax in axes:
        for p in ax.patches:
            ax.annotate(f"{p.get_height():.0f}%", (p.get_x() + p.get_width() / 2, p.get_height()), ha="center", va="bottom")
    fig.suptitle(f"Disruption detection on {scored.station.nunique()} real seismometers (median per station)")
    fig.tight_layout(); fig.savefig("outputs/plots/disruptions_global.png", dpi=150); plt.close(fig)

    s = scored[scored["station"] == a.station]
    if not s.empty:
        city, tag = s["city"].iloc[0], a.station.replace(".", "_")
        fig, ax = plt.subplots(figsize=(12, 4.5))
        c = s["period"].map({"baseline": "#7f7f7f", "holiday": "#2ca02c", "lockdown": "#d62728"})
        ax.scatter(s["date"], s["anomaly_score"], c=c, s=18)
        ax.plot(s["date"], s["anomaly_score"].rolling(7, center=True).median(), color="k", lw=1)
        ax.axvline(pd.Timestamp(df.loc[df.station == a.station, "lockdown_date"].iloc[0]), color="#d62728", ls="--")
        ax.axhline(np.quantile(s.loc[s.period == "baseline", "anomaly_score"], 0.95), color="k", ls=":", lw=1)
        ax.set(title=f"{city} ({a.station}): how unusual was each day's vibration rhythm?  "
                     f"grey = normal, green = holidays, red = after lockdown (dashed)",
               ylabel="anomaly score", xlabel="date")
        fig.tight_layout(); fig.savefig(f"outputs/plots/{tag}_timeline.png", dpi=150); plt.close(fig)
        print(f"\n{a.station} {city}:")
        print(per_station[per_station.station == a.station].to_string(index=False))


if __name__ == "__main__":
    main()
