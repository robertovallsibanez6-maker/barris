#!/usr/bin/env python3
"""Extrae los 73 barris del GeoJSON oficial de Open Data BCN, reproyecta
EPSG:25831 (ETRS89 / UTM 31N) a WGS84 y escribe un GeoJSON limpio.

Uso: python3 tools/build-geo.py <UNITATS_ADM_POLIGONS.json> <salida.geojson>
"""
import json
import math
import sys

# ETRS89 / GRS80
A = 6378137.0
F = 1 / 298.257222101
E2 = F * (2 - F)
K0 = 0.9996
FE = 500000.0
LON0 = math.radians(3.0)  # huso 31

DISTRICTES = {
    "01": "Ciutat Vella",
    "02": "Eixample",
    "03": "Sants-Montjuïc",
    "04": "Les Corts",
    "05": "Sarrià-Sant Gervasi",
    "06": "Gràcia",
    "07": "Horta-Guinardó",
    "08": "Nou Barris",
    "09": "Sant Andreu",
    "10": "Sant Martí",
}


def utm_to_wgs84(x, y):
    """Inversa de la transversa de Mercator (serie de Snyder)."""
    e1 = (1 - math.sqrt(1 - E2)) / (1 + math.sqrt(1 - E2))
    m = y / K0
    mu = m / (A * (1 - E2 / 4 - 3 * E2**2 / 64 - 5 * E2**3 / 256))
    phi1 = (
        mu
        + (3 * e1 / 2 - 27 * e1**3 / 32) * math.sin(2 * mu)
        + (21 * e1**2 / 16 - 55 * e1**4 / 32) * math.sin(4 * mu)
        + (151 * e1**3 / 96) * math.sin(6 * mu)
        + (1097 * e1**4 / 512) * math.sin(8 * mu)
    )
    sin1, cos1, tan1 = math.sin(phi1), math.cos(phi1), math.tan(phi1)
    c1 = (E2 / (1 - E2)) * cos1**2
    t1 = tan1**2
    n1 = A / math.sqrt(1 - E2 * sin1**2)
    r1 = A * (1 - E2) / (1 - E2 * sin1**2) ** 1.5
    d = (x - FE) / (n1 * K0)

    lat = phi1 - (n1 * tan1 / r1) * (
        d**2 / 2
        - (5 + 3 * t1 + 10 * c1 - 4 * c1**2 - 9 * (E2 / (1 - E2))) * d**4 / 24
        + (61 + 90 * t1 + 298 * c1 + 45 * t1**2 - 252 * (E2 / (1 - E2)) - 3 * c1**2)
        * d**6
        / 720
    )
    lon = LON0 + (
        d
        - (1 + 2 * t1 + c1) * d**3 / 6
        + (5 - 2 * c1 + 28 * t1 - 3 * c1**2 + 8 * (E2 / (1 - E2)) + 24 * t1**2)
        * d**5
        / 120
    ) / cos1
    return [round(math.degrees(lon), 7), round(math.degrees(lat), 7)]


def project(coords):
    if isinstance(coords[0], (int, float)):
        return utm_to_wgs84(coords[0], coords[1])
    return [project(c) for c in coords]


def main():
    src, out = sys.argv[1], sys.argv[2]
    with open(src, encoding="utf-8") as fh:
        fc = json.load(fh)

    feats = []
    for f in fc["features"]:
        p = f["properties"]
        if p.get("NIVELL") != "ADM_03_PL":
            continue
        codi = int(p["BARRI"])
        dist = p["DISTRICTE"]
        feats.append(
            {
                "type": "Feature",
                "properties": {
                    "codi": codi,
                    "nom": p["NOM"],
                    "districte": int(dist),
                    "districte_nom": DISTRICTES[dist],
                    "area": round(p["AREA"]),
                },
                "geometry": {
                    "type": f["geometry"]["type"],
                    "coordinates": project(f["geometry"]["coordinates"]),
                },
            }
        )

    feats.sort(key=lambda f: f["properties"]["codi"])
    assert len(feats) == 73, f"esperaba 73 barris, hay {len(feats)}"
    codis = [f["properties"]["codi"] for f in feats]
    assert codis == list(range(1, 74)), "códigos de barri no consecutivos 1..73"

    with open(out, "w", encoding="utf-8") as fh:
        json.dump(
            {"type": "FeatureCollection", "features": feats},
            fh,
            ensure_ascii=False,
            separators=(",", ":"),
        )
    print(f"{len(feats)} barris -> {out}")


if __name__ == "__main__":
    main()
