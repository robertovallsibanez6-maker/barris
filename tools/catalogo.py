#!/usr/bin/env python3
"""Reparte los locales de OpenStreetMap entre los 73 barrios, por geometría.

Sirve de red de seguridad durante la investigación: cualquier restaurante que
entre en data/sugerencias.json tiene que aparecer aquí, dentro del polígono
del barrio que le toca, con su dirección. Así ni se inventa un sitio ni se
cuela uno de la calle de al lado.

Uso:
    python3 tools/catalogo.py <carpeta_osm> <salida.json>   # construir
    python3 tools/catalogo.py --barrio 65 [texto]           # consultar
    python3 tools/catalogo.py --buscar "nombre"             # localizar
"""
import json
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOGO = os.path.join(RAIZ, "tools", ".cache", "catalogo-osm.json")


def anillos(geom):
    return [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]


def dentro(x, y, poly):
    """Par-impar sobre el anillo exterior, restando los huecos."""
    def en_anillo(anillo):
        d = False
        n = len(anillo)
        for i in range(n):
            ax, ay = anillo[i]
            bx, by = anillo[(i - 1) % n]
            if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
                d = not d
        return d

    if not en_anillo(poly[0]):
        return False
    return not any(en_anillo(h) for h in poly[1:])


def construir(carpeta, salida):
    with open(os.path.join(RAIZ, "data", "barris.json"), encoding="utf-8") as fh:
        geo = json.load(fh)
    barris = [f for f in geo["features"] if f["properties"].get("tipus") == "barri"]
    cajas = []
    for f in barris:
        polys = anillos(f["geometry"])
        xs = [p[0] for poly in polys for a in poly for p in a]
        ys = [p[1] for poly in polys for a in poly for p in a]
        cajas.append((f["properties"], polys, min(xs), min(ys), max(xs), max(ys)))

    locales = {}
    for nombre in ("rest.json", "bar.json", "cafe.json", "fast_food.json"):
        ruta = os.path.join(carpeta, nombre)
        if not os.path.exists(ruta):
            continue
        with open(ruta, encoding="utf-8") as fh:
            for el in json.load(fh)["elements"]:
                t = el.get("tags", {})
                if not t.get("name"):
                    continue
                lon = el.get("lon") or el.get("center", {}).get("lon")
                lat = el.get("lat") or el.get("center", {}).get("lat")
                if lon is None:
                    continue
                clave = (t["name"].strip().lower(), round(lon, 5), round(lat, 5))
                calle = t.get("addr:street", "")
                numero = t.get("addr:housenumber", "")
                locales[clave] = {
                    "nombre": t["name"].strip(),
                    "lon": lon,
                    "lat": lat,
                    "tipo": t.get("amenity", ""),
                    "cocina": t.get("cuisine", ""),
                    "direccion": f"{calle}, {numero}".strip(", ") if calle else "",
                    "web": t.get("website") or t.get("contact:website") or "",
                    "osm": f'{el["type"][0]}{el["id"]}',
                }

    sin_barrio = 0
    salida_datos = {}
    for loc in locales.values():
        x, y = loc["lon"], loc["lat"]
        for props, polys, x0, y0, x1, y1 in cajas:
            if not (x0 <= x <= x1 and y0 <= y <= y1):
                continue
            if any(dentro(x, y, poly) for poly in polys):
                loc["codigo"] = props["codi"]
                loc["barrio"] = props["nom"]
                salida_datos.setdefault(str(props["codi"]), []).append(loc)
                break
        else:
            sin_barrio += 1

    for lista in salida_datos.values():
        lista.sort(key=lambda l: l["nombre"].lower())

    with open(salida, "w", encoding="utf-8") as fh:
        json.dump(salida_datos, fh, ensure_ascii=False, separators=(",", ":"))

    total = sum(len(v) for v in salida_datos.values())
    print(f"{total} locales repartidos en {len(salida_datos)} barrios "
          f"({sin_barrio} fuera del término)")
    faltos = [
        (len(salida_datos.get(str(p["codi"]), [])), p["nom"])
        for p, *_ in cajas
    ]
    faltos.sort()
    print("barrios con menos locales:", faltos[:8])


def cercanos(codigo, cuantos=12):
    """Locales de OTROS barrios más cercanos al borde de este.

    Para los barrios que no tienen ni un local dentro, que es donde el
    encargo permite aceptar un sitio justo en el límite.
    """
    import math

    with open(os.path.join(RAIZ, "data", "barris.json"), encoding="utf-8") as fh:
        geo = json.load(fh)
    objetivo = next(
        f for f in geo["features"]
        if f["properties"].get("codi") == int(codigo)
    )
    borde = [
        p for poly in anillos(objetivo["geometry"]) for a in poly for p in a
    ]
    with open(CATALOGO, encoding="utf-8") as fh:
        cat = json.load(fh)

    salida = []
    for c, lista in cat.items():
        if c == str(codigo):
            continue
        for l in lista:
            d = min(
                math.hypot((l["lon"] - x) * 83000, (l["lat"] - y) * 111000)
                for x, y in borde
            )
            salida.append((d, l))
    salida.sort(key=lambda t: t[0])
    for d, l in salida[:cuantos]:
        print(
            f'{d:6.0f} m  {l["nombre"]:<32} {l["direccion"] or "(sin dirección)":<38}'
            f' {l["tipo"]}  [{l["barrio"]}]'
        )


def consultar():
    if sys.argv[1] == "--cerca":
        cercanos(sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 12)
        return
    with open(CATALOGO, encoding="utf-8") as fh:
        cat = json.load(fh)
    if sys.argv[1] == "--buscar":
        aguja = sys.argv[2].lower()
        for codigo, lista in cat.items():
            for l in lista:
                if aguja in l["nombre"].lower():
                    print(f'{codigo:>3} {l["barrio"]:<40} {l["nombre"]}  |  {l["direccion"]}  |  {l["tipo"]}/{l["cocina"]}')
        return
    codigo = sys.argv[2]
    filtro = sys.argv[3].lower() if len(sys.argv) > 3 else ""
    lista = cat.get(codigo, [])
    for l in lista:
        linea = f'{l["nombre"]}  |  {l["direccion"]}  |  {l["tipo"]}/{l["cocina"]}  |  {l["web"]}'
        if not filtro or filtro in linea.lower():
            print(linea)
    print(f"— {len(lista)} locales")


if __name__ == "__main__":
    if sys.argv[1].startswith("--"):
        consultar()
    else:
        construir(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else CATALOGO)
