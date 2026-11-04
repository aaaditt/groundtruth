"""
transfer.py -- Promise 5: does one city's rhythm transfer to another, and how does it fail?

1. Region transfer matrix. Train the pooled model on all normal days of one region, test
   on every station of another region. Diagonal cells (same region) use GroupKFold by
   station, so even there the test stations are unseen. Weekday-vs-weekend balanced
   accuracy, pooled over test days. Small regions are shown with their station count.

2. Weekend-shift test. Train on Saturday-Sunday countries only, then ask the model about
   the three stations whose weekend is Friday(-Saturday): Salfit, Amatzia, Jeddah.
   Hypothesis: their Fridays get called Saturday/Sunday, their Sundays a working day.
   n = 3 stations. That is a case study, not a statistic.

3. Failure analysis. Per station: accuracy of the all-region pooled model on that
   UNSEEN station (GroupKFold by station). Which station properties go with poor
   transfer? Simple Spearman correlations / Mann-Whitney tests, no extra model:
   population density, |latitude|, sensor type (Raspberry Shake `AM` vs professional),
   data gaps (share of days missing in the station's record), own-model accuracy.

Outputs: outputs/tables/transfer_matrix.csv, outputs/tables/transfer_weekend_shift.csv,
         outputs/tables/transfer_failure.csv, outputs/plots/transfer_matrix.png,
         outputs/plots/transfer_weekend_shift.png

Run:  python src/transfer.py      (~3 min)
"""
import os, sys
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from scipy.stats import spearmanr, mannwhitneyu
from sklearn.model_selection import cross_val_predict
from sklearn.metrics import balanced_accuracy_score

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))  # repo root, for `import groundtruth`
from groundtruth.models import load, FEATURES, SHORT, make_cv, make_global_model  # noqa: E402
from groundtruth.calendars import load_weekend_rules, is_weekend  # noqa: E402

TABLE_S1 = os.path.join("data", "external", "2020_Science_GlobalQuieting", "Supplementary Files",
                        "Table S1 - Lockdown stations.csv")
REGIONS = {
    "Europe": "NO CH FR GB DE IT ES CY GR AT AD BE AL FO LU IS NL MD PL PT RO SE IE TR GE",
    "North America": "US CA BM",
    "Latin America & Caribbean": "CR HN CO MX BR CL PA BO HT AW BB DM EC FK PE PR SV",
    "Asia-Pacific": "AU NP IN JP NZ MY LK PG PH GU PK",
    "Middle East & Africa": "CD BW GH CV IL MA PS SC SA NA",
}
REGION_OF = {cc: r for r, ccs in REGIONS.items() for cc in ccs.split()}
SHIFT_STATIONS = ["GE.SALP", "IS.AMAZ", "AM.RFBE4"]   # Salfit, Amatzia, Jeddah


def region_matrix(b):
    regions = list(REGIONS)
    acc = pd.DataFrame(index=regions, columns=regions, dtype=float)
    for tr in regions:
        for te in regions:
            test = b[b["region"] == te]
            if tr == te:
                n_st = test["station"].nunique()
                if n_st < 5:
                    continue
                p = cross_val_predict(make_global_model(), test[FEATURES].values, test["is_weekend"].values,
                                      groups=test["station"].values, cv=make_cv())
            else:
                train = b[b["region"] == tr]
                p = make_global_model().fit(train[FEATURES].values, train["is_weekend"].values) \
                    .predict(test[FEATURES].values)
            acc.loc[tr, te] = balanced_accuracy_score(test["is_weekend"], p)
    return acc


