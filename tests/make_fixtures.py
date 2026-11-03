"""make_fixtures.py -- cut small REAL excerpts out of the vendored dataset for the tests.

Tests run on real data only (project rule: no synthetic data, not even in tests). The
full dataset is too big to load in every test, so we copy a few rows verbatim. Rerun
this script and `git diff tests/fixtures` should show nothing: the fixtures are exact
copies, not edited.

Fixture 1: New York (AM.R7885), 2020-03-01 to 2020-03-16 UTC. Contains 2020-03-08, the
day US clocks jumped forward (02:00 -> 03:00), so that local day has only 23 hours.

Run:  python tests/make_fixtures.py
"""
import os

REPO = os.path.join(os.path.dirname(__file__), "..")
SRC = os.path.join(REPO, "data", "external", "2020_Science_GlobalQuieting", "PaperZero_RMS", "AM.R7885.00.EHZ.csv")
OUT = os.path.join(os.path.dirname(__file__), "fixtures", "AM.R7885_2020-03-01_2020-03-16.csv")


def main():
    with open(SRC, encoding="utf-8") as f:
        lines = f.readlines()
    header, rows = lines[0], lines[1:]
    # timestamps are "YYYY-MM-DD hh:mm:ss..." in UTC, so a string comparison is enough
    keep = [r for r in rows if "2020-03-01" <= r[:10] <= "2020-03-16" and r[:13] < "2020-03-16 12"]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="") as f:
        f.write(header)
        f.writelines(keep)
    print(f"{len(keep)} real rows -> {OUT}")


if __name__ == "__main__":
    main()
