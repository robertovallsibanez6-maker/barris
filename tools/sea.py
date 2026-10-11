#!/usr/bin/env python3
"""Construye el polígono del mar a partir del propio contorno municipal.

La costa de Barcelona corre a ~N38ºE. Giramos el contorno de la ciudad para
poner la costa horizontal y nos quedamos con su envolvente marina: para cada
franja a lo largo de la costa, el punto del contorno que más se adentra en el
mar. El borde de tierra del mar es así la costa real —puerto y bocana del
Besòs incluidos— y no se pinta de azul ningún municipio vecino.

Dos detalles importantes:
  · hay que densificar el contorno antes de medir, porque en los tramos
    rectos no hay vértices y la franja se quedaría con un punto de tierra
    adentro;
  · los extremos (el límite con el Prat al suroeste y con Sant Adrià al
    noreste) son frontera de tierra, no de mar, así que se recorta la
    envolvente en cuanto gira bruscamente hacia el interior.

Uso: python3 tools/sea.py <ciutat.geojson> <salida_mar.geojson>
"""
import json
import math
import sys

LAT0 = 41.4
AZ = math.radians(38.0)  # rumbo de la costa
KX = math.cos(math.radians(LAT0)) * 111320.0  # grados lon -> m
KY = 110574.0  # grados lat -> m

PASO = 20.0  # densificado del contorno, en metros
BIN = 80.0  # ancho de franja de la envolvente, en metros
# Recorte de los extremos: el límite con el Prat al suroeste y con Sant Adrià
# al noreste son frontera de tierra, no de mar. Medido sobre el contorno real.
TRIM_SW = 150.0
TRIM_NE = 1250.0
OFFSHORE = 9000.0  # cuánto se mete el mar hacia fuera, en metros
PROLONGA = 8000.0  # prolongación de la costa más allá del término municipal


def to_xy(lon, lat):
    x, y = lon * KX, lat * KY
    c, s = math.cos(-AZ), math.sin(-AZ)
    return x * c - y * s, x * s + y * c


def to_lonlat(x, y):
    c, s = math.cos(AZ), math.sin(AZ)
    xx, yy = x * c - y * s, x * s + y * c
    return [round(xx / KX, 6), round(yy / KY, 6)]


def densificar(anillo):
    """Añade puntos cada PASO metros para que ninguna franja se quede sin."""
    salida = []
    for i in range(len(anillo)):
        ax, ay = anillo[i]
        bx, by = anillo[(i + 1) % len(anillo)]
        salida.append((ax, ay))
        largo = math.hypot(bx - ax, by - ay)
        for j in range(1, int(largo // PASO)):
            t = j * PASO / largo
            salida.append((ax + (bx - ax) * t, ay + (by - ay) * t))
    return salida


def main():
    src, out = sys.argv[1], sys.argv[2]
    with open(src, encoding="utf-8") as fh:
        g = json.load(fh)
    geoms = g["geometries"] if g["type"] == "GeometryCollection" else [
        f["geometry"] for f in g["features"]
    ]

    pts = []
    for geom in geoms:
        polys = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
        for poly in polys:
            pts.extend(densificar([to_xy(lon, lat) for lon, lat in poly[0]]))

    # envolvente marina: el punto más adentrado en el mar de cada franja
    bajo = {}
    for x, y in pts:
        k = int(math.floor(x / BIN))
        if k not in bajo or y < bajo[k][1]:
            bajo[k] = (x, y)

    claves = sorted(bajo)
    x0 = bajo[claves[0]][0] + TRIM_SW
    x1 = bajo[claves[-1]][0] - TRIM_NE
    env = [bajo[k] for k in claves if x0 <= bajo[k][0] <= x1]

    # media móvil de 3, para que el binning no deje dientes de sierra
    suave = []
    for i, (x, y) in enumerate(env):
        lo, hi = max(0, i - 1), min(len(env), i + 2)
        suave.append((x, sum(p[1] for p in env[lo:hi]) / (hi - lo)))
    env = suave

    # Prolongar la costa por los dos extremos siguiendo el eje de la costa:
    # el mar no se acaba donde se acaba Barcelona, y si el polígono se cortara
    # en el límite del término quedaría un triángulo de papel junto a la
    # orilla. El Prat y Sant Adrià siguen la misma línea de costa.
    env = (
        [(env[0][0] - PROLONGA, env[0][1])]
        + env
        + [(env[-1][0] + PROLONGA, env[-1][1])]
    )

    ymin = min(p[1] for p in env) - OFFSHORE
    anillo = [to_lonlat(x, y) for x, y in env]
    anillo.append(to_lonlat(env[-1][0] + OFFSHORE, ymin))
    anillo.append(to_lonlat(env[0][0] - OFFSHORE, ymin))
    anillo.append(anillo[0])

    with open(out, "w", encoding="utf-8") as fh:
        json.dump(
            {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "properties": {"tipus": "mar"},
                        "geometry": {"type": "Polygon", "coordinates": [anillo]},
                    }
                ],
            },
            fh,
            ensure_ascii=False,
            separators=(",", ":"),
        )
    largo = (env[-1][0] - env[0][0]) / 1000
    print(f"mar: {len(anillo)} vértices, costa de {largo:.1f} km")


if __name__ == "__main__":
    main()
