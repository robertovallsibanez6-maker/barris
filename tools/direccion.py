#!/usr/bin/env python3
"""Devuelve la dirección real de un local del catálogo, geocodificando sus
coordenadas con Nominatim cuando OpenStreetMap no trae la calle.

    python3 tools/direccion.py <codigo_barrio> "nombre" ["otro nombre" ...]

Imprime una línea por local: nombre | dirección | barrio según Nominatim.
Las respuestas se guardan en data/.direcciones.json para no repetir consultas.
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOGO = os.path.join(RAIZ, "tools", ".cache", "catalogo-osm.json")
CACHE = os.path.join(RAIZ, "tools", ".cache", "direcciones.json")
AGENTE = "MisionBarrisBarcelona/1.0 (proyecto personal)"


def cache_leer():
    if os.path.exists(CACHE):
        with open(CACHE, encoding="utf-8") as fh:
            return json.load(fh)
    return {}


def cache_escribir(c):
    with open(CACHE, "w", encoding="utf-8") as fh:
        json.dump(c, fh, ensure_ascii=False, indent=1)


def geocodificar(lon, lat, cache):
    clave = f"{lat:.6f},{lon:.6f}"
    if clave in cache:
        return cache[clave]
    url = (
        "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18"
        f"&lat={lat}&lon={lon}&addressdetails=1&accept-language=ca"
    )
    peticion = urllib.request.Request(url, headers={"User-Agent": AGENTE})
    with urllib.request.urlopen(peticion, timeout=30) as r:
        datos = json.load(r)
    a = datos.get("address", {})
    calle = a.get("road") or a.get("pedestrian") or a.get("footway") or ""
    numero = a.get("house_number", "")
    cache[clave] = {
        "direccion": f"{calle}, {numero}".strip(", ") if calle else "",
        "barrio": a.get("suburb") or a.get("neighbourhood") or "",
        "cp": a.get("postcode", ""),
    }
    cache_escribir(cache)
    time.sleep(1.1)  # política de uso de Nominatim
    return cache[clave]


def por_nombre(nombre, cache):
    """Segundo intento: buscar el local por nombre, que a veces trae el número.

    Ojo: Nominatim busca en toda la ciudad, así que puede devolver otro local
    que se llame igual. Quien llame a esto tiene que comprobar que la calle
    coincide con la que dio la geocodificación inversa.
    """
    clave = "q:" + nombre.lower()
    if clave in cache:
        return cache[clave]
    q = urllib.parse.quote(f"{nombre}, Barcelona")
    url = (
        f"https://nominatim.openstreetmap.org/search?q={q}&format=jsonv2"
        "&addressdetails=1&limit=3&accept-language=ca"
    )
    peticion = urllib.request.Request(url, headers={"User-Agent": AGENTE})
    try:
        with urllib.request.urlopen(peticion, timeout=30) as r:
            datos = json.load(r)
    except Exception:
        datos = []
    salida = ""
    for d in datos:
        a = d.get("address", {})
        calle = a.get("road") or a.get("pedestrian") or ""
        numero = a.get("house_number", "")
        if calle and numero:
            salida = f"{calle}, {numero}"
            break
    cache[clave] = salida
    cache_escribir(cache)
    time.sleep(1.1)
    return salida


def normaliza(t):
    return "".join(c for c in t.lower() if c.isalnum() or c == " ").strip()


def main():
    codigo = sys.argv[1]
    nombres = sys.argv[2:]
    with open(CATALOGO, encoding="utf-8") as fh:
        lista = json.load(fh)[codigo]
    cache = cache_leer()

    for nombre in nombres:
        objetivo = normaliza(nombre)
        encontrados = [l for l in lista if objetivo in normaliza(l["nombre"])]
        if not encontrados:
            print(f"{nombre} | NO ESTÁ EN ESTE BARRIO | —")
            continue
        for l in encontrados:
            dire = l["direccion"]
            barrio_nom = ""
            if not dire:
                g = geocodificar(l["lon"], l["lat"], cache)
                dire = g["direccion"]
                barrio_nom = g["barrio"]
            if dire and "," not in dire:
                # sólo se acepta el número si la calle es exactamente la misma:
                # hay locales con el mismo nombre en otros barrios
                otro = por_nombre(l["nombre"], cache)
                if otro and otro.rsplit(",", 1)[0].strip() == dire.strip():
                    dire = otro
            print(f'{l["nombre"]} | {dire or "sin dirección"} | {barrio_nom or l["barrio"]} | {l["web"]}')


if __name__ == "__main__":
    main()
