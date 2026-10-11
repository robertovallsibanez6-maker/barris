#!/usr/bin/env python3
"""Dibuja los iconos de la app: la silueta de Barcelona en terracota sobre
papel, rasterizada desde el propio GeoJSON de los barrios.

Uso: python3 tools/icons.py
"""
import json
import math
import os
import struct
import zlib

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAPEL = (0xF4, 0xEB, 0xDD)
TERRACOTA = (0xD4, 0x67, 0x4A)
SS = 4  # submuestreo por eje

# (nombre, lado, margen relativo)
SALIDAS = [
    ("icono-180.png", 180, 0.13),
    ("icono-192.png", 192, 0.13),
    ("icono-512.png", 512, 0.13),
    ("icono-512-recortable.png", 512, 0.26),  # «maskable»: zona segura amplia
]


def mercator(lon, lat):
    x = math.radians(lon)
    y = math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
    return x, y


def area_anillo(anillo):
    t = 0.0
    for i in range(len(anillo)):
        ax, ay = anillo[i]
        bx, by = anillo[(i + 1) % len(anillo)]
        t += ax * by - bx * ay
    return abs(t) / 2


def poligonos(geo):
    """Silueta de la ciudad, ya disuelta y simplificada por tools/build-map.sh.

    Se queda sólo con la masa principal: los dos exclaves de Vallvidrera son
    territorio real de la ciudad, pero a 60 px parecen una mancha suelta.
    """
    geoms = (
        geo["geometries"]
        if geo.get("type") == "GeometryCollection"
        else [f["geometry"] for f in geo["features"]]
    )
    todos = []
    for g in geoms:
        polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        for poly in polys:
            todos.append([[mercator(lon, lat) for lon, lat in a] for a in poly])
    mayor = max(todos, key=lambda p: area_anillo(p[0]))
    return [mayor]


def rasterizar(polys, lado, margen):
    """Devuelve una matriz de cobertura 0..SS*SS por píxel (unión de polígonos)."""
    xs = [p[0] for poly in polys for anillo in poly for p in anillo]
    ys = [p[1] for poly in polys for anillo in poly for p in anillo]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)

    util = lado * (1 - 2 * margen)
    k = util / max(x1 - x0, y1 - y0)
    despx = (lado - (x1 - x0) * k) / 2
    despy = (lado - (y1 - y0) * k) / 2

    def a_pantalla(p):
        # y invertida: en Mercator crece al norte, en la imagen crece al sur
        return ((p[0] - x0) * k + despx, (y1 - p[1]) * k + despy)

    polys = [[[a_pantalla(p) for p in anillo] for anillo in poly] for poly in polys]

    n = lado * SS
    dentro = bytearray(n * n)  # 1 si el subpíxel cae dentro de la ciudad

    for poly in polys:
        bordes = []
        for anillo in poly:
            for i in range(len(anillo)):
                ax, ay = anillo[i]
                bx, by = anillo[(i + 1) % len(anillo)]
                if ay != by:
                    bordes.append((ax, ay, bx, by))
        if not bordes:
            continue
        ymin = max(0, int(min(min(e[1], e[3]) for e in bordes) * SS))
        ymax = min(n - 1, int(max(max(e[1], e[3]) for e in bordes) * SS) + 1)

        for fila in range(ymin, ymax + 1):
            y = (fila + 0.5) / SS
            cortes = []
            for ax, ay, bx, by in bordes:
                if (ay <= y < by) or (by <= y < ay):
                    cortes.append(ax + (y - ay) * (bx - ax) / (by - ay))
            if not cortes:
                continue
            cortes.sort()
            base = fila * n
            # regla par-impar: el relleno de cada polígono ya respeta sus huecos
            for i in range(0, len(cortes) - 1, 2):
                xa = int(math.floor(cortes[i] * SS + 0.5))
                xb = int(math.ceil(cortes[i + 1] * SS - 0.5))
                if xb < 0 or xa > n - 1:
                    continue
                for col in range(max(0, xa), min(n - 1, xb) + 1):
                    dentro[base + col] = 1

    cobertura = [[0] * lado for _ in range(lado)]
    for py in range(lado):
        fila = cobertura[py]
        for sy in range(SS):
            base = (py * SS + sy) * n
            for px in range(lado):
                c = 0
                off = base + px * SS
                for sx in range(SS):
                    c += dentro[off + sx]
                fila[px] += c
    return cobertura


def suavizar(cobertura, lado, radio):
    """Desenfoque de caja + umbral: cierra el canal del puerto y se come el
    espigón, que a tamaño de icono sólo parecen un arañazo."""
    maximo = SS * SS
    campo = [[c / maximo for c in fila] for fila in cobertura]

    def caja(campo, r):
        ancho = 2 * r + 1
        # horizontal
        paso = []
        for fila in campo:
            acum = []
            suma = sum(fila[0 : r + 1]) + fila[0] * r
            for x in range(lado):
                acum.append(suma / ancho)
                sale = fila[max(0, x - r)]
                entra = fila[min(lado - 1, x + r + 1)]
                suma += entra - sale
            paso.append(acum)
        # vertical
        salida = [[0.0] * lado for _ in range(lado)]
        for x in range(lado):
            suma = sum(paso[y][x] for y in range(0, r + 1)) + paso[0][x] * r
            for y in range(lado):
                salida[y][x] = suma / ancho
                suma += paso[min(lado - 1, y + r + 1)][x] - paso[max(0, y - r)][x]
        return salida

    campo = caja(caja(campo, radio), radio)
    campo = [[1.0 if v >= 0.5 else 0.0 for v in fila] for fila in campo]
    campo = caja(campo, max(1, radio // 3))  # un pelo de antialias en el borde
    return [[min(maximo, round(v * maximo)) for v in fila] for fila in campo]


def png(ruta, lado, cobertura):
    maximo = SS * SS
    filas = bytearray()
    for py in range(lado):
        filas.append(0)  # filtro «none»
        fila = cobertura[py]
        for px in range(lado):
            a = fila[px] / maximo
            for i in range(3):
                filas.append(round(PAPEL[i] * (1 - a) + TERRACOTA[i] * a))

    def trozo(tipo, datos):
        return (
            struct.pack(">I", len(datos))
            + tipo
            + datos
            + struct.pack(">I", zlib.crc32(tipo + datos) & 0xFFFFFFFF)
        )

    with open(ruta, "wb") as fh:
        fh.write(b"\x89PNG\r\n\x1a\n")
        fh.write(trozo(b"IHDR", struct.pack(">IIBBBBB", lado, lado, 8, 2, 0, 0, 0)))
        fh.write(trozo(b"IDAT", zlib.compress(bytes(filas), 9)))
        fh.write(trozo(b"IEND", b""))


def main():
    with open(os.path.join(RAIZ, "icons", "silueta.json"), encoding="utf-8") as fh:
        geo = json.load(fh)
    polys = list(poligonos(geo))
    destino = os.path.join(RAIZ, "icons")
    os.makedirs(destino, exist_ok=True)
    for nombre, lado, margen in SALIDAS:
        cob = suavizar(rasterizar(polys, lado, margen), lado, max(2, round(lado / 150)))
        ruta = os.path.join(destino, nombre)
        png(ruta, lado, cob)
        print(f"{nombre}  {lado}x{lado}  {os.path.getsize(ruta) // 1024} KB")


if __name__ == "__main__":
    main()
