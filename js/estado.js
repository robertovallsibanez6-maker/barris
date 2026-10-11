// Estado de la misión: qué barrio está conquistado, en plan o pendiente.
//
// Un registro es  { codigoBarrio, restaurante, estado, creadoEn, actualizadoEn }
// con estado = "hecho" | "plan" | "borrado".
//
// «borrado» es una lápida: hace falta para que, con la sincronización activa,
// borrar un registro en un móvil no reviva al leer el otro. En la interfaz no
// se ve nunca.

const CLAVE = "barris.registros.v1";

/** @type {Map<number, object>} indexado por codigoBarrio */
const registros = new Map();
const oyentes = new Set();
let escribirRemoto = null;

export const TOTAL_BARRIS = 73;

/* ───────────────────────────── persistencia ──────────────────────────── */

function leerLocal() {
  try {
    const bruto = localStorage.getItem(CLAVE);
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

function escribirLocal() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify([...registros.values()]));
  } catch (e) {
    console.warn("no se ha podido guardar en localStorage", e);
  }
}

function normalizar(r) {
  const codigoBarrio = Number(r.codigoBarrio ?? r.codi ?? r.barri);
  if (!Number.isInteger(codigoBarrio) || codigoBarrio < 1 || codigoBarrio > TOTAL_BARRIS) {
    return null;
  }
  const estado = r.estado === "plan" || r.estado === "borrado" ? r.estado : "hecho";
  const creadoEn = typeof r.creadoEn === "string" ? r.creadoEn : new Date().toISOString();
  return {
    codigoBarrio,
    restaurante: String(r.restaurante ?? "").trim(),
    estado,
    creadoEn,
    actualizadoEn: typeof r.actualizadoEn === "string" ? r.actualizadoEn : creadoEn,
  };
}

/** Gana el registro con `actualizadoEn` más reciente. */
function fusionar(entrantes) {
  let cambios = 0;
  for (const bruto of entrantes) {
    const r = normalizar(bruto);
    if (!r) continue;
    const actual = registros.get(r.codigoBarrio);
    if (!actual || r.actualizadoEn > actual.actualizadoEn) {
      registros.set(r.codigoBarrio, r);
      cambios++;
    }
  }
  return cambios;
}

/* ─────────────────────────────── API ─────────────────────────────────── */

export function iniciar(semilla) {
  const guardado = leerLocal();
  if (guardado) {
    fusionar(guardado);
  } else {
    fusionar(semilla);
    escribirLocal();
  }
}

export function conectarRemoto(fn) {
  escribirRemoto = fn;
}

/** Fusiona filas que llegan de la sincronización. Devuelve true si algo cambió. */
export function fusionarRemotos(filas) {
  if (!fusionar(filas)) return false;
  escribirLocal();
  avisar();
  return true;
}

export function suscribir(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

function avisar() {
  for (const fn of oyentes) fn();
}

/** Registro visible de un barrio, o null si está pendiente. */
export function registro(codigoBarrio) {
  const r = registros.get(Number(codigoBarrio));
  return r && r.estado !== "borrado" ? r : null;
}

export function estadoDe(codigoBarrio) {
  return registro(codigoBarrio)?.estado ?? "pendiente";
}

export function todos() {
  return [...registros.values()].filter((r) => r.estado !== "borrado");
}

export function contar() {
  let hechos = 0;
  let plan = 0;
  for (const r of registros.values()) {
    if (r.estado === "hecho") hechos++;
    else if (r.estado === "plan") plan++;
  }
  return { hechos, plan, pendientes: TOTAL_BARRIS - hechos - plan };
}

function propagar(r) {
  escribirLocal();
  avisar();
  escribirRemoto?.(r);
}

/** Crea o actualiza el registro de un barrio. */
export function guardar(codigoBarrio, restaurante, estado) {
  const codi = Number(codigoBarrio);
  const ahora = new Date().toISOString();
  const previo = registros.get(codi);
  const r = {
    codigoBarrio: codi,
    restaurante: restaurante.trim(),
    estado,
    creadoEn: previo && previo.estado !== "borrado" ? previo.creadoEn : ahora,
    actualizadoEn: ahora,
  };
  registros.set(codi, r);
  propagar(r);
  return r;
}

export function borrar(codigoBarrio) {
  const codi = Number(codigoBarrio);
  const previo = registros.get(codi);
  if (!previo) return;
  const r = {
    ...previo,
    restaurante: "",
    estado: "borrado",
    actualizadoEn: new Date().toISOString(),
  };
  registros.set(codi, r);
  propagar(r);
}

/* ──────────────────────── copia de seguridad ─────────────────────────── */

export function exportar() {
  return JSON.stringify(
    { version: 1, exportadoEn: new Date().toISOString(), registros: todos() },
    null,
    2
  );
}

/** Acepta el formato de `exportar` o una lista pelada de registros. */
export function importar(texto) {
  const datos = JSON.parse(texto);
  const filas = Array.isArray(datos) ? datos : datos.registros;
  if (!Array.isArray(filas)) throw new Error("formato no reconocido");
  const antes = contar();
  // una importación manual debe pisar lo que haya en este móvil
  const ahora = new Date().toISOString();
  fusionar(filas.map((r) => ({ ...r, actualizadoEn: ahora })));
  escribirLocal();
  avisar();
  for (const r of todos()) escribirRemoto?.(r);
  const despues = contar();
  return { antes, despues };
}
