# Misión Barris Barcelona

Comer o cenar en cada uno de los 73 barrios oficiales de Barcelona.

Es una web app (PWA) pensada para el iPhone: se abre en Safari, se añade a la
pantalla de inicio y a partir de ahí funciona como una aplicación más, también
sin conexión. No tiene login, ni cuentas, ni ajustes.

---

## Publicarla (dos pasos)

1. Sube el contenido de esta carpeta a la raíz de un repositorio público
   llamado `barris`.
2. En el repositorio, **Settings → Pages**, elige *Deploy from a branch*, rama
   `main`, carpeta `/ (root)` y guarda.

A los dos minutos estará en `https://<tu-usuario>.github.io/barris/`.

## Instalarla en el iPhone

Abre esa dirección en **Safari** (no sirve Chrome), toca el botón de compartir
y elige **Añadir a pantalla de inicio**. Se instala con su icono y se abre a
pantalla completa, sin barra de navegador.

La primera vez necesita conexión para descargarse. Después abre siempre, con
red o sin ella.

---

## Cómo funciona

- **Mapa**: los 73 barrios dibujados con los límites oficiales del
  Ayuntamiento. Terracota los conquistados, mostaza rayada los que están en
  plan, arena los pendientes. Pellizca para acercar, arrastra para mover, toca
  dos veces para hacer zoom. Toca un barrio para ver su ficha.
- **Contador**: arriba, `13 / 73`. Al tocarlo se despliega el desglose por
  distritos, con los enlaces de **Exportar** e **Importar**.
- **Botón +**: añadir un restaurante y asignarlo a un barrio, como hecho o
  como plan.
- **Ruleta**: elige al azar entre los barrios pendientes y enseña sus
  sugerencias.

El progreso se guarda en el propio móvil (`localStorage`). Cerrar la app, o el
Safari, no lo borra.

### Pasar el progreso de un móvil a otro, a mano

En el desglose por distritos hay dos enlaces:

- **Exportar** copia todo el progreso al portapapeles, en JSON.
- **Importar** lee el portapapeles y lo fusiona con lo que ya haya en ese
  móvil. No borra lo que el otro móvil tuviera de más: lo junta.

Es suficiente si no quieres montar la sincronización automática.

---

## Sincronización entre los dos móviles (opcional)

Desactivada por defecto. Mientras `config.js` esté vacío, la app no menciona
nada de esto y funciona solo con el almacenamiento del propio móvil.

Si la activas, lo que añada uno le aparece al otro al abrir la app o al
volver a ella desde el segundo plano.

### 1. Crear el proyecto en Supabase

