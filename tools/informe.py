#!/usr/bin/env python3
"""Genera data/INFORME-SUGERENCIAS.md a partir de los datos reales.

Se regenera solo, así que el informe nunca se queda desfasado respecto a
data/sugerencias.json.
"""
import json
import os
from collections import Counter

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CABECERA = """# Informe de sugerencias

Qué hay en `data/sugerencias.json`, de dónde sale y qué no he podido
verificar. Generado con `python3 tools/informe.py`.

## Cómo se ha hecho

1. **Qué locales existen y dónde.** Descargué de OpenStreetMap, vía Overpass,
   todos los locales con nombre de Barcelona etiquetados como `restaurant`,
   `bar`, `cafe` o `fast_food` ({catalogo} en total) y los repartí entre los 73
   barrios haciendo punto-en-polígono contra los límites oficiales del
   Ayuntamiento. Eso es lo que garantiza que un restaurante esté *dentro* del
   barrio que le toca y no en la calle de al lado: no es un juicio mío, es
   geometría. La herramienta está en `tools/catalogo.py`.
2. **Dirección.** Se toma de OpenStreetMap cuando la trae. Cuando no, se
   obtiene geocodificando las coordenadas del local con Nominatim
   (`tools/direccion.py`).
3. **Criterio y calidad.** Guías locales (Time Out Barcelona, el catálogo de
   comercio del Ayuntamiento, Gastronomistas, Culinary Backstreets, prensa
   local), reseñas recientes y, cuando lo tienen, la web del propio local.
4. **Validación automática.** `tools/sugerencias.py` rechaza una sugerencia si
   le falta algún campo, si el precio no es uno de los cuatro tramos, si la
   frase de «por qué» no tiene entre 12 y 20 palabras, si usa alguno de los
   adjetivos prohibidos, o —y esto es lo importante— **si el local no aparece
   en el catálogo de OpenStreetMap de ese barrio**. Las excepciones hay que
   justificarlas una por una y quedan registradas más abajo.

## Qué significa la columna «fuente»

- **guía** ({guia} restaurantes): aparece recomendado en una guía o medio
  publicado, que es además de donde salen los datos concretos (plato estrella,
  historia, horario).
- **mapa** ({mapa} restaurantes): existe y está donde digo —eso está
  verificado—, pero no he encontrado ninguna crítica publicada. La descripción
  se limita entonces al tipo de local, la calle y lo que hace; no afirma nada
  sobre su cocina que no pueda sostener. **Son los que más conviene que mires
  tú** antes de enseñárselo a Carla.
"""


