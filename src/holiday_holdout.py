"""
holiday_holdout.py -- Promise 4: what does the model think a public holiday IS?

No public holiday was ever in training (period "holiday" is excluded). For every holiday
that falls on a WORKING day (by the country's own weekend), we ask the models:
  * weekday-vs-weekend: share called "weekend"
  * day-of-week:        average P(Sunday)
and compare with ordinary working days (baseline, scored week-held-out).

Broken down by holiday type (keyword rules below; anything unmatched stays "other",
it is never guessed), plus "bridge days": ordinary working days squeezed between a
holiday and the weekend (e.g. the Friday after US Thanksgiving). Bridge days are NOT
official holidays, so they were in training -- but they are scored week-held-out, so the
model never saw them either.

P(Sunday) is reported for Saturday-Sunday-weekend countries only; elsewhere Sunday is
not the main rest day, so the number would mean something else.

Needs outputs/tables/day_scores.csv (run src/score_days.py first).
Output: outputs/tables/holiday_holdout.csv, outputs/plots/holiday_holdout.png

Run:  python src/holiday_holdout.py
"""
import os, re, sys
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))  # repo root, for `import groundtruth`
from groundtruth.calendars import load_weekend_rules, is_weekend  # noqa: E402
from groundtruth.models import load  # noqa: E402

SCORES = os.path.join("outputs", "tables", "day_scores.csv")
# Order matters: the first matching type wins. Lower-case substrings of holiday names.
TYPES = [
    ("new year", ["new year", "korean new year", "lunar", "lhochhar", "lhosar", "spring festival"]),
    ("Christmas & Easter", ["christmas", "boxing", "saint stephen", "second day of christmas", "day after christmas",
                            "easter", "good friday", "maundy", "holy", "black saturday", "pentecost", "whit",
                            "ascension"]),
    ("other religious", ["epiphany", "all saints", "all souls", "immaculate", "assumption", "corpus", "saint",
                         "carnival", "shrove", "fat tuesday", "green monday", "glorifying mother", "prophet", "eid",
                         "diwali", "holi", "guru nanak", "buddha", "mahavira", "ram navami", "shivaratri", "chhath",
                         "poornima", "nowruz", "sankranti", "poya", "sivarathri", "ash wednesday",
                         "imam", "pongal", "day of the dead"]),
    ("civic / national", ["independence", "constitution", "national", "republic", "labor", "labour", "worker",
                          "may day", "thanksgiving", "veterans", "martin luther", "washington", "memorial",
                          "australia day", "anzac", "liberation", "victory", "armistice", "women", "children",
                          "unity", "martyr", "heroes", "foundation", "founding", "emperor", "election", "culture day",
                          "king", "waitangi", "family day", "tiradentes", "benito", "juan santamar", "rizal",
                          "valor", "flag", "youth", "revolution", "union", "karume", "cassinga", "sovereignty",
                          "vernal equinox", "showa", "greenery", "coming of age", "tomb-sweeping", "ancestry",
                          "panamerican", "armed forces", "fraternization", "summer day", "peace memorial",
                          "quaid", "kashmir", "pakistan day", "democracy", "remembrance", "green march",
                          "separation", "colon day", "uprising", "unification", "errol barrow", "betico",
                          "discovery", "portuguese welcome", "farmers"]),
]


def holiday_type(name):
    """Keywords must start at a word boundary ("labor" matches "Labor Day"); "holi" must
    also END at one, otherwise every "...Holiday" would count as the festival Holi."""
    n = name.lower()
    for t, keys in TYPES:
        for k in keys:
            pattern = r"\bholi\b" if k == "holi" else r"\b" + re.escape(k)
            if re.search(pattern, n):
                return t
    return "other"


def bridge_days(s):
    """Working, non-holiday days next to a holiday on one side and a weekend day on the other."""
    out = np.zeros(len(s), bool)
    for st, g in s.groupby("station"):
        g = g.set_index("date")
        hol = set(g.index[g["period"] == "holiday"])
        wk = set(g.index[g["is_weekend"] == 1])
        one = pd.Timedelta(days=1)
        for i, (d, r) in zip(g["row"].values, g.iterrows()):
            if r["is_weekend"] == 1 or r["period"] not in ("baseline", "festive"):
                continue
            prev, nxt = d - one, d + one
            if (prev in hol and nxt in wk) or (nxt in hol and prev in wk):
                out[i] = True
    return out


