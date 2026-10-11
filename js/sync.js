// Sincronización opcional entre los dos móviles, contra una sola tabla de
// Supabase. Desactivada mientras config.js no tenga las tres constantes.
//
// localStorage sigue siendo la fuente que se lee al dibujar: esto sólo empuja
// los cambios y trae los del otro móvil al abrir y al volver al primer plano.
// Los fallos de red no se muestran; se reintentan.

import { MISION, SUPABASE_ANON_KEY, SUPABASE_URL } from "../config.js";
import { conectarRemoto, fusionarRemotos, todos } from "./estado.js";

const COLA = "barris.cola.v1";
const activa = !!(SUPABASE_URL && SUPABASE_ANON_KEY && MISION);

export function sincronizacionActiva() {
  return activa;
}

const base = () => `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/registros`;

const cabeceras = () => ({
  "Content-Type": "application/json",
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
});

function aFila(r) {
  return {
    mision: MISION,
    codigo_barrio: r.codigoBarrio,
    restaurante: r.restaurante,
    estado: r.estado,
    creado_en: r.creadoEn,
    actualizado_en: r.actualizadoEn,
  };
}

function aRegistro(f) {
  return {
    codigoBarrio: f.codigo_barrio,
    restaurante: f.restaurante ?? "",
    estado: f.estado,
    creadoEn: f.creado_en,
    actualizadoEn: f.actualizado_en,
  };
}

/* ─────────────────────────── cola de reintentos ──────────────────────── */

function leerCola() {
  try {
    return JSON.parse(localStorage.getItem(COLA) ?? "[]");
  } catch {
    return [];
  }
}

function escribirCola(cola) {
  try {
    localStorage.setItem(COLA, JSON.stringify(cola));
  } catch {
    /* si no cabe, se pierde el reintento: el siguiente cambio lo arreglará */
  }
}

function encolar(r) {
  const cola = leerCola().filter((x) => x.codigoBarrio !== r.codigoBarrio);
  cola.push(r);
  escribirCola(cola);
}

async function subir(registros) {
  if (!registros.length) return true;
  const respuesta = await fetch(`${base()}?on_conflict=mision,codigo_barrio`, {
    method: "POST",
    headers: { ...cabeceras(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(registros.map(aFila)),
  });
  if (!respuesta.ok) throw new Error(`subir: ${respuesta.status} ${await respuesta.text()}`);
  return true;
}

async function vaciarCola() {
  const cola = leerCola();
  if (!cola.length) return;
  try {
    await subir(cola);
    escribirCola([]);
  } catch (e) {
    console.warn("sincronización: cola pendiente", e.message);
  }
}

/* ──────────────────────────────── API ────────────────────────────────── */

async function empujar(r) {
  try {
    await subir([r]);
    await vaciarCola();
  } catch (e) {
    console.warn("sincronización: se reintentará", e.message);
    encolar(r);
  }
}

async function traer() {
  try {
    const url = `${base()}?mision=eq.${encodeURIComponent(MISION)}&select=*`;
    const respuesta = await fetch(url, { headers: cabeceras(), cache: "no-store" });
    if (!respuesta.ok) throw new Error(`traer: ${respuesta.status}`);
    const filas = await respuesta.json();
    fusionarRemotos(filas.map(aRegistro));
  } catch (e) {
    console.warn("sincronización: no se ha podido leer", e.message);
  }
}

export function iniciarSync() {
  if (!activa) return;
  conectarRemoto((r) => void empujar(r));

  // primera lectura y primer empujón de lo que haya en este móvil
  void (async () => {
    await traer();
    await vaciarCola();
    try {
      await subir(todos());
    } catch (e) {
      console.warn("sincronización: subida inicial pendiente", e.message);
    }
  })();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void traer();
      void vaciarCola();
    }
  });
  window.addEventListener("online", () => void vaciarCola());
}
