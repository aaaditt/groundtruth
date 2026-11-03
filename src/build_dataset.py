"""
build_dataset.py -- build data/processed/daily_features.csv from the real paper data.

One row = one station x one local calendar day. Also attaches, from the
paper's Table S1: city, country, population density, and the official
lockdown start date, so each day gets a `period` label. When several apply,
the first one in this list wins:
   lockdown : on/after the station's first official lockdown date  <- known disruption
   holiday  : an official public holiday in that country            <- known disruption
   festive  : 21 Dec - 6 Jan (Christmas / New Year season), other days <- known disruption
   baseline : everything else = normal life                         <- used for training

`is_weekend` follows each country's own weekend (config/weekends.csv), not a
fixed Saturday-Sunday. See src/calendars.py.

Run:  python src/build_dataset.py
"""
import glob, os, sys
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))  # repo root, for `import groundtruth`
from groundtruth.features import load_station_rms, daily_features  # noqa: E402
from groundtruth.calendars import load_weekend_rules, load_country_fixes, country_code, is_weekend, public_holidays  # noqa: E402

ROOT = os.path.join("data", "external", "2020_Science_GlobalQuieting")
RMS_DIR = os.path.join(ROOT, "PaperZero_RMS")
TABLE_S1 = os.path.join(ROOT, "Supplementary Files", "Table S1 - Lockdown stations.csv")
OUT = os.path.join("data", "processed", "daily_features.csv")


def main():
    meta = pd.read_csv(TABLE_S1, encoding="latin-1")  # latin-1, not UTF-8
    rules, fixes = load_weekend_rules(), load_country_fixes()
    files = {os.path.basename(f).split(".")[0] + "." + os.path.basename(f).split(".")[1]: f
             for f in glob.glob(os.path.join(RMS_DIR, "*.csv"))}
    frames = []
    for _, m in meta.iterrows():
        code = m["Station_Code"]
        if code not in files or pd.isna(m["TimeZone"]) or pd.isna(m["Date_LD1"]):
            continue
        s = load_station_rms(files[code], m["TimeZone"])
        if s is None or len(s) < 1000:
            continue
        d = daily_features(s)
        if len(d) < 60:
            continue
        # dayfirst=True is mandatory, not stylistic. Table S1 stores dates as
        # dd/mm/yyyy, so pandas' default parse reads "08/03/2020" as 3 August
        # 2020 -- months after the recordings end -- for any date whose day and
        # month are both <= 12. That silently mislabels every period below.
        ld = pd.to_datetime(m["Date_LD1"], dayfirst=True)
        d["station"] = code
        d["city"] = m["City"]
        d["country"] = m["Country name"]
        iso2, subdiv = country_code(m["Country name"], m["Country code"], fixes)
        d["country_code"] = iso2
        d["pop_density"] = m["pop_den_30s"]
        d["lockdown_date"] = ld.date()
        # weekend days for THIS country on THIS date (not always Sat-Sun)
        d["is_weekend"] = is_weekend(d.index, iso2, rules)
        # official public holidays (national calendar, from the `holidays` package)
        cal = public_holidays(iso2, subdiv, sorted(set(d.index.year)))
        d["holiday_name"] = [cal.get(t.date(), "") for t in d.index]
        d["is_public_holiday"] = (d["holiday_name"] != "").astype(int)
        festive = ((d.index.month == 12) & (d.index.day >= 21)) | ((d.index.month == 1) & (d.index.day <= 6))
        d["period"] = np.select(
            [d.index >= ld, d["is_public_holiday"].values == 1, festive],
            ["lockdown", "holiday", "festive"], default="baseline")
        base = d.loc[d["period"] == "baseline", "level_raw"]
        # robust z-score (median / MAD) so a few broken days can't distort the scale
        mad = 1.4826 * (base - base.median()).abs().median() + 1e-9
        d["level"] = ((d["level_raw"] - base.median()) / mad).clip(-10, 10)
        frames.append(d.reset_index())
        print(f"{code:10s} {str(m['City'])[:22]:22s} days={len(d):3d} baseline={int((d['period']=='baseline').sum())}")
    df = pd.concat(frames, ignore_index=True)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    df.to_csv(OUT, index=False)
    print(f"\n{df['station'].nunique()} stations, {len(df)} station-days -> {OUT}")


if __name__ == "__main__":
    main()