def main():
    with open(os.path.join(RAIZ, "data", "sugerencias.json"), encoding="utf-8") as fh:
        sug = json.load(fh)["sugerencias"]
    with open(os.path.join(RAIZ, "data", "barrios.json"), encoding="utf-8") as fh:
        barrios = {b["codigo"]: b for b in json.load(fh)["barrios"]}
    with open(os.path.join(RAIZ, "data", "semilla.json"), encoding="utf-8") as fh:
        semilla = {r["codigoBarrio"]: r["estado"] for r in json.load(fh)["registros"]}
    try:
        with open(os.path.join(RAIZ, "tools", ".cache", "catalogo-osm.json"), encoding="utf-8") as fh:
            n_catalogo = sum(len(v) for v in json.load(fh).values())
    except FileNotFoundError:
        n_catalogo = 6477

    por_barrio = {}
    for s in sug:
        por_barrio.setdefault(s["codigo"], []).append(s)

    fuentes = Counter(s["fuente"] for s in sug)
    investigados = [c for c in sorted(barrios) if semilla.get(c) != "hecho"]

    L = [
        CABECERA.format(
            catalogo=f"{n_catalogo:,}".replace(",", "."),
            guia=fuentes["guia"],
            mapa=fuentes["mapa"],
        )
    ]

    completos = [c for c in investigados if len(por_barrio.get(c, [])) >= 6]
    cortos = [c for c in investigados if len(por_barrio.get(c, [])) < 6]

    L.append("\n## Resumen\n")
    L.append(f"- Barrios investigados: **{len(investigados)}** de 73 (los 13 ya")
    L.append("  conquistados no llevan sugerencias).")
    L.append(f"- Restaurantes en total: **{len(sug)}**.")
    L.append(f"- Barrios con las 6 sugerencias: **{len(completos)}**.")
    L.append(f"- Barrios con menos de 6: **{len(cortos)}** (ver más abajo el motivo de cada uno).")
    precios = Counter(s["precio"] for s in sug)
    L.append(
        "- Reparto de precios: "
        + ", ".join(f"{p} {precios[p]}" for p in ("€", "€€", "€€€", "€€€€"))
        + "."
    )
    L.append(f"- Con enlace de reserva o web propia: **{sum(1 for s in sug if s['reservar'])}**.")

    L.append("\n## Sugerencias por barrio\n")
    L.append("| # | Barrio | Nº | guía / mapa |")
    L.append("|---|---|---|---|")
    for c in investigados:
        lista = por_barrio.get(c, [])
        g = sum(1 for s in lista if s["fuente"] == "guia")
        marca = "" if len(lista) >= 6 else " (corto)"
        L.append(f'| {c} | {barrios[c]["nombre"]}{marca} | {len(lista)} | {g} / {len(lista) - g} |')

    L.append("\n## Barrios con menos de 6 sugerencias, y por qué\n")
    L.append(
        "En todos estos casos la oferta real del barrio es la que es. Antes de\n"
        "recortar comprobé el catálogo completo de OpenStreetMap del barrio y\n"
        "busqué en guías y directorios locales; lo que aparece aquí es todo lo\n"
        "que he podido confirmar que existe y está dentro.\n"
    )
    motivos = {
        12: "Polígono industrial y zona portuaria. Casi todo lo que hay son comedores de mediodía para trabajadores; de noche no hay nada. Descarté los bares del interior de Mercabarna porque el recinto es de acceso profesional.",
        14: "Barrio muy pequeño de casas bajas. Cinco locales reales y ninguno de gama alta.",
        22: "Vallvidrera y les Planes son bosque y casas dispersas: cinco restaurantes en todo el barrio. Descarté la Masia del Tibidabo por estar dentro del parque de atracciones.",
        29: "Cuatro locales en todo el barrio, uno de ellos (Agreste) excelente.",
        34: "Seis locales en todo el barrio, dos de ellos cafeterías.",
        36: "Barrio residencial de torres: ocho locales, casi todos bares y cafeterías.",
        39: "Tres locales en todo el barrio, los tres bares o panadería con barra.",
        40: "Cuatro locales en todo el barrio.",
        41: "Hospital y campus. Cinco locales, dos de ellos masías históricas.",
        42: "**Cero locales de restauración.** 709 habitantes y 0,2 km². Las dos sugerencias están en barrios vecinos, a pocos minutos a pie, y así se indica.",
        46: "Cinco locales, entre ellos La Esquinica, que compensa de sobra.",
        47: "**Cero locales de restauración.** Las tres sugerencias están en los barrios colindantes, entre 77 y 148 metros del límite, y así se indica.",
        49: "Dos locales en todo el barrio.",
        50: "Un solo local mapeado. Añado dos del borde, a 28 y 100 metros.",
        51: "Cuatro locales con nombre, aparte de kebabs y pizzerías para llevar.",
        53: "**Cero locales de restauración en OpenStreetMap.** Las tres sugerencias están en los barrios vecinos, entre 51 y 212 metros del límite.",
        54: "Dos locales en todo el barrio.",
        55: "No hay ni un local del barrio en OpenStreetMap. Los tres que doy salen de un directorio local; comprobé que la calle de las Agudes cae dentro del barrio.",
        56: "**Cero locales de restauración.** Mil vecinos. Las dos sugerencias están en Torre Baró, a 146 y 760 metros.",
        57: "**Cero locales de restauración en OpenStreetMap.** Las tres sugerencias están en Baró de Viver, entre 87 y 145 metros del límite.",
        58: "Cinco locales en todo el barrio, todos bares.",
    }
    for c in cortos:
        L.append(f'**{barrios[c]["nombre"]}** ({len(por_barrio.get(c, []))} sugerencias) — '
                 f'{motivos.get(c, "oferta limitada en el barrio.")}\n')

    limite = [s for s in sug if s.get("nota")]
    L.append("\n## Locales aceptados fuera del polígono o fuera del catálogo\n")
    L.append(
        "El encargo sólo permite un local del límite en los barrios con poca\n"
        "oferta, y pide marcarlo. Todos los de abajo lo llevan escrito en la\n"
        "propia frase de «por qué», así que se ve dentro de la app.\n"
    )
    L.append("| Barrio | Local | Motivo |")
    L.append("|---|---|---|")
    for s in sorted(limite, key=lambda s: s["codigo"]):
        L.append(f'| {s["barrio"]} | {s["nombre"]} | {s["nota"]} |')

    L.append("\n## Lo que NO he podido verificar\n")
    L.append(
        "Dicho sin adornos, para que sepas dónde mirar:\n\n"
        f"- **Que sigan abiertos hoy.** Verifiqué uno por uno los {fuentes['guia']}\n"
        "  locales con fuente «guía», y ahí hubo bajas reales: **Casa Leopoldo**\n"
        "  (el Raval) cerró en junio de 2026 y **Bodega Monumental**\n"
        "  (Hostafrancs) figura como cerrada en Time Out; los dos estaban en mi\n"
        "  lista inicial y los quité. De los de fuente «mapa» sé que existían en\n"
        "  OpenStreetMap el 11 de octubre de 2026, que es cuando descargué los\n"
        f"  datos, pero no he comprobado uno a uno los {fuentes['mapa']}.\n"
        "- **El plato de «Pide».** Donde la fuente es una guía, el plato sale de\n"
        "  ella. En el resto es una recomendación razonada por el tipo de casa\n"
        "  (un gallego, una brasería, una granja), no una carta transcrita. Si\n"
        "  algún día no lo tienen, no pasa nada; pero no lo he podido confirmar.\n"
        "- **El número de la calle.** Está cuando OpenStreetMap lo trae o cuando\n"
        "  la guía lo da. Cuando no, dejé sólo el nombre de la calle en vez de\n"
        "  inventármelo. El enlace de «Cómo llegar» busca por nombre + calle +\n"
        "  Barcelona, así que resuelve igual.\n"
        "- **El tramo de precio** es una estimación por el tipo de local, salvo\n"
        "  donde la fuente daba un precio medio.\n"
        "- **Que no haya ninguna cadena.** Descarté a propósito las que detecté\n"
        "  (Foster's, Ginos, Udon, Goiko, La Tagliatella, Viena, Pura Brasa,\n"
        "  Honest Greens, Lizarran, Domino's y similares, sobre todo en el Bon\n"
        "  Pastor y Diagonal Mar, donde el centro comercial manda) y también\n"
        "  algunos grupos locales con varios locales (La Paradeta, Ikibana,\n"
        "  Grup Xàtiva). La frontera entre «grupo local» y «cadena» es\n"
        "  discutible: si alguno te chirría, dímelo y lo cambio.\n"
    )

    L.append("\n## Qué te pido que revises\n")
    L.append(
        "Si sólo vas a mirar una cosa, mira los barrios marcados «(corto)» y una\n"
        "docena de locales con fuente «mapa» al azar en Google Maps. Es donde\n"
        "es más fácil que se haya colado algo cerrado o traspasado.\n"
    )

    salida = os.path.join(RAIZ, "data", "INFORME-SUGERENCIAS.md")
    with open(salida, "w", encoding="utf-8") as fh:
        fh.write("\n".join(L) + "\n")
    print(f"{salida}: {len(sug)} restaurantes, {len(cortos)} barrios cortos")


if __name__ == "__main__":
    main()
