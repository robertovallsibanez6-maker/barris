#!/usr/bin/env python3
"""Añade (o reemplaza) las sugerencias y la frase de un barrio.

Lee por la entrada estándar un JSON:

    {
      "codigo": 65,
      "frase": "…",
      "sugerencias": [
        {"nombre": "...", "cocina": "...", "precio": "€€",
         "porque": "...", "pide": "...", "direccion": "...",
         "reservar": null}
      ]
    }

Valida, completa el enlace de Google Maps y guarda data/sugerencias.json y
data/barrios.json. Guardar barrio a barrio evita perder trabajo si se corta
la sesión.

Uso:  python3 tools/sugerencias.py < barrio.json
      python3 tools/sugerencias.py --informe        (resumen de lo que hay)
"""
import json
import os
import re
import sys
from urllib.parse import quote_plus

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRECIOS = {"€", "€€", "€€€", "€€€€"}


def ruta(*p):
    return os.path.join(RAIZ, *p)


def cargar(nombre):
    with open(ruta("data", nombre), encoding="utf-8") as fh:
        return json.load(fh)


def guardar(nombre, datos):
    tmp = ruta("data", nombre + ".tmp")
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(datos, fh, ensure_ascii=False, indent=2)
    os.replace(tmp, ruta("data", nombre))


def indice_barrios():
    geo = cargar("barris.json")
    return {
        f["properties"]["codi"]: f["properties"]
        for f in geo["features"]
        if f["properties"].get("tipus") == "barri"
    }


def catalogo():
    ruta_cat = os.path.join(RAIZ, "tools", ".cache", "catalogo-osm.json")
    if not os.path.exists(ruta_cat):
        return None
    with open(ruta_cat, encoding="utf-8") as fh:
        return json.load(fh)


def normaliza(t):
    t = t.lower()
    for a, b in (("à", "a"), ("á", "a"), ("è", "e"), ("é", "e"), ("í", "i"),
                 ("ò", "o"), ("ó", "o"), ("ú", "u"), ("ü", "u"), ("ñ", "n"),
                 ("ç", "c"), ("·", " "), ("-", " ")):
        t = t.replace(a, b)
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def en_catalogo(nombre, lista):
    """¿Aparece este local en el catálogo de OSM de su barrio?"""
    objetivo = normaliza(nombre)
    palabras = set(objetivo.split())
    for l in lista:
        cand = normaliza(l["nombre"])
        if cand == objetivo or objetivo in cand or cand in objetivo:
            return l
        comunes = palabras & set(cand.split())
        largas = {p for p in comunes if len(p) > 3}
        if largas and len(largas) >= max(1, len(palabras) - 1):
            return l
    return None


def validar(s, nom_barrio, errores):
    etiqueta = f'{nom_barrio} / {s.get("nombre", "¿?")}'
    for campo in ("nombre", "cocina", "precio", "porque", "pide", "direccion"):
        if not str(s.get(campo) or "").strip():
            errores.append(f"{etiqueta}: falta «{campo}»")
    if s.get("precio") not in PRECIOS:
        errores.append(f'{etiqueta}: precio «{s.get("precio")}» no válido')
    palabras = len(re.findall(r"\S+", s.get("porque", "")))
    if not 12 <= palabras <= 20:
        errores.append(f"{etiqueta}: «porque» tiene {palabras} palabras (12-20)")
    for prohibido in ("delicioso", "increíble", "imprescindible", "espectacular"):
        if prohibido in s.get("porque", "").lower():
            errores.append(f"{etiqueta}: «porque» usa «{prohibido}»")
    if s.get("reservar") and not str(s["reservar"]).startswith("http"):
        errores.append(f"{etiqueta}: «reservar» no es una URL")
    if s.get("fuente") not in (None, "guia", "mapa"):
        errores.append(f'{etiqueta}: «fuente» debe ser "guia" o "mapa"')


