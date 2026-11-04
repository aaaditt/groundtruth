"""
confusion_detector.py -- Promise 3: is the model's CONFUSION a disruption detector?

confusion = 1 - P(true day of week). If the model is unsure that a Wednesday is a
Wednesday, something unusual probably happened. Compared with the existing anomaly
score (robust distance from normal days). Both are computed out-of-fold for normal days
(groundtruth/detect.py), and both flag a day above the 95th percentile of that station's
normal days.

Ground truth = official public holidays (period "holiday"). Evaluation days: before
lockdown, excluding the 21 Dec - 6 Jan "festive" days (neither normal nor official, so
counting them either way would be arbitrary). Lockdown is a multi-week disruption and is
reported SEPARATELY, never mixed into holiday precision/recall.

Metrics per station (stations with >= 1 holiday in the evaluation days):
  precision, recall at the 95% threshold; PR-AUC (average precision; chance = share of
  days that are holidays). Reported for all days and for working days only (a holiday
  on a Sunday changes nothing, so it can't be "detected").

Also: the top-20 most confusing days per showcase city, each checked against the
holiday calendar and against news (config/event_checks.csv, with sources).

Needs outputs/tables/day_scores.csv (run src/score_days.py first).
Outputs: outputs/tables/confusion_detector.csv, outputs/tables/top_confusion_days.csv,
         outputs/plots/confusion_vs_anomaly_pr.png

Run:  python src/confusion_detector.py
"""
import os, sys
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from scipy.stats import wilcoxon
from sklearn.metrics import average_precision_score, precision_recall_curve

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))  # repo root, for `import groundtruth`
from groundtruth.models import REPO, SHORT, load  # noqa: E402

SCORES = os.path.join("outputs", "tables", "day_scores.csv")
CHECKS = os.path.join(REPO, "config", "event_checks.csv")
SHOWCASE = ["AM.R7885", "HL.ATH", "BE.UCC"]
DETECTORS = ["confusion", "anomaly"]


def station_metrics(g):
    y = (g["period"] == "holiday").values
    row = {"n_days": len(g), "n_holidays": int(y.sum()), "prevalence": y.mean()}
    if y.sum() == 0:          # no holiday in this subset: precision/recall undefined
        row.update({f"{d}_{m}": np.nan for d in DETECTORS for m in ["precision", "recall", "pr_auc"]})
        return pd.Series(row)
    for d in DETECTORS:
        f = g[f"{d}_flag"].values
        row[f"{d}_precision"] = (y & f).sum() / f.sum() if f.sum() else np.nan
        row[f"{d}_recall"] = (y & f).sum() / y.sum()
        row[f"{d}_pr_auc"] = average_precision_score(y, g[d].values)
    return pd.Series(row)


def evaluate(ev, label):
    per = ev.groupby("station").apply(station_metrics, include_groups=False)
    per = per[per["n_holidays"] >= 1]
    print(f"\n=== {label}: {len(per)} stations with >= 1 holiday "
          f"({int(per.n_holidays.sum())} holiday days, {int(per.n_days.sum())} days) ===")
    print(f"{'':10s}{'precision':>12s}{'recall':>9s}{'PR-AUC':>9s}   (median per station; PR-AUC chance = {per.prevalence.median():.3f})")
    for d in DETECTORS:
        print(f"{d:10s}{per[f'{d}_precision'].median():12.2f}{per[f'{d}_recall'].median():9.2f}{per[f'{d}_pr_auc'].median():9.2f}")
    y = (ev["period"] == "holiday").values
    for d in DETECTORS:
        f = ev[f"{d}_flag"].values
        print(f"  pooled {d:10s} precision {(y & f).sum() / f.sum():.2f}  recall {(y & f).sum() / y.sum():.2f}  "
              f"(flags: {f.sum()}, holidays: {y.sum()})")
    _, p = wilcoxon(per["confusion_pr_auc"], per["anomaly_pr_auc"])
    print(f"  PR-AUC confusion vs anomaly, paired Wilcoxon p = {p:.2g}; "
          f"confusion higher at {(per.confusion_pr_auc > per.anomaly_pr_auc).sum()}/{len(per)} stations")
    return per.assign(subset=label)


