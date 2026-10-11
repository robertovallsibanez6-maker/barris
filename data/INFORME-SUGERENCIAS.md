# Informe de sugerencias

Qué hay en `data/sugerencias.json`, de dónde sale y qué no he podido
verificar. Generado con `python3 tools/informe.py`.

## Cómo se ha hecho

1. **Qué locales existen y dónde.** Descargué de OpenStreetMap, vía Overpass,
   todos los locales con nombre de Barcelona etiquetados como `restaurant`,
   `bar`, `cafe` o `fast_food` (6.477 en total) y los repartí entre los 73
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

- **guía** (45 restaurantes): aparece recomendado en una guía o medio
  publicado, que es además de donde salen los datos concretos (plato estrella,
  historia, horario).
- **mapa** (263 restaurantes): existe y está donde digo —eso está
  verificado—, pero no he encontrado ninguna crítica publicada. La descripción
  se limita entonces al tipo de local, la calle y lo que hace; no afirma nada
  sobre su cocina que no pueda sostener. **Son los que más conviene que mires
  tú** antes de enseñárselo a Carla.


## Resumen

- Barrios investigados: **60** de 73 (los 13 ya
  conquistados no llevan sugerencias).
- Restaurantes en total: **308**.
- Barrios con las 6 sugerencias: **39**.
- Barrios con menos de 6: **21** (ver más abajo el motivo de cada uno).
- Reparto de precios: € 96, €€ 170, €€€ 37, €€€€ 5.
- Con enlace de reserva o web propia: **83**.

## Sugerencias por barrio

| # | Barrio | Nº | guía / mapa |
|---|---|---|---|
| 1 | el Raval | 6 | 6 / 0 |
| 2 | el Barri Gòtic | 6 | 6 / 0 |
| 5 | el Fort Pienc | 6 | 2 / 4 |
| 9 | la Nova Esquerra de l'Eixample | 6 | 4 / 2 |
| 12 | la Marina del Prat Vermell (corto) | 4 | 0 / 4 |
| 13 | la Marina de Port | 6 | 1 / 5 |
| 14 | la Font de la Guatlla (corto) | 5 | 0 / 5 |
| 15 | Hostafrancs | 6 | 3 / 3 |
| 16 | la Bordeta | 6 | 0 / 6 |
| 17 | Sants - Badal | 6 | 0 / 6 |
| 18 | Sants | 6 | 3 / 3 |
| 19 | les Corts | 6 | 3 / 3 |
| 22 | Vallvidrera, el Tibidabo i les Planes (corto) | 5 | 0 / 5 |
| 24 | les Tres Torres | 6 | 0 / 6 |
| 27 | el Putxet i el Farró | 6 | 0 / 6 |
| 28 | Vallcarca i els Penitents | 6 | 0 / 6 |
| 29 | el Coll (corto) | 4 | 1 / 3 |
| 30 | la Salut | 6 | 0 / 6 |
| 32 | el Camp d'en Grassot i Gràcia Nova | 6 | 0 / 6 |
| 33 | el Baix Guinardó | 6 | 0 / 6 |
| 34 | Can Baró (corto) | 4 | 0 / 4 |
| 35 | el Guinardó | 6 | 0 / 6 |
| 36 | la Font d'en Fargues (corto) | 5 | 0 / 5 |
| 37 | el Carmel | 6 | 0 / 6 |
| 38 | la Teixonera | 6 | 0 / 6 |
| 39 | Sant Genís dels Agudells (corto) | 3 | 0 / 3 |
| 40 | Montbau (corto) | 4 | 0 / 4 |
| 41 | la Vall d'Hebron (corto) | 4 | 1 / 3 |
| 42 | la Clota (corto) | 2 | 2 / 0 |
| 43 | Horta | 6 | 2 / 4 |
| 44 | Vilapicina i la Torre Llobeta | 6 | 1 / 5 |
| 45 | Porta | 6 | 0 / 6 |
| 46 | el Turó de la Peira (corto) | 4 | 1 / 3 |
| 47 | Can Peguera (corto) | 3 | 0 / 3 |
| 48 | la Guineueta | 6 | 0 / 6 |
| 49 | Canyelles (corto) | 2 | 1 / 1 |
| 50 | les Roquetes (corto) | 3 | 0 / 3 |
| 51 | Verdun (corto) | 4 | 0 / 4 |
| 52 | la Prosperitat | 6 | 1 / 5 |
| 53 | la Trinitat Nova (corto) | 3 | 0 / 3 |
| 54 | Torre Baró (corto) | 2 | 0 / 2 |
| 55 | Ciutat Meridiana (corto) | 3 | 3 / 0 |
| 56 | Vallbona (corto) | 2 | 0 / 2 |
| 57 | la Trinitat Vella (corto) | 3 | 0 / 3 |
| 58 | Baró de Viver (corto) | 5 | 0 / 5 |
| 59 | el Bon Pastor | 6 | 0 / 6 |
| 60 | Sant Andreu | 6 | 1 / 5 |
| 61 | la Sagrera | 6 | 0 / 6 |
| 62 | el Congrés i els Indians | 6 | 0 / 6 |
| 63 | Navas | 6 | 0 / 6 |
| 64 | el Camp de l'Arpa del Clot | 6 | 0 / 6 |
| 65 | el Clot | 6 | 1 / 5 |
| 66 | el Parc i la Llacuna del Poblenou | 6 | 0 / 6 |
| 67 | la Vila Olímpica del Poblenou | 6 | 0 / 6 |
| 68 | el Poblenou | 6 | 2 / 4 |
| 69 | Diagonal Mar i el Front Marítim del Poblenou | 6 | 0 / 6 |
| 70 | el Besòs i el Maresme | 6 | 0 / 6 |
| 71 | Provençals del Poblenou | 6 | 0 / 6 |
| 72 | Sant Martí de Provençals | 6 | 0 / 6 |
| 73 | la Verneda i la Pau | 6 | 0 / 6 |

