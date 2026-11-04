"""
export_stars.py -- the real night sky behind the globe (site/globe.html).

The starfield is not decoration made up by a random number generator: it is every
star in the Yale Bright Star Catalogue (the ~9,100 stars visible to the naked eye),
drawn at its real position and sized by its real brightness.

Source: Hoffleit, D. & Warren, W. H. Jr. (1991), The Bright Star Catalogue, 5th Revised
Ed., Yale University Observatory. CDS catalogue V/50. Fixed-width file "bsc5.dat",
downloaded from the Harvard copy (the CDS servers were unreachable on 2026-11-04):
    http://tdc-www.harvard.edu/catalogs/bsc5.dat.gz -> data/external/bsc5/bsc5.dat.gz
Byte layout (1-based, from the catalogue's ReadMe): RA J2000 h/m/s at 76-83,
Dec J2000 sign/d/m/s at 84-90, V magnitude at 103-107.

Output: site/data/stars.json  {"stars": [[ra_deg, dec_deg, vmag], ...]}
        rounded to 0.1 (a tenth of a degree is far below a screen pixel here)
Run:    python src/export_stars.py
"""
import gzip
import json
import os

SRC = os.path.join("data", "external", "bsc5", "bsc5.dat.gz")
OUT = os.path.join("site", "data", "stars.json")


def parse(line):
    """One catalogue line -> (ra_deg, dec_deg, vmag), or None for the 14 entries that
    are not stars (novae and galaxies kept as placeholders, with blank positions)."""
    ra, dec, mag = line[75:83], line[83:90], line[102:107]
    if not ra.strip() or not mag.strip():
        return None
    ra_deg = 15 * (int(ra[0:2]) + int(ra[2:4]) / 60 + float(ra[4:8]) / 3600)
    sign = -1 if dec[0] == "-" else 1
    dec_deg = sign * (int(dec[1:3]) + int(dec[3:5]) / 60 + int(dec[5:7]) / 3600)
    # round, then wrap: 23h59m58s rounds to 360.0, which is the same direction as 0.0
    return round(ra_deg, 1) % 360, round(dec_deg, 1), round(float(mag), 1)


def main():
    with gzip.open(SRC, "rt", encoding="latin-1") as f:
        lines = f.read().splitlines()
    stars = [s for s in map(parse, lines) if s is not None]
    stars.sort(key=lambda s: s[2])                       # brightest first
    out = {"generated_from": "src/export_stars.py",
           "source": "Yale Bright Star Catalogue, 5th Revised Ed. (Hoffleit & Warren 1991), CDS V/50",
           "columns": ["ra_deg_j2000", "dec_deg_j2000", "v_mag"], "stars": stars}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"{len(lines)} catalogue lines, {len(stars)} stars; brightest {stars[0]}; "
          f"faintest V={stars[-1][2]}")
    print(f"-> {OUT} ({os.path.getsize(OUT) / 1e3:.0f} kB)")


if __name__ == "__main__":
    main()
