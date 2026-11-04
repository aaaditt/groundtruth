"""The globe's night sky is the real one: site/data/stars.json, written by
src/export_stars.py from the Yale Bright Star Catalogue (real data, no random stars)."""
import json
import os

import pytest

SITE = os.path.join(os.path.dirname(__file__), "..", "site", "data", "stars.json")


@pytest.fixture(scope="module")
def stars():
    with open(SITE, encoding="utf-8") as f:
        return json.load(f)["stars"]


def test_every_catalogue_star_is_there(stars):
    # 9,110 catalogue entries, of which 14 are not stars (blank positions)
    assert len(stars) == 9096
    assert all(0 <= ra < 360 and -90 <= dec <= 90 for ra, dec, _ in stars)


def test_the_brightest_stars_are_where_they_should_be(stars):
    sirius = stars[0]                                   # brightest first
    assert sirius == pytest.approx([101.3, -16.7, -1.5], abs=0.1)   # RA 6h45m, Dec -16.7
    # Polaris: RA 2h32m (37.9 deg), Dec +89.3, V 2.0
    assert any(abs(ra - 37.9) < 0.3 and abs(dec - 89.3) < 0.1 and abs(m - 2.0) < 0.1
               for ra, dec, m in stars)