def top_days(s, checks):
    pre = s[s["period"] != "lockdown"]
    rows = []
    for st in SHOWCASE:
        top = pre[pre["station"] == st].nlargest(20, "confusion")
        for rank, (_, r) in enumerate(top.iterrows(), 1):
            key = (st, r["date"].strftime("%Y-%m-%d"))
            if r["period"] == "holiday":
                status, note, src = "verified holiday", r["holiday_name"], "holidays 0.108 (official calendar)"
            elif key in checks.index:
                c = checks.loc[key]
                status, note, src = c["status"], c["finding"], c["source"]
            elif r["period"] == "festive":
                status, note, src = "festive season", "21 Dec - 6 Jan, not an official holiday", ""
            else:
                status, note, src = "unexplained", "", ""
            rows.append({"station": st, "city": r["city"], "rank": rank, "date": key[1], "day": SHORT[r["day_of_week"]],
                         "model_says": SHORT[int(r["pred_dow"])], "confusion": round(r["confusion"], 3),
                         "status": status, "note": note, "source": src})
    return pd.DataFrame(rows)


def main():
    s = load(SCORES)   # load(): keeps Namibia "NA"
    ev = s[s["period"].isin(["baseline", "holiday"])]          # before lockdown, no festive days
    per_all = evaluate(ev, "all days")
    per_wd = evaluate(ev[ev["is_weekend"] == 0], "working days only")
    pd.concat([per_all, per_wd]).to_csv("outputs/tables/confusion_detector.csv")

    print("\n=== Lockdown, reported separately (share of days flagged) ===")
    for p in ["baseline", "holiday", "festive", "lockdown"]:
        x = s[s["period"] == p]
        print(f"  {p:9s} n={len(x):6d}  confusion flags {x.confusion_flag.mean():5.1%}   anomaly flags {x.anomaly_flag.mean():5.1%}")

    checks = pd.read_csv(CHECKS, dtype=str).set_index(["station", "date"]) if os.path.exists(CHECKS) else \
        pd.DataFrame(columns=["status", "finding", "source"])
    top = top_days(s, checks)
    top.to_csv("outputs/tables/top_confusion_days.csv", index=False)
    print("\n=== Top-20 most confusing days outside lockdown, showcase cities ===")
    print(top.groupby(["station", "status"]).size().unstack(fill_value=0).to_string())
    pd.set_option("display.width", 220)
    print(top.drop(columns=["source"]).to_string(index=False))

    # pooled precision-recall curves, working days only
    wd = ev[ev["is_weekend"] == 0]
    y = (wd["period"] == "holiday").values
    fig, ax = plt.subplots(figsize=(7, 5.5))
    for d, c, name in [("confusion", "#3b6ea5", "confusion = 1 - P(true day)"), ("anomaly", "#c0703a", "anomaly score")]:
        p, r, _ = precision_recall_curve(y, wd[d].values)
        ax.plot(r, p, color=c, lw=2, label=f"{name} (PR-AUC {average_precision_score(y, wd[d].values):.2f})")
    ax.axhline(y.mean(), color="grey", ls="--", label=f"chance ({y.mean():.3f})")
    ax.set(xlabel="recall (share of holidays caught)", ylabel="precision (share of alarms that are holidays)",
           title=f"Finding public holidays on working days, {wd.station.nunique()} stations pooled\n"
                 "(no holiday was ever in training)", xlim=(0, 1), ylim=(0, 1.02))
    ax.legend(loc="upper right")
    ax.grid(alpha=.3)
    fig.tight_layout()
    fig.savefig("outputs/plots/confusion_vs_anomaly_pr.png", dpi=150)
    plt.close(fig)


if __name__ == "__main__":
    main()