Entra en [supabase.com](https://supabase.com), crea una cuenta gratuita y un
proyecto nuevo. Cualquier región europea vale.

### 2. Crear la tabla y la política de acceso

Primero decide el identificador de la misión: una cadena larga y aleatoria
que hará de «sala» compartida. En la consola de cualquier navegador,
`crypto.randomUUID()` te da una. Apúntala: va en dos sitios.

En el proyecto, ve a **SQL Editor → New query**, pega esto entero
**sustituyendo las dos veces que aparece `MISION-AQUI`** por tu identificador,
y pulsa *Run*:

```sql
-- Tabla única con el estado de la misión.
create table if not exists public.registros (
  mision          text        not null,
  codigo_barrio   smallint    not null check (codigo_barrio between 1 and 73),
  restaurante     text        not null default '',
  estado          text        not null check (estado in ('hecho','plan','borrado')),
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  primary key (mision, codigo_barrio)
);

alter table public.registros enable row level security;

-- Sin login: se usa la clave anon, y la política deja leer y escribir
-- únicamente las filas de esta misión. No hay política de DELETE, así que
-- las filas no se pueden borrar: la app marca los borrados con estado
-- 'borrado' para que el borrado llegue también al otro móvil.
drop policy if exists registros_lectura on public.registros;
create policy registros_lectura
  on public.registros for select to anon
  using (mision = 'MISION-AQUI');

drop policy if exists registros_alta on public.registros;
create policy registros_alta
  on public.registros for insert to anon
  with check (mision = 'MISION-AQUI');

drop policy if exists registros_cambio on public.registros;
create policy registros_cambio
  on public.registros for update to anon
  using (mision = 'MISION-AQUI')
  with check (mision = 'MISION-AQUI');
```

### 3. Pegar las claves en `config.js`

En Supabase, **Project Settings → API**. Copia *Project URL* y la clave
*anon public*. Abre `config.js` y rellena las tres constantes:

```js
export const SUPABASE_URL = "https://xxxxxxxxxxxx.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOi...";
export const MISION = "pega-aquí-un-identificador-largo-y-aleatorio";
```

`MISION` tiene que ser **exactamente el mismo identificador** que pusiste en
el SQL, y el mismo en los dos móviles. Si no coinciden, las políticas de
arriba rechazan todo y la sincronización no hace nada (en silencio, como está
previsto).

Sube el cambio, y en cada iPhone borra la app de la pantalla de inicio y
vuelve a añadirla, para que se recoja el `config.js` nuevo.

### Qué hace y qué no

- Al abrir la app y al volver del segundo plano se leen las filas remotas y se
  fusionan con las locales: de cada barrio gana el registro modificado más
  recientemente.
- Al guardar, editar o borrar se escribe en remoto. Si falla por falta de red,
  se guarda en una cola y se reintenta en la siguiente ocasión.
- Borrar un registro no lo elimina de la tabla: lo marca como `borrado`. Hace
  falta para que el borrado llegue al otro móvil en lugar de resucitar.
- No hay indicadores de carga. Si algo falla, se ve en la consola y nada más.

**El riesgo asumido**: quien tenga la URL, la clave anon y el identificador de
la misión puede leer y escribir. Para dos personas y una lista de restaurantes
es un riesgo aceptable; no pongas ahí nada que no quieras que se vea.

---

## Estructura

```
index.html          una sola pantalla, dos pestañas
config.js           claves de Supabase (vacías por defecto)
manifest.json       PWA
sw.js               service worker: cachea todo para abrir sin conexión
css/app.css         toda la hoja de estilo
js/
  main.js           arranque y conexión de las piezas
  mapa.js           SVG, proyección, zoom, etiquetas, animación de conquista
  datos.js          carga de los JSON
  estado.js         el estado de la misión y su persistencia
  fichas.js         las tres fichas de barrio y la edición
  anadir.js         la hoja del botón +
  ruleta.js         el tablero de nombres
  sync.js           capa opcional de Supabase
  ui.js             hoja inferior, plegables y utilidades
  d3.min.js         d3-geo + d3-zoom, compilados en local
data/
  barris.json       los 73 polígonos + el mar, ya simplificados
  barrios.json      nombre, distrito y frase de carácter de cada barrio
  sugerencias.json  los restaurantes sugeridos
  semilla.json      los 15 registros de partida
  INFORME-SUGERENCIAS.md
fonts/              Jost, servida en local
icons/              iconos de la app, generados desde la silueta de la ciudad
tools/              scripts de construcción (no se suben al móvil)
```

No hay dependencias en tiempo de ejecución: todo lo que necesita el navegador
está en esta carpeta.

---

## Rehacer los datos del mapa

Sólo hace falta si el Ayuntamiento publica límites nuevos.

```bash
bash tools/build-map.sh     # descarga, reproyecta, simplifica y ensambla
python3 tools/icons.py      # redibuja los iconos desde la silueta
```

Necesita `node` (para `npx mapshaper`) y `python3`. El GeoJSON de origen es el
dataset *Unitats administratives de la ciutat de Barcelona* de Open Data BCN.

### Revisar las sugerencias

```bash
python3 tools/sugerencias.py --informe        # cuántas hay por barrio
python3 tools/catalogo.py --barrio 65         # qué locales hay en un barrio
python3 tools/catalogo.py --buscar "nombre"   # en qué barrio cae un local
```

El catálogo sale de OpenStreetMap (se guarda en `tools/.cache/`) y se reconstruye con
`python3 tools/catalogo.py <carpeta_con_los_json_de_overpass>`.

---

## Para probar en el ordenador

```bash
node tools/servidor.js 8777
```

Y abre `http://localhost:8777`. En el navegador de escritorio el mapa responde
al ratón; los gestos de pellizco sólo se pueden probar en el móvil.
