"""stations.py -- load and check config/stations.yaml (the live-data station roster).

The checks are strict on purpose: a typo in a time zone would silently shift every
hour of a station's day, and the whole method depends on LOCAL hours being right.
"""
import os
from dataclasses import dataclass
from zoneinfo import ZoneInfo

import yaml

CONFIG = os.path.join(os.path.dirname(__file__), "..", "config", "stations.yaml")
PROVIDERS = {"earthscope", "eida", "raspberryshake"}
ROUTES = {"mustang", "waveform"}
STATUSES = {"live", "offline", "unverified"}


@dataclass(frozen=True)
class Station:
    id: str
    city: str
    country: str
    timezone: str
    provider: str
    route: str
    status: str
    lecocq: str | None
    lat: float
    lon: float
    notes: str

    @property
    def network(self): return self.id.split(".")[0]
    @property
    def station(self): return self.id.split(".")[1]
    @property
    def location(self): return self.id.split(".")[2]
    @property
    def channel(self): return self.id.split(".")[3]


def load_stations(path=CONFIG):
    with open(path, encoding="utf-8") as f:
        raw = yaml.safe_load(f)["stations"]
    out = []
    for r in raw:
        s = Station(**r)
        problems = []
        if len(s.id.split(".")) != 4:
            problems.append("id must be NET.STA.LOC.CHA")
        if len(s.country) != 2 or not s.country.isupper():
            problems.append("country must be an ISO 3166 alpha-2 code")
        try:
            ZoneInfo(s.timezone)
        except Exception:
            problems.append(f"unknown time zone {s.timezone!r}")
        if s.provider not in PROVIDERS:
            problems.append(f"provider must be one of {sorted(PROVIDERS)}")
        if s.route not in ROUTES:
            problems.append(f"route must be one of {sorted(ROUTES)}")
        if not (-90 <= s.lat <= 90 and -180 <= s.lon <= 180):
            problems.append("lat/lon out of range")
        if s.status not in STATUSES:
            problems.append(f"status must be one of {sorted(STATUSES)}")
        if problems:
            raise ValueError(f"config/stations.yaml, {s.id}: " + "; ".join(problems))
        out.append(s)
    ids = [s.id for s in out]
    if len(ids) != len(set(ids)):
        raise ValueError("config/stations.yaml: duplicate station ids")
    return out
