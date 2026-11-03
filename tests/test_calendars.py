"""Weekend and public-holiday labels.

These labels are the model's 'answer key'. They must come from calendars, never from
the seismic data. Each check below is a real calendar fact; the dates are chosen to
sit on either side of a rule.
"""
import pandas as pd
import pytest

from groundtruth.calendars import (load_weekend_rules, load_country_fixes, country_code,
                                   is_weekend, public_holidays)


@pytest.fixture(scope="module")
def rules():
    return load_weekend_rules()


def weekend(dates, iso2, rules):
    return list(is_weekend(pd.to_datetime(dates), iso2, rules))


def test_default_is_saturday_sunday(rules):
    # Fri 3, Sat 4, Sun 5 Jan 2020; France has no row of its own -> default rule
    assert weekend(["2020-01-03", "2020-01-04", "2020-01-05"], "FR", rules) == [0, 1, 1]


def test_friday_saturday_countries(rules):
    # Saudi Arabia: Friday is weekend, Sunday is a working day
    assert weekend(["2020-01-03", "2020-01-05"], "SA", rules) == [1, 0]


def test_one_day_weekends(rules):
    assert weekend(["2020-01-03", "2020-01-04"], "IR", rules) == [1, 0]   # Iran: Friday
    assert weekend(["2020-01-04", "2020-01-05"], "NP", rules) == [1, 0]   # Nepal: Saturday


def test_uae_switch_on_2022_01_01(rules):
    # Before: Fri-Sat. From 1 Jan 2022: Sat-Sun. The rule depends on the DATE.
    assert weekend(["2021-12-26", "2021-12-31"], "AE", rules) == [0, 1]   # Sun work, Fri off
    assert weekend(["2022-01-02", "2022-01-07"], "AE", rules) == [1, 0]   # Sun off, Fri work


def test_every_rule_cites_a_source(rules):
    assert (rules["source"].str.len() > 0).all()


def test_namibia_is_not_a_missing_value():
    # pandas reads the text "NA" as missing unless told not to.
    assert country_code("Namibia", "NA", load_country_fixes()) == ("NA", None)


def test_scotland_uses_scottish_holidays():
    assert country_code("Scotland", "GB", load_country_fixes()) == ("GB", "SCT")
    cal = public_holidays("GB", "SCT", [2019])
    assert cal[pd.Timestamp("2019-11-30").date()] == "Saint Andrew's Day"


def test_us_thanksgiving():
    assert public_holidays("US", None, [2019])[pd.Timestamp("2019-11-28").date()] == "Thanksgiving Day"