## Barrios con menos de 6 sugerencias, y por qué

En todos estos casos la oferta real del barrio es la que es. Antes de
recortar comprobé el catálogo completo de OpenStreetMap del barrio y
busqué en guías y directorios locales; lo que aparece aquí es todo lo
que he podido confirmar que existe y está dentro.

**la Marina del Prat Vermell** (4 sugerencias) — Polígono industrial y zona portuaria. Casi todo lo que hay son comedores de mediodía para trabajadores; de noche no hay nada. Descarté los bares del interior de Mercabarna porque el recinto es de acceso profesional.

**la Font de la Guatlla** (5 sugerencias) — Barrio muy pequeño de casas bajas. Cinco locales reales y ninguno de gama alta.

**Vallvidrera, el Tibidabo i les Planes** (5 sugerencias) — Vallvidrera y les Planes son bosque y casas dispersas: cinco restaurantes en todo el barrio. Descarté la Masia del Tibidabo por estar dentro del parque de atracciones.

**el Coll** (4 sugerencias) — Cuatro locales en todo el barrio, uno de ellos (Agreste) excelente.

**Can Baró** (4 sugerencias) — Seis locales en todo el barrio, dos de ellos cafeterías.

**la Font d'en Fargues** (5 sugerencias) — Barrio residencial de torres: ocho locales, casi todos bares y cafeterías.

**Sant Genís dels Agudells** (3 sugerencias) — Tres locales en todo el barrio, los tres bares o panadería con barra.

**Montbau** (4 sugerencias) — Cuatro locales en todo el barrio.

**la Vall d'Hebron** (4 sugerencias) — Hospital y campus. Cinco locales, dos de ellos masías históricas.

**la Clota** (2 sugerencias) — **Cero locales de restauración.** 709 habitantes y 0,2 km². Las dos sugerencias están en barrios vecinos, a pocos minutos a pie, y así se indica.

**el Turó de la Peira** (4 sugerencias) — Cinco locales, entre ellos La Esquinica, que compensa de sobra.

**Can Peguera** (3 sugerencias) — **Cero locales de restauración.** Las tres sugerencias están en los barrios colindantes, entre 77 y 148 metros del límite, y así se indica.

**Canyelles** (2 sugerencias) — Dos locales en todo el barrio.

**les Roquetes** (3 sugerencias) — Un solo local mapeado. Añado dos del borde, a 28 y 100 metros.

**Verdun** (4 sugerencias) — Cuatro locales con nombre, aparte de kebabs y pizzerías para llevar.

**la Trinitat Nova** (3 sugerencias) — **Cero locales de restauración en OpenStreetMap.** Las tres sugerencias están en los barrios vecinos, entre 51 y 212 metros del límite.

**Torre Baró** (2 sugerencias) — Dos locales en todo el barrio.

**Ciutat Meridiana** (3 sugerencias) — No hay ni un local del barrio en OpenStreetMap. Los tres que doy salen de un directorio local; comprobé que la calle de las Agudes cae dentro del barrio.

**Vallbona** (2 sugerencias) — **Cero locales de restauración.** Mil vecinos. Las dos sugerencias están en Torre Baró, a 146 y 760 metros.

**la Trinitat Vella** (3 sugerencias) — **Cero locales de restauración en OpenStreetMap.** Las tres sugerencias están en Baró de Viver, entre 87 y 145 metros del límite.

**Baró de Viver** (5 sugerencias) — Cinco locales en todo el barrio, todos bares.


## Locales aceptados fuera del polígono o fuera del catálogo

El encargo sólo permite un local del límite en los barrios con poca
oferta, y pide marcarlo. Todos los de abajo lo llevan escrito en la
propia frase de «por qué», así que se ve dentro de la app.

