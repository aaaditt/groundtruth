"""
uae_experiment.py -- the PRE-REGISTERED UAE weekend experiment (docs/14-uae-preregistration.md).

On 1 Jan 2022 the UAE moved its weekend; Sunday went from working day to rest day
(federal Sat-Sun weekend, Sharjah Fri-Sat-Sun). If the seismometer in Sharjah
(II.UOSS.10.BHZ) measures people, Sunday should get quieter relative to Mon-Thu.

Everything here follows the pre-registration exactly: same window, same exclusions, same
statistic, same test. Do NOT change these constants to "get a better result" -- that
would make the test meaningless. Extra analyses go under EXPLORATORY and are labelled so.

Outputs: outputs/tables/uae_experiment.csv, outputs/tables/uae_daily_activity.csv,
         outputs/plots/uae_weekend_switch.png

Run:  python src/uae_experiment.py
"""
import itertools, os, sys
from datetime import date, timedelta

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import holidays

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))  # repo root, for `import groundtruth`
from groundtruth.features import clean_rms, daily_features  # noqa: E402
from groundtruth.mustang import rms_series  # noqa: E402

TARGET, TZ = "II.UOSS.10.BHZ", "Asia/Dubai"
SHIFT = timedelta(weeks=52)   # placebo year: everything moved exactly 52 weeks earlier
MAIN = dict(name="main (real change)", start=date(2021, 10, 4), end=date(2022, 3, 27),
            change=date(2022, 1, 1), block=(date(2021, 12, 12), date(2022, 1, 2)))
PLACEBO = dict(name="placebo year", start=MAIN["start"] - SHIFT, end=MAIN["end"] - SHIFT,
               change=MAIN["change"] - SHIFT, block=(MAIN["block"][0] - SHIFT, MAIN["block"][1] - SHIFT))
MON_THU = [0, 1, 2, 3]
FRI, SAT, SUN = 4, 5, 6


def daily_activity(spec, exclude_block=True):
    """A(d) = level_raw (mean of 24 hourly log10 medians, local time), minus exclusions."""
    # fetch a day either side in UTC, so every LOCAL day in the window is complete
    s = rms_series(TARGET, spec["start"] - timedelta(days=1), spec["end"] + timedelta(days=2))
    s.index = s.index.tz_convert(TZ)
    d = daily_features(clean_rms(s))
    d = d[(d.index.date >= spec["start"]) & (d.index.date <= spec["end"])]
    years = sorted({spec["start"].year, spec["end"].year})
    uae = holidays.country_holidays("AE", years=years)
    keep = np.array([t.date() not in uae for t in d.index])
    if exclude_block:
        a, b = spec["block"]
        keep &= ~np.array([a <= t.date() <= b for t in d.index])
    out = pd.DataFrame({"A": d["level_raw"][keep], "dow": d["day_of_week"][keep]})
    out["monday"] = out.index - pd.to_timedelta(out["dow"], unit="D")   # week label
    out["after"] = out.index.date >= spec["change"]
    return out


def weekly(act, day):
    """Per week: A(day) - mean A(Mon-Thu). Needs that day and >= 2 Mon-Thu days."""
    rows = []
    for monday, w in act.groupby("monday"):
        if w["after"].nunique() > 1:      # can't happen with the block excluded; guard anyway
            continue
        mt = w.loc[w["dow"].isin(MON_THU), "A"]
        x = w.loc[w["dow"] == day, "A"]
        if len(x) == 1 and len(mt) >= 2:
            rows.append({"monday": monday.date(), "after": bool(w["after"].iloc[0]),
                         "S": float(x.iloc[0] - mt.mean())})
    return pd.DataFrame(rows)


def exact_perm(S, after):
    """Exact permutation test of mean(after) - mean(before). Returns observed delta,
    one-sided p (delta as low or lower), two-sided p (|delta| as large or larger)."""
    S, after = np.asarray(S), np.asarray(after, bool)
    n, k = len(S), after.sum()
    obs = S[after].mean() - S[~after].mean()
    total = S.sum()
    deltas = []
    for idx in itertools.combinations(range(n), k):
        sa = S[list(idx)].sum()
        deltas.append(sa / k - (total - sa) / (n - k))
    deltas = np.array(deltas)
    eps = 1e-12
    return obs, (deltas <= obs + eps).mean(), (np.abs(deltas) >= abs(obs) - eps).mean(), len(deltas)


def analyse(spec, exclude_block=True):
    act = daily_activity(spec, exclude_block)
    res = {"analysis": spec["name"], "days": len(act)}
    # gatekeeper: is there a weekly rhythm before the change? mean over before-weeks of
    # [mean A(Fri,Sat) - mean A(Mon-Thu)]
    gk = []
    for _, w in act[~act["after"]].groupby("monday"):
        we, mt = w.loc[w["dow"].isin([FRI, SAT]), "A"], w.loc[w["dow"].isin(MON_THU), "A"]
        if len(we) and len(mt) >= 2:
            gk.append(we.mean() - mt.mean())
    res["gatekeeper_FriSat_minus_MonThu"] = float(np.mean(gk))
    for name, day in [("Sun", SUN), ("Sat", SAT), ("Fri", FRI)]:
        w = weekly(act, day)
        obs, p1, p2, nperm = exact_perm(w["S"], w["after"])
        res.update({f"{name}_weeks_before": int((~w["after"]).sum()), f"{name}_weeks_after": int(w["after"].sum()),
                    f"{name}_delta_log10": obs, f"{name}_pct_change": 10 ** obs - 1,
                    f"{name}_p_one_sided": p1, f"{name}_p_two_sided": p2, f"{name}_n_perm": nperm})
    return res, act


