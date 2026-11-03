"""
calendars.py -- which days are weekends and which are public holidays, per country.

Why this exists: the first version of the project assumed every country rests on
Saturday and Sunday. That's wrong for some countries in the data (Saudi Arabia and
Israel rest Friday-Saturday, Iran and Palestine on Friday, Nepal on Saturday...),
and it only knew about one holiday window (21 Dec - 6 Jan). Both are now looked up
from cited sources instead of being hard-coded.

IMPORTANT: these labels come from calendars and labour-law sources, NEVER from the
seismic data itself. If we decided "Friday is the weekend here" because Friday looked
quiet, we'd be marking the model's homework with its own answers.

Files used:
  config/weekends.csv       weekend days per country, with the date each rule starts
  config/country_fixes.csv  corrections to the country codes in the paper's Table S1
Public holidays come from the `holidays` Python package (national calendars).
"""
import os
import pandas as pd
import holidays

CONFIG = os.path.join(os.path.dirname(__file__), "..", "config")
DOW = {"Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5, "Sun": 6}


def load_weekend_rules():
    rules = pd.read_csv(os.path.join(CONFIG, "weekends.csv"), keep_default_na=False)
    rules["valid_from"] = pd.to_datetime(rules["valid_from"])
    rules["days"] = rules["weekend_days"].map(lambda s: {DOW[d] for d in s.split(";")})
    return rules


def load_country_fixes():
    # keep_default_na=False: otherwise Namibia's code "NA" turns into a missing value
    fx = pd.read_csv(os.path.join(CONFIG, "country_fixes.csv"), keep_default_na=False, dtype=str)
    return fx.set_index("table_s1_country")


def country_code(name, table_code, fixes):
    """ISO 3166 alpha-2 code + optional holiday subdivision for a Table S1 row."""
    if name in fixes.index:
        r = fixes.loc[name]
        return r["iso2"], (r["holiday_subdiv"] or None)
    return str(table_code), None


def is_weekend(dates, iso2, rules):
    """1 if the date is a weekend day in that country ON THAT DATE, else 0.

    Rules can change over time (the UAE switched on 2022-01-01), so for each date we
    use the most recent rule whose valid_from is on or before it."""
    dates = pd.DatetimeIndex(dates)
    r = rules[rules["iso2"] == iso2]
    if r.empty:
        r = rules[rules["iso2"] == "*"]
    r = r.sort_values("valid_from")
    out = pd.Series(0, index=dates)
    for _, rule in r.iterrows():
        on = dates >= rule["valid_from"]
        out[on] = dates[on].dayofweek.isin(rule["days"]).astype(int)
    return out.values


def public_holidays(iso2, subdiv, years):
    """{date: holiday name} for a country's national public holidays.
    Names in English where the package has a translation (else the local language)."""
    try:
        cal = holidays.country_holidays(iso2, subdiv=subdiv, years=years, language="en_US")
    except Exception:
        cal = holidays.country_holidays(iso2, subdiv=subdiv, years=years)
    return dict(cal)
