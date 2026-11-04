"""
places.py -- honest display names for seismometers on the website.

The dots on the globe and the research map sit where the SENSOR is (FDSN station
service). The paper's Table S1 names a city, and some sensors are tens of km from it:
Table S1's "Sao Paulo" sensor is in Valinhos, near Campinas. The published tables keep
Table S1's names; only the website labels change.

Rule (fixed before measuring, src/check_places.py): if the sensor is more than
RELABEL_KM from the city Table S1 names (GeoNames gazetteer), or the name is not a
GeoNames place and not part of the station's FDSN site name, the label changes:
  * "Site (near City)"  when the station's FDSN site name gives a place of its own
  * "Near City"         when the operator named the site after the city itself
  * Site      = taken from the station's FDSN site name (the test checks this)
  * near City = a GeoNames place within 100 km of the sensor (the test checks this)
The measured distances live in outputs/tables/station_places.csv.
"""

RELABEL_KM = 20

# station ('NET.STA') -> (site, near_city). Either can be None. Distances in brackets
# are sensor -> named city, from outputs/tables/station_places.csv.
DISPLAY = {
    "BL.VABB": ("Valinhos", "Campinas"),          # Table S1 "Sao Paulo" (69 km away; Campinas 15 km)
    "ON.TIJ01": ("Tijucas do Sul", "Joinville"),  # Table S1 "Joinvile" (48 km)
    "II.NNA": ("Nana", "Lima"),                   # 21 km
    "NE.WSPT": ("Westport", "Bridgeport"),        # Table S1 "Connecticut", a state (Bridgeport 12 km)
    "S1.AUKSC": ("Keysborough", "Melbourne"),     # 24 km
    "II.UOSS": ("Hajar Mts", "Kalba"),            # Table S1 "Sharjah" (91 km); Kalba 19 km
    "GT.LPAZ": (None, "La Paz"),                  # 24 km; the operator calls the site "La Paz"
    "IU.OTAV": (None, "Otavalo"),                 # 21 km; the operator calls the site "Otavalo"
    "IU.DAV": ("Davao", None),                    # Table S1 says "Dabaw" (Cebuano); FDSN says Davao
}

# The one site name NOT taken from the FDSN site name: II.UOSS's site name is its
# operator ("Univ. of Sharjah"). The vault is in the Hajar mountains, 284 m up.
SITE_NOT_FROM_FDSN = {"II.UOSS"}


def display_name(station, paper_city):
    """The label the website shows for `station` ('NET.STA')."""
    if station not in DISPLAY:
        return paper_city
    site, near = DISPLAY[station]
    if site and near:
        return f"{site} (near {near})"
    return site if site else f"Near {near}"
