# Provenance of the vendored dataset

`2020_Science_GlobalQuieting/` is a **verbatim copy** of the official companion
repository of the paper this project is built on. Nothing in it is ours, and nothing
in it has been modified, filtered or regenerated.

| | |
|---|---|
| Upstream | https://github.com/ThomasLecocq/2020_Science_GlobalQuieting |
| Commit | `d7c8fadbbc17bc779188dbdb9efaef0f5a93afbe` |
| Commit date | 2020-07-24 |
| Commit subject | "link to science paper in README" |
| Retrieved | 2026-09-20 |
| Licence | EUPL v1.1 — see `2020_Science_GlobalQuieting/LICENCE.txt` |

> **Lecocq, T., Hicks, S. P., Van Noten, K., et al. (2020).** Global quieting of
> high-frequency seismic noise due to COVID-19 pandemic lockdown measures. *Science*,
> 369(6509), 1338–1343. doi:[10.1126/science.abd2438](https://doi.org/10.1126/science.abd2438)

**If you use this data, cite Lecocq et al. (2020), not this repository.**

## Why it is committed

It was previously downloaded on demand by `src/get_data.py` and excluded via
`.gitignore`. It is now vendored so the repository is self-contained: it can be cloned
and run with no download step, and the exact bytes every result was computed from are
pinned in history rather than depending on an upstream repo that could move or vanish.

The cost is repository size — roughly 113 MB packed, against ~2 MB before.

`src/get_data.py` still works. It detects that `PaperZero_RMS/` is already present and
exits without downloading, so `run_all.sh` is unaffected.

## Integrity

The upstream `.git` directory was removed when vendoring, so this copy cannot be
`git pull`ed. To verify it against upstream, clone the commit above separately and
diff the two trees.

The CSVs are CRLF-terminated exactly as published. `.gitattributes` marks
`data/external/**` as `-text` so git performs no end-of-line conversion on them in
either direction. Removing that rule would silently alter the data on checkout.

## Licence note

The dataset is EUPL v1.1, which permits redistribution provided the licence and
attribution are preserved — both are, in `LICENCE.txt` and in this file. EUPL is a
copyleft licence; this repository has no licence file of its own, so if one is added
later, check EUPL compatibility for anything that is a derivative of this data rather
than merely a user of it.
