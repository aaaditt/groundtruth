"""
get_data.py -- download the REAL dataset used by this project.

Source: the official companion repository of
  Lecocq, T. et al. (2020). "Global quieting of high-frequency seismic noise due
  to COVID-19 pandemic lockdown measures." Science 369(6509), 1338-1343.
  DOI: 10.1126/science.abd2438
  Repo: https://github.com/ThomasLecocq/2020_Science_GlobalQuieting  (DOI badge -> Zenodo)

What's inside (folder PaperZero_RMS/): one CSV per real seismometer, ~170
stations worldwide (professional networks + Raspberry Shake citizen sensors).
Each row = a 15-minute window; columns = RMS ground displacement (metres)
after band-pass filtering to 0.1-1, 1-20, 4-14, 4-20 Hz. The paper uses
4-14 Hz as its main "human activity" band. Supplementary Files/Table S1 gives
each station's city, coordinates, population density, time zone and the
official lockdown dates for that location.

Run:  python src/get_data.py      (~440 MB clone)
"""
import os, subprocess, sys

REPO = "https://github.com/ThomasLecocq/2020_Science_GlobalQuieting.git"
DEST = os.path.join("data", "external", "2020_Science_GlobalQuieting")

if os.path.exists(os.path.join(DEST, "PaperZero_RMS")):
    print(f"Already present: {DEST}")
    sys.exit(0)
os.makedirs(os.path.dirname(DEST), exist_ok=True)
subprocess.check_call(["git", "clone", "--depth", "1", REPO, DEST])
print("Done.")
