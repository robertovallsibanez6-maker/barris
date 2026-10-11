#!/usr/bin/env python3
"""Ensambla data/barris.json: 73 barris + polígono de mar + punto de etiqueta
(polo de inaccesibilidad) de cada barri.

Uso: python3 tools/finish-geo.py <barris_simpl.geojson> <mar_raw.geojson> <salida.json>
"""
import heapq
import json
import math
import sys

LAT0 = 41.4
KX = math.cos(math.radians(LAT0))  # escala lon -> espacio isótropo local


# --- polylabel (polo de inaccesibilidad), puerto del algoritmo de Mapbox ---


def _seg_dist_sq(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    if dx or dy:
        t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
        if t > 1:
            ax, ay = bx, by
        elif t > 0:
            ax, ay = ax + dx * t, ay + dy * t
    dx, dy = px - ax, py - ay
    return dx * dx + dy * dy


def _point_to_poly(px, py, rings):
    """Distancia firmada: positiva dentro del polígono."""
    inside = False
    best = math.inf
    for ring in rings:
        n = len(ring)
        for i in range(n):
            ax, ay = ring[i]
            bx, by = ring[(i - 1) % n]
            if (ay > py) != (by > py) and px < (bx - ax) * (py - ay) / (by - ay) + ax:
                inside = not inside
            best = min(best, _seg_dist_sq(px, py, ax, ay, bx, by))
    d = math.sqrt(best)
    return d if inside else -d


class _Cell:
    __slots__ = ("x", "y", "h", "d", "mx")

    def __init__(self, x, y, h, rings):
        self.x, self.y, self.h = x, y, h
        self.d = _point_to_poly(x, y, rings)
        self.mx = self.d + h * math.sqrt(2)  # cota superior de la celda

    def __lt__(self, other):  # el heap es un max-heap por `mx`
        return self.mx > other.mx


def polylabel(rings, precision=1.0):
    """Devuelve (punto, radio del círculo inscrito en ese punto)."""
    xs = [p[0] for p in rings[0]]
    ys = [p[1] for p in rings[0]]
    minx, miny, maxx, maxy = min(xs), min(ys), max(xs), max(ys)
    w, h = maxx - minx, maxy - miny
    cell = min(w, h)
    if cell == 0:
        return [minx, miny]

    size = cell / 2
    queue = []
    y = miny
    while y < maxy:
        x = minx
        while x < maxx:
            heapq.heappush(queue, _Cell(x + size, y + size, size, rings))
            x += cell
        y += cell

    # candidato inicial: centroide del anillo exterior
    best = _Cell(minx + w / 2, miny + h / 2, 0, rings)
    area = cx = cy = 0.0
    ring = rings[0]
    for i in range(len(ring)):
        ax, ay = ring[i]
        bx, by = ring[(i - 1) % len(ring)]
        f = ax * by - bx * ay
        cx += (ax + bx) * f
        cy += (ay + by) * f
        area += f * 3
    if area:
        c = _Cell(cx / area, cy / area, 0, rings)
        if c.d > best.d:
            best = c

    while queue:
        cell = heapq.heappop(queue)
        if cell.d > best.d:
            best = cell
        if cell.mx - best.d <= precision:
            continue
        s = cell.h / 2
        for dx, dy in ((-s, -s), (s, -s), (-s, s), (s, s)):
            heapq.heappush(queue, _Cell(cell.x + dx, cell.y + dy, s, rings))

    return [best.x, best.y], best.d


# --- utilidades de geometría ---


def rings_of(geom):
    """Devuelve lista de polígonos; cada polígono es lista de anillos."""
    if geom["type"] == "Polygon":
        return [geom["coordinates"]]
    return list(geom["coordinates"])


def ring_area_signed(ring):
    s = 0.0
    n = len(ring)
    for i in range(n):
        ax, ay = ring[i]
        bx, by = ring[(i + 1) % n]
        s += ax * by - bx * ay
    return s / 2


def rewind(geom):
    """Orienta los anillos como los quiere d3-geo: exterior en sentido horario.

    Ojo, es al revés que el RFC 7946. d3-geo trabaja sobre la esfera y, por
    convenio, el anillo exterior de un polígono menor que un hemisferio va en
    sentido horario. Con el sentido del RFC, d3 lee cada barrio como «todo el
    planeta menos esto», y fitExtent encuadra el mundo entero: el mapa sale
    reducido a un punto. El GeoJSON del Ayuntamiento viene en sentido RFC, así
    que aquí se le da la vuelta.
    """
    polys = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
    arreglados = []
    for poly in polys:
        anillos = []
        for i, anillo in enumerate(poly):
            area = ring_area_signed(anillo)
            # exterior horario (área negativa en lon/lat), huecos antihorarios
            if (i == 0 and area > 0) or (i > 0 and area < 0):
                anillo = anillo[::-1]
            anillos.append(anillo)
        arreglados.append(anillos)
    if geom["type"] == "Polygon":
        return {"type": "Polygon", "coordinates": arreglados[0]}
    return {"type": "MultiPolygon", "coordinates": arreglados}


def ring_area(ring):
    s = 0.0
    n = len(ring)
    for i in range(n):
        ax, ay = ring[i]
        bx, by = ring[(i + 1) % n]
        s += ax * by - bx * ay
    return abs(s) / 2


def poly_area(poly):
    return ring_area(poly[0]) - sum(ring_area(r) for r in poly[1:])


def to_local(poly):
    return [[[p[0] * KX, p[1]] for p in ring] for ring in poly]


def label_point(geom):
    """Punto de etiqueta y radio inscrito en metros."""
    polys = rings_of(geom)
    big = max(polys, key=poly_area)
    pt, r = polylabel(to_local(big), precision=2e-5)
    return [round(pt[0] / KX, 6), round(pt[1], 6)], round(r * 110574.0)


def main():
    src, mar_src, out = sys.argv[1], sys.argv[2], sys.argv[3]

    with open(src, encoding="utf-8") as fh:
        barris = json.load(fh)["features"]
    barris.sort(key=lambda f: f["properties"]["codi"])
    assert [f["properties"]["codi"] for f in barris] == list(range(1, 74))

    # mar: quedarse con la pieza más grande del recorte (el Mediterráneo)
    with open(mar_src, encoding="utf-8") as fh:
        mar_fc = json.load(fh)
    cands = []
    for f in mar_fc["features"]:
        cands.extend(rings_of(f["geometry"]))
    mar = max(cands, key=poly_area)

    feats = []
    for f in barris:
        p = f["properties"]
        lab, rad = label_point(f["geometry"])
        feats.append(
            {
                "type": "Feature",
                "properties": {
                    "tipus": "barri",
                    "codi": p["codi"],
                    "nom": p["nom"],
                    "districte": p["districte"],
                    "districte_nom": p["districte_nom"],
                    "area": p["area"],
                    "label": lab,
                    "radi": rad,
                },
                "geometry": rewind(f["geometry"]),
            }
        )
    feats.append(
        {
            "type": "Feature",
            "properties": {"tipus": "mar"},
            "geometry": rewind({"type": "Polygon", "coordinates": mar}),
        }
    )

    with open(out, "w", encoding="utf-8") as fh:
        json.dump(
            {"type": "FeatureCollection", "features": feats},
            fh,
            ensure_ascii=False,
            separators=(",", ":"),
        )

    # comprobación: cada etiqueta cae dentro de su barri
    bad = []
    for f in feats[:-1]:
        lp = f["properties"]["label"]
        inside = any(
            _point_to_poly(lp[0] * KX, lp[1], to_local(poly)) > 0
            for poly in rings_of(f["geometry"])
        )
        if not inside:
            bad.append(f["properties"]["nom"])
    print(f"74 features (73 barris + mar) -> {out}")
    print("etiquetas fuera de su polígono:", bad or "ninguna")
    rs = sorted(
        ((f["properties"]["radi"], f["properties"]["nom"]) for f in feats[:-1]),
    )
    print("radio inscrito menor:", rs[:3])
    print("radio inscrito mayor:", rs[-3:])
    print("area mar (deg^2):", round(poly_area(mar), 6))


if __name__ == "__main__":
    main()
