"""check_reproduction.py -- is a freshly rebuilt dataset the same as the committed one?

Used by CI after `python src/build_dataset.py`. Byte-for-byte equality is too strict
across operating systems (Windows and Linux maths libraries can differ in the last
binary digit of a log10), so we check:
  - same rows, same columns, same order
  - every label / text / integer column EXACTLY equal (period, is_weekend, holidays...)
  - every float column equal to within 1e-9 (far below anything that affects results)
and print the largest float difference so any drift is visible, not hidden.

Run:  python tests/check_reproduction.py <committed.csv> <rebuilt.csv>
"""
import sys

import numpy as np
import pandas as pd

TOL = 1e-9


def main(a_path, b_path):
    a = pd.read_csv(a_path, keep_default_na=False)
    b = pd.read_csv(b_path, keep_default_na=False)
    assert list(a.columns) == list(b.columns), "columns differ"
    assert len(a) == len(b), f"row count differs: {len(a)} vs {len(b)}"
    worst = 0.0
    for c in a.columns:
        if a[c].dtype.kind == "f" or b[c].dtype.kind == "f":
            d = np.nanmax(np.abs(a[c].astype(float).values - b[c].astype(float).values))
            same_nan = (a[c].isna() == b[c].isna()).all()
            assert same_nan and d <= TOL, f"{c}: max difference {d:.3g}"
            worst = max(worst, d)
        else:
            bad = (a[c].astype(str) != b[c].astype(str))
            assert not bad.any(), f"{c}: {bad.sum()} rows differ, e.g. row {bad.idxmax()}"
    print(f"OK: {len(a)} rows x {len(a.columns)} columns; labels identical; "
          f"largest float difference {worst:.3g} (tolerance {TOL:g})")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