def weekend_shift(b, satsun_codes):
    train = b[b["country_code"].isin(satsun_codes) & ~b["station"].isin(SHIFT_STATIONS)]
    m7 = make_global_model().fit(train[FEATURES].values, train["day_of_week"].values)
    m2 = make_global_model().fit(train[FEATURES].values, train["is_weekend"].values)
    rows = []
    for st in SHIFT_STATIONS:
        g = b[b["station"] == st]
        if g.empty:
            print(f"  {st}: no data")
            continue
        pred = m7.predict(g[FEATURES].values)
        pw = m2.predict_proba(g[FEATURES].values)[:, 1]
        for d in [3, 4, 5, 6]:   # Thu, Fri, Sat, Sun
            m = g["day_of_week"].values == d
            share = pd.Series(pred[m]).value_counts(normalize=True).reindex(range(7), fill_value=0)
            rows.append({"station": st, "city": g["city"].iloc[0], "true_day": SHORT[d], "n": int(m.sum()),
                         "called_Sat_or_Sun": share[[5, 6]].sum(), "called_Mon_to_Fri": share[:5].sum(),
                         "mean_p_weekend_SatSun_model": pw[m].mean(),
                         "most_common_guess": SHORT[int(share.idxmax())]})
    return pd.DataFrame(rows)


def failure_analysis(b, meta):
    p = cross_val_predict(make_global_model(), b[FEATURES].values, b["is_weekend"].values,
                          groups=b["station"].values, cv=make_cv())
    b = b.assign(pred=p)
    per = b.groupby("station").apply(lambda g: balanced_accuracy_score(g["is_weekend"], g["pred"]),
                                     include_groups=False).rename("unseen_acc").to_frame()
    allrows = load()
    span = allrows.groupby("station")["date"].agg(lambda d: (d.max() - d.min()).days + 1)
    per["gap_share"] = 1 - allrows.groupby("station").size() / span
    per = per.join(meta[["Station_Code", "latitude"]].drop_duplicates("Station_Code").set_index("Station_Code"))
    per["abs_latitude"] = per["latitude"].abs()
    per["raspberry_shake"] = per.index.str.startswith("AM.")
    per = per.join(b.groupby("station")[["pop_density", "city", "country_code"]].first())
    own = pd.read_csv("outputs/station_scores.csv").set_index("station")["weekend_bal_acc"] \
        if os.path.exists("outputs/station_scores.csv") else None
    if own is not None:
        per["own_model_acc"] = own
        per["transfer_gap"] = per["own_model_acc"] - per["unseen_acc"]
    rows = []
    for col in ["pop_density", "abs_latitude", "gap_share"] + (["own_model_acc"] if own is not None else []):
        d = per.dropna(subset=[col])
        rho, pv = spearmanr(d[col], d["unseen_acc"])
        rows.append({"property": col, "test": "Spearman rho vs unseen-station accuracy", "value": rho, "p": pv, "n": len(d)})
    rs, pro = per.loc[per["raspberry_shake"], "unseen_acc"], per.loc[~per["raspberry_shake"], "unseen_acc"]
    _, pv = mannwhitneyu(rs, pro)
    rows.append({"property": "raspberry_shake", "test": f"median unseen acc: RS {rs.median():.3f} vs pro {pro.median():.3f}",
                 "value": rs.median() - pro.median(), "p": pv, "n": f"{len(rs)} vs {len(pro)}"})
    return per, pd.DataFrame(rows)


