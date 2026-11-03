"""
survey_mustang.py -- which of the paper's stations does MUSTANG (Route A) cover?

For each non-Raspberry-Shake station in the Lecocq et al. (2020) data, ask MUSTANG for
ONE hour of spectra on two days:
   2020-01-15  : inside the Lecocq period  -> usable to VALIDATE Route A against Lecocq
   2026-10-01  : recent                     -> usable for LIVE data
Raspberry Shake (AM) data is archived by Raspberry Shake, not EarthScope, so MUSTANG
does not cover it.

~200 small requests at 1 per second (about 4 minutes).
Output: outputs/tables/mustang_coverage.csv

Run:  python src/survey_mustang.py
"""
import glob, os, sys
from datetime import date

import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))  # repo root, for `import groundtruth`
from groundtruth.mustang import available  # noqa: E402

RMS_DIR = os.path.join("data", "external", "2020_Science_GlobalQuieting", "PaperZero_RMS")
OUT = os.path.join("outputs", "tables", "mustang_coverage.csv")
OLD, NEW = date(2020, 1, 15), date(2026, 10, 1)


def main():
    df = pd.read_csv(os.path.join("data", "processed", "daily_features.csv"),
                     usecols=["station", "city", "country_code"]).drop_duplicates("station")
    files = {".".join(os.path.basename(f).split(".")[:2]): os.path.basename(f)[:-4]
             for f in glob.glob(os.path.join(RMS_DIR, "*.csv"))}
    rows = []
    for _, r in df.iterrows():
        if r["station"].startswith("AM.") or r["station"] not in files:
            continue
        target = files[r["station"]]                     # NET.STA.LOC.CHA as in the paper
        old, new = available(target, OLD), available(target, NEW)
        rows.append({"station": r["station"], "target": target, "city": r["city"],
                     "country": r["country_code"], f"mustang_{OLD}": old, f"mustang_{NEW}": new})
        print(f"{target:18s} {str(r['city'])[:20]:20s} {OLD}: {'yes' if old else ' - '}   {NEW}: {'yes' if new else ' - '}")
    out = pd.DataFrame(rows)
    out.to_csv(OUT, index=False)
    print(f"\n{len(out)} stations surveyed -> {OUT}")
    print(f"MUSTANG has {OLD}: {out[f'mustang_{OLD}'].sum()}   has {NEW}: {out[f'mustang_{NEW}'].sum()}   "
          f"both: {(out[f'mustang_{OLD}'] & out[f'mustang_{NEW}']).sum()}")


if __name__ == "__main__":
    main()