def main():
    s = load(SCORES).reset_index(names="row")   # load(): keeps Namibia "NA"
    rules = load_weekend_rules()
    # Sat-Sun countries: Saturday and Sunday both weekend, Friday not (checked per row date)
    sat_sun = {cc: bool(is_weekend(pd.DatetimeIndex(["2020-01-04", "2020-01-05"]), cc, rules).all()
                        and not is_weekend(pd.DatetimeIndex(["2020-01-03"]), cc, rules).any())
               for cc in s["country_code"].dropna().unique()}
    s["sat_sun"] = s["country_code"].map(sat_sun).fillna(False)
    s["bridge"] = bridge_days(s)
    wd = s[s["is_weekend"] == 0].copy()
    wd["group"] = np.select(
        [wd["period"] == "holiday", wd["bridge"], wd["period"] == "baseline"],
        ["holiday", "bridge day", "ordinary working day"], default="")
    wd = wd[wd["group"] != ""]
    wd.loc[wd["group"] == "holiday", "type"] = wd.loc[wd["group"] == "holiday", "holiday_name"].map(holiday_type)

    def summ(x):
        return pd.Series({"n": len(x), "stations": x["station"].nunique(),
                          "called_weekend": x["pred_weekend"].mean(),
                          "mean_p_weekend": x["p_weekend"].mean(),
                          "mean_p_sunday_satsun": x.loc[x["sat_sun"], "p_sunday"].mean(),
                          "n_satsun": int(x["sat_sun"].sum())})

    rows = [summ(wd[wd["group"] == "ordinary working day"]).rename("ordinary working day"),
            summ(wd[wd["group"] == "holiday"]).rename("ALL public holidays")]
    for t in [t for t, _ in TYPES] + ["other"]:
        x = wd[(wd["group"] == "holiday") & (wd["type"] == t)]
        if len(x):
            rows.append(summ(x).rename(f"  {t}"))
    rows.append(summ(wd[wd["group"] == "bridge day"]).rename("bridge days (not official)"))
    for nm in ["bridge days, outside 21 Dec-6 Jan"]:
        x = wd[(wd["group"] == "bridge day") & (wd["period"] == "baseline")]
        rows.append(summ(x).rename(nm))
    t = pd.DataFrame(rows)
    os.makedirs("outputs/tables", exist_ok=True)
    t.to_csv("outputs/tables/holiday_holdout.csv")
    pd.set_option("display.width", 200)
    print(t.to_string(formatters={"n": "{:.0f}".format, "stations": "{:.0f}".format, "n_satsun": "{:.0f}".format,
                                  "called_weekend": "{:.1%}".format, "mean_p_weekend": "{:.2f}".format,
                                  "mean_p_sunday_satsun": "{:.2f}".format}))
    o, h = t.loc["ordinary working day"], t.loc["ALL public holidays"]
    print(f"\nHEADLINE: On held-out public holidays the model said 'weekend' {h.called_weekend:.1%} of the time "
          f"(n={h.n:.0f}), vs {o.called_weekend:.1%} for ordinary weekdays (n={o.n:.0f}).")
    print(f"Average P(Sunday), Sat-Sun countries: holidays {h.mean_p_sunday_satsun:.2f} vs ordinary weekdays "
          f"{o.mean_p_sunday_satsun:.2f}.")
    other = wd[(wd["group"] == "holiday") & (wd["type"] == "other")]["holiday_name"].value_counts()
    if len(other):
        print("\nUnclassified holiday names (type 'other'):", ", ".join(f"{k} ({v})" for k, v in other.items()))
    bridge = wd[wd["group"] == "bridge day"]
    print("\nBridge days found:")
    print(bridge.groupby(["date", "period"]).agg(stations=("station", "nunique"),
                                                 called_weekend=("pred_weekend", "mean")).to_string())

    fig, ax = plt.subplots(figsize=(10, 5))
    plot_rows = t[t["n"] >= 20]
    colours = ["#7f7f7f" if "ordinary" in i else "#d62728" if "ALL" in i else "#1f77b4" if "bridge" in i
               else "#e8908a" for i in plot_rows.index]
    ax.barh(range(len(plot_rows)), plot_rows["called_weekend"] * 100, color=colours)
    ax.set_yticks(range(len(plot_rows)), [f"{i.strip()} (n={n:.0f})" for i, n in zip(plot_rows.index, plot_rows["n"])])
    ax.invert_yaxis()
    for i, v in enumerate(plot_rows["called_weekend"] * 100):
        ax.text(v + 1, i, f"{v:.0f}%", va="center")
    ax.set(xlabel="% of working days the model calls 'weekend'", xlim=(0, 105),
           title="Held-out public holidays: the model has never seen one, yet calls most of them 'weekend'\n"
                 "(groups with n >= 20 station-days; week-held-out for ordinary days)")
    fig.tight_layout()
    fig.savefig("outputs/plots/holiday_holdout.png", dpi=150)
    plt.close(fig)


if __name__ == "__main__":
    main()