def informe():
    barrios = {b["codigo"]: b for b in cargar("barrios.json")["barrios"]}
    sug = cargar("sugerencias.json")["sugerencias"]
    por_codigo = {}
    for s in sug:
        por_codigo.setdefault(s["codigo"], []).append(s)
    semilla = {r["codigoBarrio"]: r["estado"] for r in cargar("semilla.json")["registros"]}
    pendientes = []
    for codigo, b in sorted(barrios.items()):
        if semilla.get(codigo) == "hecho":
            continue
        n = len(por_codigo.get(codigo, []))
        marca = "ok " if n >= 6 else ("·· " if n else "   ")
        if n < 6:
            pendientes.append((codigo, b["nombre"], n))
        print(f'{marca}{codigo:>3}  {b["nombre"]:<46} {n}  {"frase" if b.get("frase") else "-"}')
    hechos = sum(1 for c, b in barrios.items() if semilla.get(c) != "hecho" and len(por_codigo.get(c, [])) >= 6)
    print(f"\n{hechos}/60 barrios con 6 sugerencias · {len(sug)} restaurantes en total")
    if pendientes:
        print("faltan:", ", ".join(f"{n} ({c}, {k})" for c, n, k in pendientes[:12]))


def main():
    if "--informe" in sys.argv:
        informe()
        return

    entrada = json.load(sys.stdin)
    codigo = int(entrada["codigo"])
    props = indice_barrios()[codigo]
    nom = props["nom"]

    errores = []
    cat = catalogo()
    lista_osm = (cat or {}).get(str(codigo), [])
    for s in entrada["sugerencias"]:
        validar(s, nom, errores)
        # red de seguridad: el local tiene que estar en OpenStreetMap dentro
        # de este barrio, salvo que se justifique explícitamente
        if cat is not None and not s.get("fuera_de_catalogo"):
            if not en_catalogo(s["nombre"], lista_osm):
                errores.append(
                    f'{nom} / {s["nombre"]}: no aparece en el catálogo OSM de '
                    f"este barrio. Comprueba el barrio y la dirección, o añade "
                    f'"fuera_de_catalogo": "motivo".'
                )
    frase = entrada.get("frase", "").strip()
    if not frase:
        errores.append(f"{nom}: falta la frase del barrio")
    elif len(re.findall(r"\S+", frase)) > 18:
        errores.append(f"{nom}: la frase tiene más de 18 palabras")
    if errores:
        print("\n".join(errores), file=sys.stderr)
        sys.exit(1)

    nuevas = []
    for s in entrada["sugerencias"]:
        consulta = f'{s["nombre"]} {s["direccion"]} Barcelona'
        nuevas.append(
            {
                "codigo": codigo,
                "barrio": nom,
                "nombre": s["nombre"].strip(),
                "cocina": s["cocina"].strip(),
                "precio": s["precio"],
                "porque": s["porque"].strip(),
                "pide": s["pide"].strip(),
                "direccion": s["direccion"].strip(),
                "maps": s.get("maps")
                or f"https://www.google.com/maps/search/?api=1&query={quote_plus(consulta)}",
                "reservar": s.get("reservar") or None,
                "fuente": s.get("fuente", "mapa"),
                **({"nota": s["fuera_de_catalogo"]} if s.get("fuera_de_catalogo") else {}),
            }
        )

    datos = cargar("sugerencias.json")
    datos["sugerencias"] = [s for s in datos["sugerencias"] if s["codigo"] != codigo] + nuevas
    datos["sugerencias"].sort(key=lambda s: (s["codigo"], s["nombre"]))
    guardar("sugerencias.json", datos)

    barrios = cargar("barrios.json")
    for b in barrios["barrios"]:
        if b["codigo"] == codigo:
            b["frase"] = frase
    guardar("barrios.json", barrios)

    print(f"{nom}: {len(nuevas)} sugerencias guardadas")


if __name__ == "__main__":
    main()