def main():
    df = load()
    base = df[df["period"] == "baseline"]
    n = base.groupby("station").size()
    b = base[base["station"].isin(n[n >= 70].index)].copy()
    b["region"] = b["country_code"].map(REGION_OF)
    missing = sorted(b.loc[b["region"].isna(), "country_code"].unique())
    if missing:
        sys.exit(f"Add these country codes to REGIONS: {missing}")
    meta = pd.read_csv(TABLE_S1, encoding="latin-1")
    os.makedirs("outputs/tables", exist_ok=True)
    os.makedirs("outputs/plots", exist_ok=True)

    print("=== 1. Region transfer (rows: trained on, columns: tested on; weekday-vs-weekend balanced acc) ===")
    counts = b.groupby("region")["station"].nunique()
    print(counts.to_string())
    acc = region_matrix(b)
    acc.to_csv("outputs/tables/transfer_matrix.csv")
    print(acc.map(lambda v: f"{v:.1%}" if pd.notna(v) else "  -").to_string())
    fig, ax = plt.subplots(figsize=(9, 7))
    im = ax.imshow(acc.values.astype(float) * 100, cmap="viridis", vmin=50, vmax=100)
    for i in range(len(acc)):
        for j in range(len(acc)):
            v = acc.iat[i, j]
            ax.text(j, i, "n/a" if pd.isna(v) else f"{v:.0%}", ha="center", va="center",
                    color="w" if pd.notna(v) and v < .8 else "k", fontsize=12)
    lab = [f"{r}\n({counts[r]} stations)" for r in acc.index]
    ax.set_xticks(range(len(acc)), lab, rotation=30, ha="right")
    ax.set_yticks(range(len(acc)), lab)
    ax.set(xlabel="tested on (unseen stations)", ylabel="trained on")
    fig.colorbar(im, label="weekday vs weekend, balanced accuracy (%)")
    ax.set_title("Does a city's weekly rhythm transfer across regions?\n(diagonal: other stations of the same region)")
    fig.tight_layout()
    fig.savefig("outputs/plots/transfer_matrix.png", dpi=150)
    plt.close(fig)

    print("\n=== 2. Weekend-shift test: model trained on Sat-Sun countries only (n = 3 stations) ===")
    rules = load_weekend_rules()
    sat_sun = [cc for cc in b["country_code"].unique()
               if is_weekend(pd.DatetimeIndex(["2020-01-04", "2020-01-05"]), cc, rules).all()
               and not is_weekend(pd.DatetimeIndex(["2020-01-03"]), cc, rules).any()]
    ws = weekend_shift(b, sat_sun)
    ws.to_csv("outputs/tables/transfer_weekend_shift.csv", index=False)
    print(ws.to_string(index=False, formatters={"called_Sat_or_Sun": "{:.0%}".format, "called_Mon_to_Fri": "{:.0%}".format,
                                                "mean_p_weekend_SatSun_model": "{:.2f}".format}))
    fig, axes = plt.subplots(1, len(ws["station"].unique()), figsize=(13, 4.2), sharey=True)
    for ax, (st, g) in zip(np.atleast_1d(axes), ws.groupby("station", sort=False)):
        ax.bar(g["true_day"], g["called_Sat_or_Sun"] * 100, color=["#7f7f7f", "#d62728", "#d62728", "#1f77b4"])
        ax.set(title=f"{g['city'].iloc[0]} ({st})", xlabel="actual day")
        for i, v in enumerate(g["called_Sat_or_Sun"] * 100):
            ax.text(i, v + 1, f"{v:.0f}%", ha="center")
    np.atleast_1d(axes)[0].set_ylabel("% called Saturday or Sunday")
    fig.suptitle("A model that only knows Saturday-Sunday weekends, shown Friday-weekend cities\n"
                 "(red = their weekend days, blue = Sunday, a working day there)")
    fig.tight_layout()
    fig.savefig("outputs/plots/transfer_weekend_shift.png", dpi=150)
    plt.close(fig)

    print("\n=== 3. What goes with poor transfer? (unseen-station accuracy, all regions pooled) ===")
    per, corr = failure_analysis(b, meta)
    per.to_csv("outputs/tables/transfer_failure.csv")
    corr.to_csv("outputs/tables/transfer_failure_correlations.csv", index=False)
    print(corr.to_string(index=False, formatters={"value": "{:+.3f}".format, "p": "{:.2g}".format}))
    print("\nWorst 8 unseen stations:")
    print(per.nsmallest(8, "unseen_acc")[["city", "country_code", "unseen_acc"] +
                                         (["own_model_acc"] if "own_model_acc" in per else [])].to_string())


if __name__ == "__main__":
    main()
