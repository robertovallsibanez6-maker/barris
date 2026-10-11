#!/bin/bash
# Reconstruye data/barris.json desde el GeoJSON oficial de Open Data BCN.
#
#   bash tools/build-map.sh
#
# Requiere node (para npx mapshaper) y python3. Descarga el dataset
# «Unitats administratives de la ciutat de Barcelona» y deja el resultado
# simplificado en data/barris.json.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

URL="https://opendata-ajuntament.barcelona.cat/data/dataset/808daafa-d9ce-48c0-925a-fa5afdb1ed41/resource/cd800462-f326-429f-a67a-c69b7fc4c50a/download"
SIMPLIFY="${SIMPLIFY:-25%}"

echo "1/5  descargando Unitats_Administratives_BCN.geojson"
curl -sfL --max-time 300 "$URL" -o "$WORK/ua.zip"
unzip -oq "$WORK/ua.zip" -d "$WORK/ua"

echo "2/5  extrayendo los 73 barris y reproyectando EPSG:25831 -> WGS84"
python3 "$ROOT/tools/build-geo.py" \
  "$WORK/ua/0301100100_UNITATS_ADM_POLIGONS.json" "$WORK/barris.geojson"

echo "3/5  simplificando a $SIMPLIFY"
npx -y mapshaper@0.6.102 "$WORK/barris.geojson" \
  -simplify weighted "$SIMPLIFY" keep-shapes -clean \
  -o precision=0.00001 format=geojson "$WORK/simpl.geojson" >/dev/null

echo "4/5  construyendo el polígono del mar desde la costa real"
npx -y mapshaper@0.6.102 "$WORK/simpl.geojson" \
  -dissolve2 -o format=geojson "$WORK/ciutat.geojson" >/dev/null
python3 "$ROOT/tools/sea.py" "$WORK/ciutat.geojson" "$WORK/mar.geojson"

echo "5/6  silueta para los iconos"
npx -y mapshaper@0.6.102 "$WORK/ciutat.geojson" \
  -filter-islands min-area=3000000m2 remove-empty \
  -simplify weighted 9% keep-shapes -clean -filter-slivers min-area=200000m2 \
  -o precision=0.00001 format=geojson "$ROOT/icons/silueta.json" >/dev/null

echo "6/6  calculando polos de inaccesibilidad y ensamblando"
python3 "$ROOT/tools/finish-geo.py" \
  "$WORK/simpl.geojson" "$WORK/mar.geojson" "$ROOT/data/barris.json"

echo "data/barris.json: $(( $(wc -c < "$ROOT/data/barris.json") / 1024 )) KB"
