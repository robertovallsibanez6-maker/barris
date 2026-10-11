// Carga de los archivos de datos y pequeño índice de barrios.

async function json(ruta) {
  const r = await fetch(ruta, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${ruta}: ${r.status}`);
  return r.json();
}

export const datos = {
  /** @type {object[]} 73 features de barri, en orden de código */
  barris: [],
  /** @type {object} feature del mar */
  mar: null,
  /** @type {Map<number, object>} */
  porCodi: new Map(),
  /** @type {Map<string, number>} nombre oficial -> código */
  porNombre: new Map(),
  /** @type {{codi:number,nom:string,barris:object[]}[]} 10 distritos */
  distritos: [],
  /** @type {Map<number, string>} frase de carácter de cada barrio */
  frases: new Map(),
  /** @type {Map<number, object[]>} sugerencias por código de barrio */
  sugerencias: new Map(),
  /** @type {object[]} */
  semilla: [],
};

export async function cargarDatos() {
  const [geo, barrios, sugerencias, semilla] = await Promise.all([
    json("data/barris.json"),
    json("data/barrios.json"),
    json("data/sugerencias.json"),
    json("data/semilla.json"),
  ]);

  for (const f of geo.features) {
    if (f.properties.tipus === "mar") {
      datos.mar = f;
      continue;
    }
    datos.barris.push(f);
    datos.porCodi.set(f.properties.codi, f);
    datos.porNombre.set(f.properties.nom, f.properties.codi);
  }
  datos.barris.sort((a, b) => a.properties.codi - b.properties.codi);

  const porDistrito = new Map();
  for (const f of datos.barris) {
    const { districte, districte_nom } = f.properties;
    if (!porDistrito.has(districte)) {
      porDistrito.set(districte, { codi: districte, nom: districte_nom, barris: [] });
    }
    porDistrito.get(districte).barris.push(f);
  }
  datos.distritos = [...porDistrito.values()].sort((a, b) => a.codi - b.codi);

  for (const b of barrios.barrios ?? barrios) {
    if (b.frase) datos.frases.set(Number(b.codigo), b.frase);
  }

  for (const s of sugerencias.sugerencias ?? sugerencias) {
    const codi = Number(s.codigo ?? datos.porNombre.get(s.barrio));
    if (!codi) {
      console.warn("sugerencia sin barrio reconocible", s);
      continue;
    }
    if (!datos.sugerencias.has(codi)) datos.sugerencias.set(codi, []);
    datos.sugerencias.get(codi).push(s);
  }

  // dentro de cada barrio, de lo más barato a lo más caro: así la variedad
  // de precios se ve de un vistazo al abrir la ficha
  for (const lista of datos.sugerencias.values()) {
    lista.sort(
      (a, b) =>
        (a.precio ?? "").length - (b.precio ?? "").length ||
        a.nombre.localeCompare(b.nombre, "es")
    );
  }

  datos.semilla = semilla.registros ?? semilla;
  return datos;
}

export function nombre(codi) {
  return datos.porCodi.get(Number(codi))?.properties.nom ?? "";
}

export function distritoDe(codi) {
  return datos.porCodi.get(Number(codi))?.properties.districte_nom ?? "";
}

export function sugerenciasDe(codi) {
  return datos.sugerencias.get(Number(codi)) ?? [];
}

export function fraseDe(codi) {
  return datos.frases.get(Number(codi)) ?? "";
}