def verdict(main, plac):
    if not main["gatekeeper_FriSat_minus_MonThu"] < 0:
        return "UNINFORMATIVE: the sensor shows no weekly rhythm before the change"
    if main["Sun_p_one_sided"] >= 0.05:
        return "NOT SUPPORTED (null result)"
    if plac["Sun_p_one_sided"] < 0.05:
        return "INCONCLUSIVE: the placebo year shows the same drop (seasonal pattern can't be ruled out)"
    return "SUPPORTED: Sunday got quieter after the weekend change, and not in the placebo year"


def plot(acts, path):
    fig, axes = plt.subplots(1, 2, figsize=(13, 5), sharey=True)
    names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    for ax, (title, act) in zip(axes, acts):
        for after, colour, label in [(False, "#7f7f7f", "before 1 Jan"), (True, "#d62728", "after 1 Jan")]:
            a = act[act["after"] == after]
            ref = a.loc[a["dow"].isin(MON_THU), "A"].mean()
            m = a.groupby("dow")["A"].mean() - ref
            ax.plot(names, (10 ** m.reindex(range(7)) - 1) * 100, "o-", color=colour, lw=2, label=label)
        ax.axhline(0, color="k", lw=.8)
        ax.set(title=title, xlabel="day of week")
        ax.grid(alpha=.3)
        ax.legend()
    axes[0].set_ylabel("ground vibration vs Mon-Thu average (%)")
    fig.suptitle(f"Sharjah ({TARGET}): did Sunday get quieter when it became a weekend day?\n"
                 "Pre-registered test (docs/14). Data: EarthScope MUSTANG, 4-14 Hz")
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


def friday_hours(spec, path):
    """EXPLORATORY (pre-registration section 6): hour-by-hour Friday vs Mon-Thu, before and
    after. A federal HALF day should show up as a busier Friday morning only."""
    s = rms_series(TARGET, spec["start"] - timedelta(days=1), spec["end"] + timedelta(days=2))
    s.index = s.index.tz_convert(TZ)
    d = daily_features(clean_rms(s))
    d = d[(d.index.date >= spec["start"]) & (d.index.date <= spec["end"])]
    uae = holidays.country_holidays("AE", years=[spec["start"].year, spec["end"].year])
    a, b = spec["block"]
    d = d[[t.date() not in uae and not (a <= t.date() <= b) for t in d.index]]
    hourly = d[[f"shape_{h:02d}" for h in range(24)]].values + d[["level_raw"]].values   # log10 per hour
    after = d.index.date >= spec["change"]
    fig, ax = plt.subplots(figsize=(10, 4.8))
    rows = []
    for flag, colour, label in [(False, "#7f7f7f", "before 1 Jan 2022"), (True, "#d62728", "after 1 Jan 2022")]:
        mt = hourly[(after == flag) & d["day_of_week"].isin(MON_THU).values].mean(0)
        fr = hourly[(after == flag) & (d["day_of_week"] == FRI).values].mean(0)
        diff = (10 ** (fr - mt) - 1) * 100
        ax.plot(range(24), diff, "o-", color=colour, lw=2, label=label)
        rows.append({"period": label, "fri_vs_monthu_08_12_pct": diff[8:12].mean(),
                     "fri_vs_monthu_14_18_pct": diff[14:18].mean()})
    ax.axhline(0, color="k", lw=.8)
    ax.set(xlabel="local hour (Asia/Dubai)", ylabel="Friday vs Mon-Thu, same hour (%)",
           title="EXPLORATORY: Sharjah Fridays, hour by hour (II.UOSS.10.BHZ)")
    ax.set_xticks(range(0, 24, 2))
    ax.grid(alpha=.3)
    ax.legend()
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)
    return pd.DataFrame(rows)


def main():
    os.makedirs("outputs/tables", exist_ok=True)
    os.makedirs("outputs/plots", exist_ok=True)
    main_res, main_act = analyse(MAIN)
    plac_res, plac_act = analyse(PLACEBO)
    v = verdict(main_res, plac_res)
    # EXPLORATORY (not part of the pre-registered decision)
    expl_res, _ = analyse(dict(MAIN, name="EXPLORATORY: main without school-break exclusion"), exclude_block=False)
    table = pd.DataFrame([main_res, plac_res, expl_res])
    table["verdict_preregistered"] = [v, "", ""]
    table.to_csv("outputs/tables/uae_experiment.csv", index=False)
    pd.concat([main_act.assign(analysis="main"), plac_act.assign(analysis="placebo")]) \
        .to_csv("outputs/tables/uae_daily_activity.csv")
    plot([("2021-22: weekend changed on 1 Jan 2022", main_act),
          ("2020-21 placebo: no change", plac_act)], "outputs/plots/uae_weekend_switch.png")

    pd.set_option("display.width", 200)
    print(table.T.to_string())
    print(f"\nPRE-REGISTERED VERDICT: {v}")
    fh = friday_hours(MAIN, "outputs/plots/uae_friday_hours.png")
    print("\nEXPLORATORY: Friday vs Mon-Thu, morning (08-12) and afternoon (14-18), local time")
    print(fh.to_string(index=False, float_format="{:+.0f}%".format))


if __name__ == "__main__":
    main()
