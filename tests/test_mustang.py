"""MUSTANG (Route A) parsing and physics, on a real response saved verbatim:
II.UOSS.10.BHZ (Sharjah), 2022-01-10 00:00-03:00 UTC, downloaded 2026-11-03 from
https://service.earthscope.org/mustang/noise-psd/1/query (format=text)."""
import os

import numpy as np
import pandas as pd
import pytest

from groundtruth.mustang import parse, band_rms

FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures", "mustang_II.UOSS.10.BHZ_2022-01-10T00-03.txt")


@pytest.fixture(scope="module")
def psd():
    with open(FIXTURE, encoding="utf-8") as f:
        return parse(f.read())


def test_parse_finds_every_spectrum(psd):
    # one-hour windows every 30 minutes, 00:00 ... 02:30 -> 6 spectra
    assert psd["start"].nunique() == 6
    assert str(psd["start"].min()) == "2022-01-10 00:00:00+00:00"


def test_bins_are_eighth_octave(psd):
    f = np.sort(psd.loc[psd["start"] == psd["start"].min(), "freq"].values)
    assert np.allclose(f[1:] / f[:-1], 2 ** (1 / 8), rtol=1e-3)


def test_labels_are_window_starts(psd):
    # MUSTANG's own label, unadjusted (start labels matched Lecocq best; see work log)
    s = band_rms(psd)
    assert str(s.index[0]) == "2022-01-10 00:00:00+00:00"   # window 00:00-01:00
    assert str(s.index[1]) == "2022-01-10 00:30:00+00:00"   # window 00:30-01:30


def test_displacement_conversion_by_hand(psd):
    # Recompute the first window's 4-14 Hz displacement RMS step by step.
    one = psd[(psd["start"] == psd["start"].min()) & psd["freq"].between(4, 14)]
    f, db = one["freq"].values, one["db"].values
    accel_power = 10 ** (db / 10)                       # (m/s^2)^2 / Hz
    disp_power = accel_power / (2 * np.pi * f) ** 4     # m^2 / Hz
    width = f * (2 ** (1 / 16) - 2 ** (-1 / 16))        # Hz
    expected = np.sqrt((disp_power * width).sum())      # m
    assert band_rms(psd).iloc[0] == pytest.approx(expected, rel=1e-12)


def test_magnitude_is_physically_plausible(psd):
    # Ambient 4-14 Hz ground motion: ~0.01 - 100 nanometres.
    s = band_rms(psd)
    assert ((s > 1e-11) & (s < 1e-7)).all()