| Barrio | Local | Motivo |
|---|---|---|
| el Barri Gòtic | Bar la Plata | No está en OpenStreetMap; dirección y horarios confirmados en su web oficial barlaplata.com |
| Hostafrancs | Bar del Mercat d'Hostafrancs | Barra interior del mercado, no figura como local propio en OpenStreetMap; dirección y horarios según Time Out Barcelona |
| la Clota | Can Cortada | Está en el barrio vecino de Horta, justo en el límite: la Clota no tiene ningún local de restauración |
| la Clota | Can Travi Nou | Está en el barrio vecino de la Vall d'Hebron, justo en el límite: la Clota no tiene ningún local |
| Can Peguera | Mi Bar Juan | A 148 m del borde, en Horta: Can Peguera no tiene ningún local de restauración |
| Can Peguera | Pizza CityBcn | A 122 m del borde, en la Guineueta: Can Peguera no tiene ningún local de restauración |
| Can Peguera | Polleria Margarita | A 77 m del borde, en Horta: Can Peguera no tiene ningún local de restauración |
| les Roquetes | El Mirador de Barcelona | A 28 m del borde, en Torre Baró: les Roquetes apenas tiene locales de restauración |
| les Roquetes | El Pollo a l'Ast | A 100 m del borde, en Verdun: les Roquetes apenas tiene locales de restauración |
| la Trinitat Nova | Bar Gisela | A 51 m del borde, en la Prosperitat: la Trinitat Nova no tiene locales en OpenStreetMap |
| la Trinitat Nova | El Mirador de Barcelona | A 212 m del borde, en Torre Baró: la Trinitat Nova no tiene locales en OpenStreetMap |
| la Trinitat Nova | L'Hostalet | A 182 m del borde, en la Prosperitat: la Trinitat Nova no tiene locales en OpenStreetMap |
| Ciutat Meridiana | Bar Restaurante Casa Juan | No figura en OpenStreetMap; dirección tomada de un directorio local y comprobada: la calle está dentro del barrio |
| Ciutat Meridiana | Bar Restaurante Idrovo | No figura en OpenStreetMap; dirección tomada de un directorio local y comprobada: la calle está dentro del barrio |
| Ciutat Meridiana | Can Birra | No figura en OpenStreetMap; dirección tomada de un directorio local y comprobada: la calle está dentro del barrio |
| Vallbona | Cuïlla al Punt | A 146 m del borde, en Torre Baró: Vallbona no tiene ningún local de restauración |
| Vallbona | El Mirador de Barcelona | A 760 m, en Torre Baró: Vallbona no tiene ningún local de restauración |
| la Trinitat Vella | Cerveseria Jordi | A 94 m del borde, en Baró de Viver: la Trinitat Vella no tiene locales en OpenStreetMap |
| la Trinitat Vella | Els Jardins | A 87 m del borde, en Baró de Viver: la Trinitat Vella no tiene locales en OpenStreetMap |
| la Trinitat Vella | Gavisé | A 145 m del borde, en Baró de Viver: la Trinitat Vella no tiene locales en OpenStreetMap |

## Lo que NO he podido verificar

Dicho sin adornos, para que sepas dónde mirar:

- **Que sigan abiertos hoy.** Verifiqué uno por uno los 45
  locales con fuente «guía», y ahí hubo bajas reales: **Casa Leopoldo**
  (el Raval) cerró en junio de 2026 y **Bodega Monumental**
  (Hostafrancs) figura como cerrada en Time Out; los dos estaban en mi
  lista inicial y los quité. De los de fuente «mapa» sé que existían en
  OpenStreetMap el 11 de octubre de 2026, que es cuando descargué los
  datos, pero no he comprobado uno a uno los 263.
- **El plato de «Pide».** Donde la fuente es una guía, el plato sale de
  ella. En el resto es una recomendación razonada por el tipo de casa
  (un gallego, una brasería, una granja), no una carta transcrita. Si
  algún día no lo tienen, no pasa nada; pero no lo he podido confirmar.
- **El número de la calle.** Está cuando OpenStreetMap lo trae o cuando
  la guía lo da. Cuando no, dejé sólo el nombre de la calle en vez de
  inventármelo. El enlace de «Cómo llegar» busca por nombre + calle +
  Barcelona, así que resuelve igual.
- **El tramo de precio** es una estimación por el tipo de local, salvo
  donde la fuente daba un precio medio.
- **Que no haya ninguna cadena.** Descarté a propósito las que detecté
  (Foster's, Ginos, Udon, Goiko, La Tagliatella, Viena, Pura Brasa,
  Honest Greens, Lizarran, Domino's y similares, sobre todo en el Bon
  Pastor y Diagonal Mar, donde el centro comercial manda) y también
  algunos grupos locales con varios locales (La Paradeta, Ikibana,
  Grup Xàtiva). La frontera entre «grupo local» y «cadena» es
  discutible: si alguno te chirría, dímelo y lo cambio.


## Qué te pido que revises

Si sólo vas a mirar una cosa, mira los barrios marcados «(corto)» y una
docena de locales con fuente «mapa» al azar en Google Maps. Es donde
es más fácil que se haya colado algo cerrado o traspasado.

