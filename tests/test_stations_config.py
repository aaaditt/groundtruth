"""config/stations.yaml must load cleanly and reject obvious mistakes."""
import pytest

from groundtruth.stations import load_stations


def test_roster_loads():
    st = load_stations()
    assert len(st) >= 1
    uoss = next(s for s in st if s.station == "UOSS")
    # Location 10, not 00: 00 had a sensor swap on 2022-02-02, mid-experiment.
    assert (uoss.network, uoss.location, uoss.channel) == ("II", "10", "BHZ")
    assert uoss.timezone == "Asia/Dubai"


def test_bad_timezone_is_rejected(tmp_path):
    p = tmp_path / "stations.yaml"
    p.write_text(
        "stations:\n"
        "  - {id: II.UOSS.10.BHZ, city: Sharjah, country: AE, timezone: Asia/Dubay,\n"
        "     provider: earthscope, route: mustang, status: live, lecocq: null, notes: x}\n")
    with pytest.raises(ValueError, match="time zone"):
        load_stations(p)
