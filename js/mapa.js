// El mapa: 73 polígonos sobre papel, zoom y arrastre, etiquetas que sólo
// aparecen cuando caben dentro de su propio barrio, y la animación de
// conquista.

import {
  geoMercator,
  geoPath,
  zoom,
  zoomIdentity,
  select,
  easeCubicOut,
  easeCubicInOut,
} from "./d3.min.js";
import { datos } from "./datos.js";
import { estadoDe } from "./estado.js";
import { reduccionMovimiento } from "./ui.js";

const MARGEN = 14; // margen del encuadre inicial, en px
const ZOOM_MAX = 12;
const UMBRAL_ETIQUETAS = 1.55; // por debajo de este zoom no se ve ningún nombre
const FUENTE_ETIQUETA = '500 9.5px "Jost", system-ui, sans-serif';
const TRACKING = 0.13; // em, igual que en el CSS
const ALTO_LINEA = 11.3; // px
const MAX_LINEAS = 3;
const TILE_TRAMA = 7; // px de lado del mosaico de rayas

let svg, lienzo, gBarris, gTrama, gEtiquetas, trazaConquista, manchaConquista;
let blotCirculo, patronTrama;
let proyeccion, trazo, zb;
let ancho = 0;
let alto = 0;
let pxPorMetro = 1;
let transformActual = zoomIdentity;
let encuadreBase = zoomIdentity;
let etiquetas = [];
let nodosBarri = new Map();
let nodosTrama = new Map();
let alTocar = null;
let resaltado = null;
let animando = false;

/* ─────────────────────── medición de las etiquetas ───────────────────── */

const lienzoMedida = document.createElement("canvas").getContext("2d");

function anchoTexto(texto) {
  lienzoMedida.font = FUENTE_ETIQUETA;
  const base = lienzoMedida.measureText(texto.toUpperCase()).width;
  return base + Math.max(0, texto.length - 1) * TRACKING * 9.5;
}

/** Reparte palabras en `n` líneas minimizando la línea más ancha. */
function repartir(palabras, n) {
  if (n === 1) return [palabras.join(" ")];
  let mejor = null;
  const cortes = palabras.length - 1;
  const combinar = (inicio, restantes, acumulado) => {
    if (restantes === 0) {
      const lineas = [];
      let previo = 0;
      for (const c of acumulado) {
        lineas.push(palabras.slice(previo, c).join(" "));
        previo = c;
      }
      lineas.push(palabras.slice(previo).join(" "));
      const max = Math.max(...lineas.map(anchoTexto));
      if (!mejor || max < mejor.max) mejor = { lineas, max };
      return;
    }
    for (let c = inicio; c <= cortes - restantes + 1; c++) {
      combinar(c + 1, restantes - 1, [...acumulado, c]);
    }
  };
  combinar(1, n - 1, []);
  return mejor ? mejor.lineas : [palabras.join(" ")];
}

/**
 * Elige el reparto en líneas que necesita menos sitio y devuelve el radio
 * (en px) que la etiqueta necesita tener libre a su alrededor.
 */
function maquetar(nom) {
  const palabras = nom.split(/\s+/);
  let mejor = null;
  for (let n = 1; n <= Math.min(MAX_LINEAS, palabras.length); n++) {
    const lineas = repartir(palabras, n);
    const hw = Math.max(...lineas.map(anchoTexto)) / 2;
    const hh = (lineas.length * ALTO_LINEA) / 2;
    const r = Math.hypot(hw, hh);
    if (!mejor || r < mejor.r - 0.5) mejor = { lineas, r };
  }
  return mejor;
}

/* ──────────────────────────── construcción ───────────────────────────── */

function medir(contenedor) {
  const caja = contenedor.getBoundingClientRect();
  ancho = Math.max(1, Math.round(caja.width));
  alto = Math.max(1, Math.round(caja.height));
}

function prepararProyeccion() {
  const coleccion = { type: "FeatureCollection", features: datos.barris };
  // el lienzo llega hasta el borde inferior, pero la barra de pestañas tapa
  // esa franja: se descuenta para que la ciudad quede centrada en lo que se ve
  const pestanasEl = document.getElementById("pestanas");
  const reserva = pestanasEl ? pestanasEl.offsetHeight : 0;
  proyeccion = geoMercator().fitExtent(
    [
      [MARGEN, MARGEN],
      [ancho - MARGEN, alto - MARGEN - reserva],
    ],
    coleccion
  );
  trazo = geoPath(proyeccion);

  // píxeles por metro en el encuadre base, para el umbral de las etiquetas
  const lat = 41.4;
  const grado = 1000 / (111320 * Math.cos((lat * Math.PI) / 180));
  const a = proyeccion([2.15, lat]);
  const b = proyeccion([2.15 + grado, lat]);
  pxPorMetro = Math.hypot(b[0] - a[0], b[1] - a[1]) / 1000;
}

function svgEl(nombre, atributos = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", nombre);
  for (const [k, v] of Object.entries(atributos)) el.setAttribute(k, v);
  return el;
}

function construir() {
  svg.setAttribute("viewBox", `0 0 ${ancho} ${alto}`);
  svg.replaceChildren();

  const defs = svgEl("defs");

  patronTrama = svgEl("pattern", {
    id: "trama-plan",
    width: TILE_TRAMA,
    height: TILE_TRAMA,
    patternUnits: "userSpaceOnUse",
    patternTransform: "rotate(45)",
  });
  patronTrama.append(
    svgEl("line", {
      x1: 0,
      y1: 0,
      x2: 0,
      y2: TILE_TRAMA,
      stroke: "var(--mostaza-trama)",
      "stroke-width": 1.6,
    })
  );
  defs.append(patronTrama);

  const mascara = svgEl("mask", { id: "mascara-mancha", maskUnits: "userSpaceOnUse" });
  blotCirculo = svgEl("circle", { cx: 0, cy: 0, r: 0, fill: "#fff" });
  mascara.append(blotCirculo);
  defs.append(mascara);
  svg.append(defs);

  lienzo = svgEl("g", { id: "lienzo" });

  lienzo.append(svgEl("path", { class: "mar", d: trazo(datos.mar) }));

  gBarris = svgEl("g", { id: "g-barris" });
  gTrama = svgEl("g", { id: "g-trama" });
  nodosBarri = new Map();
  nodosTrama = new Map();

  for (const f of datos.barris) {
    const { codi, nom } = f.properties;
    const d = trazo(f);
    const p = svgEl("path", { class: "barri", d, "data-codi": codi });
    p.setAttribute("aria-label", nom);
    gBarris.append(p);
    nodosBarri.set(codi, p);

    const t = svgEl("path", {
      class: "trama-plan",
      d,
      fill: "url(#trama-plan)",
      stroke: "none",
    });
    gTrama.append(t);
    nodosTrama.set(codi, t);
  }

  manchaConquista = svgEl("path", {
    id: "mancha-conquista",
    fill: "var(--terracota)",
    stroke: "none",
    mask: "url(#mascara-mancha)",
    d: "",
  });
  trazaConquista = svgEl("path", { id: "traza-conquista", d: "" });

  lienzo.append(gBarris, gTrama, manchaConquista, trazaConquista);
  svg.append(lienzo);

  gEtiquetas = svgEl("g", { id: "g-etiquetas" });
  etiquetas = [];
  for (const f of datos.barris) {
    const { codi, nom, label, radi } = f.properties;
    const maqueta = maquetar(nom);
    const nodo = svgEl("text", { class: "etiqueta" });
    maqueta.lineas.forEach((linea, i) => {
      const dy =
        i === 0 ? -((maqueta.lineas.length - 1) * ALTO_LINEA) / 2 + 3.4 : ALTO_LINEA;
      const tspan = svgEl("tspan", { x: 0, dy });
      tspan.textContent = linea;
      nodo.append(tspan);
    });
    gEtiquetas.append(nodo);
    etiquetas.push({
      codi,
      nodo,
      xy: proyeccion(label),
      // zoom mínimo al que la etiqueta cabe dentro de su propio polígono
      kMin: Math.max(UMBRAL_ETIQUETAS, maqueta.r / (radi * pxPorMetro)),
      visible: false,
    });
  }
  svg.append(gEtiquetas);
}

/* ───────────────────────────── pintado ───────────────────────────────── */

let codiAnimando = null;

export function repintar({ animado = false } = {}) {
  const orden = animado
    ? datos.barris
        .filter((f) => estadoDe(f.properties.codi) !== "pendiente")
        .map((f) => f.properties.codi)
    : [];

  for (const f of datos.barris) {
    const codi = f.properties.codi;
    if (codi === codiAnimando) continue; // lo pinta la animación de conquista
    const est = estadoDe(codi);
    const nodo = nodosBarri.get(codi);
    const trama = nodosTrama.get(codi);
    const aplicar = () => {
      nodo.classList.toggle("barri--hecho", est === "hecho");
      nodo.classList.toggle("barri--plan", est === "plan");
      trama.classList.toggle("trama-plan--on", est === "plan");
    };
    if (animado && est !== "pendiente") {
      nodo.classList.remove("barri--hecho", "barri--plan");
      trama.classList.remove("trama-plan--on");
      const retardo = reduccionMovimiento() ? 0 : orden.indexOf(codi) * 40;
      setTimeout(aplicar, retardo);
    } else {
      aplicar();
    }
  }
  colocarEtiquetas(transformActual);
}

function colocarEtiquetas(t) {
  const k = t.k;
  for (const e of etiquetas) {
    const x = t.applyX(e.xy[0]);
    const y = t.applyY(e.xy[1]);
    const dentro = x > -60 && x < ancho + 60 && y > -40 && y < alto + 40;
    const visible = k >= e.kMin && dentro;
    if (visible) {
      e.nodo.setAttribute("transform", `translate(${x.toFixed(1)},${y.toFixed(1)})`);
    }
    if (visible !== e.visible) {
      e.visible = visible;
      e.nodo.classList.toggle("etiqueta--visible", visible);
    }
  }
}

function aplicarTransform(t) {
  transformActual = t;
  lienzo.setAttribute("transform", `translate(${t.x},${t.y}) scale(${t.k})`);
  patronTrama.setAttribute("patternTransform", `rotate(45) scale(${(1 / t.k).toFixed(4)})`);
  colocarEtiquetas(t);
}

/* ──────────────────── zoom, arrastre e inercia ───────────────────────── */

let velocidad = { x: 0, y: 0 };
let ultimoPunto = null;
let impulso = 0;

function registrarPunto(ev) {
  if (ev.touches.length !== 1) {
    ultimoPunto = null;
    velocidad = { x: 0, y: 0 };
    return;
  }
  const t = ev.touches[0];
  const ahora = performance.now();
  if (ultimoPunto) {
    const dt = ahora - ultimoPunto.t;
    if (dt > 0 && dt < 120) {
      const vx = (t.clientX - ultimoPunto.x) / dt;
      const vy = (t.clientY - ultimoPunto.y) / dt;
      velocidad = { x: vx * 0.75 + velocidad.x * 0.25, y: vy * 0.75 + velocidad.y * 0.25 };
    }
  }
  ultimoPunto = { x: t.clientX, y: t.clientY, t: ahora };
}

function pararImpulso() {
  if (impulso) cancelAnimationFrame(impulso);
  impulso = 0;
}

function lanzarImpulso() {
  if (reduccionMovimiento()) return;
  let v = { ...velocidad };
  if (Math.hypot(v.x, v.y) < 0.12) return;
  let anterior = performance.now();
  const paso = (ahora) => {
    const dt = Math.min(34, ahora - anterior);
    anterior = ahora;
    const amortiguacion = Math.pow(0.94, dt / 16.67);
    v = { x: v.x * amortiguacion, y: v.y * amortiguacion };
    const k = transformActual.k;
    zb.translateBy(select(svg), (v.x * dt) / k, (v.y * dt) / k);
    if (Math.hypot(v.x, v.y) > 0.012) impulso = requestAnimationFrame(paso);
    else impulso = 0;
  };
  impulso = requestAnimationFrame(paso);
}

/* ─────────────────── toque simple y doble toque ──────────────────────── */
//
// Un toque abre la ficha del barrio; un doble toque acerca. Para que no se
// peleen, el toque simple se resuelve 170 ms más tarde: lo justo para saber si
// venía un segundo toque, y poco bastante para que no se note al abrir la
// ficha (que de por sí tarda 350 ms en subir).

const VENTANA_DOBLE = 170;
const punteros = new Map();
let tapPendiente = null;

function posEnSvg(ev) {
  const caja = svg.getBoundingClientRect();
  return [ev.clientX - caja.left, ev.clientY - caja.top];
}

function acercarHacia(pos) {
  pararImpulso();
  const t = transformActual;
  const k = Math.min(ZOOM_MAX, t.k * 2);
  if (k === t.k) return;
  // mantener fijo el punto tocado
  const px = t.invertX(pos[0]);
  const py = t.invertY(pos[1]);
  irATransform(
    zoomIdentity.translate(pos[0] - k * px, pos[1] - k * py).scale(k),
    480,
    easeCubicOut
  );
}

function barriEn(clientX, clientY) {
  const el = document.elementFromPoint(clientX, clientY);
  const codi = el?.closest?.("path.barri")?.dataset?.codi;
  return codi ? Number(codi) : null;
}

function montarToques() {
  svg.addEventListener("pointerdown", (ev) => {
    punteros.set(ev.pointerId, {
      x: ev.clientX,
      y: ev.clientY,
      t: performance.now(),
      multi: punteros.size > 0,
    });
    if (punteros.size > 1) {
      for (const p of punteros.values()) p.multi = true;
    }
  });

  const finPuntero = (ev) => {
    const ini = punteros.get(ev.pointerId);
    punteros.delete(ev.pointerId);
    if (!ini || ini.multi || punteros.size > 0 || animando) return;
    const movido = Math.hypot(ev.clientX - ini.x, ev.clientY - ini.y);
    if (movido > 12 || performance.now() - ini.t > 600) return;

    const pos = posEnSvg(ev);
    if (tapPendiente && Math.hypot(pos[0] - tapPendiente.pos[0], pos[1] - tapPendiente.pos[1]) < 40) {
      clearTimeout(tapPendiente.temporizador);
      tapPendiente = null;
      acercarHacia(pos);
      return;
    }

    const codi = barriEn(ev.clientX, ev.clientY);
    const temporizador = setTimeout(() => {
      tapPendiente = null;
      if (codi != null) alTocar?.(codi);
    }, VENTANA_DOBLE);
    tapPendiente = { pos, temporizador };
  };

  svg.addEventListener("pointerup", finPuntero);
  svg.addEventListener("pointercancel", (ev) => punteros.delete(ev.pointerId));
}

function montarZoom() {
  zb = zoom()
    .scaleExtent([1, ZOOM_MAX])
    .translateExtent([
      [0, 0],
      [ancho, alto],
    ])
    .on("start", () => {
      if (!animando) pararImpulso();
    })
    .on("zoom", (ev) => aplicarTransform(ev.transform));

  const sel = select(svg).call(zb).on("dblclick.zoom", null);
  sel.on("wheel.zoom", null); // en iPhone no hace falta y en escritorio molesta
  svg.addEventListener("wheel", (ev) => ev.preventDefault(), { passive: false });

  svg.addEventListener("touchstart", () => pararImpulso(), { passive: true });
  svg.addEventListener("touchmove", registrarPunto, { passive: true });
  svg.addEventListener(
    "touchend",
    (ev) => {
      if (ev.touches.length === 0) {
        lanzarImpulso();
        ultimoPunto = null;
        velocidad = { x: 0, y: 0 };
      }
    },
    { passive: true }
  );
  // Safari: evitar el zoom de página con pinch sobre el mapa
  for (const n of ["gesturestart", "gesturechange", "gestureend"]) {
    svg.addEventListener(n, (ev) => ev.preventDefault());
  }
}

/* ──────────────────────────── resaltado ──────────────────────────────── */

export function resaltar(codi) {
  resaltado = codi == null ? null : Number(codi);
  for (const [c, nodo] of nodosBarri) {
    nodo.classList.toggle("barri--apagado", resaltado != null && c !== resaltado);
  }
  for (const [c, nodo] of nodosTrama) {
    nodo.classList.toggle("barri--apagado", resaltado != null && c !== resaltado);
  }
}

/* ─────────────────────────── encuadres ───────────────────────────────── */

function transformParaBarri(codi, ocupacion = 0.5) {
  const f = datos.porCodi.get(Number(codi));
  const [[x0, y0], [x1, y1]] = trozoBounds(f);
  const anchoB = Math.max(1, x1 - x0);
  const altoB = Math.max(1, y1 - y0);
  const k = Math.max(1, Math.min(ZOOM_MAX, ocupacion * Math.min(ancho / anchoB, alto / altoB)));
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return zoomIdentity.translate(ancho / 2 - k * cx, alto / 2 - k * cy).scale(k);
}

const cacheBounds = new Map();
function trozoBounds(f) {
  const codi = f.properties.codi;
  if (!cacheBounds.has(codi)) cacheBounds.set(codi, trazo.bounds(f));
  return cacheBounds.get(codi);
}

/**
 * Misma restricción que aplica d3-zoom al arrastrar, para que los encuadres
 * programados tampoco puedan dejar el mapa fuera de la pantalla.
 */
function constrenir(t) {
  const k = Math.max(1, Math.min(ZOOM_MAX, t.k));
  if (k !== t.k) t = zoomIdentity.translate(t.x, t.y).scale(k);
  const dx0 = t.invertX(0) - 0;
  const dx1 = t.invertX(ancho) - ancho;
  const dy0 = t.invertY(0) - 0;
  const dy1 = t.invertY(alto) - alto;
  return t.translate(
    dx1 > dx0 ? (dx0 + dx1) / 2 : Math.min(0, dx0) || Math.max(0, dx1),
    dy1 > dy0 ? (dy0 + dy1) / 2 : Math.min(0, dy0) || Math.max(0, dy1)
  );
}

function irATransform(t, duracion, easing = easeCubicInOut) {
  t = constrenir(t);
  return new Promise((resolver) => {
    pararImpulso();
    if (reduccionMovimiento() || duracion === 0) {
      zb.transform(select(svg), t);
      resolver();
      return;
    }
    select(svg)
      .transition()
      .duration(duracion)
      .ease(easing)
      .call(zb.transform, t)
      .on("end interrupt", resolver);
  });
}

export async function irABarri(codi, { duracion = 650 } = {}) {
  await irATransform(transformParaBarri(codi, 0.42), duracion);
}

export async function volverAlEncuadre({ duracion = 600 } = {}) {
  await irATransform(encuadreBase, duracion);
}

/* ────────────────────── animación de conquista ───────────────────────── */

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function animarValor(duracion, easing, aplicar) {
  return new Promise((resolver) => {
    if (reduccionMovimiento()) {
      aplicar(1);
      resolver();
      return;
    }
    const t0 = performance.now();
    const paso = (ahora) => {
      const p = Math.min(1, (ahora - t0) / duracion);
      aplicar(easing(p));
      if (p < 1) requestAnimationFrame(paso);
      else resolver();
    };
    requestAnimationFrame(paso);
  });
}

/** Radio desde el punto de etiqueta que cubre todo el polígono. */
function radioCobertura(f, cx, cy) {
  const [[x0, y0], [x1, y1]] = trozoBounds(f);
  return (
    Math.max(
      Math.hypot(cx - x0, cy - y0),
      Math.hypot(cx - x1, cy - y0),
      Math.hypot(cx - x0, cy - y1),
      Math.hypot(cx - x1, cy - y1)
    ) * 1.02
  );
}

/**
 * Zoom al barrio, mancha de tinta que se extiende desde el centroide, trazo
 * del contorno, aparición del nombre, pausa y vuelta al encuadre anterior.
 * `estado` decide el color: terracota si se conquista, mostaza si se apunta.
 */
export async function animarMarcado(codi, estado = "hecho") {
  codi = Number(codi);
  const f = datos.porCodi.get(codi);
  if (!f) return;
  const nodo = nodosBarri.get(codi);
  const trama = nodosTrama.get(codi);
  const etiqueta = etiquetas.find((e) => e.codi === codi);
  const color = estado === "plan" ? "var(--mostaza)" : "var(--terracota)";

  animando = true;
  codiAnimando = codi;
  const previa = transformActual;
  const d = trazo(f);
  const [cx, cy] = proyeccion(f.properties.label);
  const radioFinal = radioCobertura(f, cx, cy);

  manchaConquista.setAttribute("fill", color);
  manchaConquista.setAttribute("d", d);
  blotCirculo.setAttribute("cx", cx);
  blotCirculo.setAttribute("cy", cy);
  blotCirculo.setAttribute("r", 0);
  trazaConquista.setAttribute("d", d);
  const largo = trazaConquista.getTotalLength();
  trazaConquista.style.transition = "none";
  trazaConquista.style.opacity = "1";
  trazaConquista.style.strokeDasharray = `${largo}`;
  trazaConquista.style.strokeDashoffset = `${largo}`;

  await irATransform(transformParaBarri(codi, 0.42), 600);

  // la mancha crece desde el centroide
  const mancha = animarValor(500, easeCubicOut, (p) =>
    blotCirculo.setAttribute("r", (radioFinal * p).toFixed(1))
  );

  // y, 150 ms después, el contorno se dibuja de un trazo
  await espera(reduccionMovimiento() ? 0 : 150);
  if (reduccionMovimiento()) {
    trazaConquista.style.strokeDashoffset = "0";
  } else {
    trazaConquista.style.transition =
      "stroke-dashoffset 400ms cubic-bezier(0.22, 1, 0.36, 1)";
    trazaConquista.style.strokeDashoffset = "0";
  }

  await mancha;

  // el relleno de verdad toma el relevo, sin transición, y se quita la mancha
  nodo.style.transition = "none";
  nodo.classList.toggle("barri--hecho", estado === "hecho");
  nodo.classList.toggle("barri--plan", estado === "plan");
  requestAnimationFrame(() => {
    nodo.style.transition = "";
    manchaConquista.setAttribute("d", "");
    trama.classList.toggle("trama-plan--on", estado === "plan");
  });

  // el nombre del barrio aparece con un fundido
  if (etiqueta) colocarEtiquetas(transformActual);

  await espera(reduccionMovimiento() ? 0 : 200);
  trazaConquista.style.transition = "opacity 280ms linear";
  trazaConquista.style.opacity = "0";

  // pausa y vuelta al encuadre anterior
  await espera(reduccionMovimiento() ? 0 : 600);
  trazaConquista.setAttribute("d", "");
  trazaConquista.style.transition = "none";
  trazaConquista.style.opacity = "";

  codiAnimando = null;
  await irATransform(previa.k <= 1.001 ? encuadreBase : previa, 600);
  animando = false;
}

/** Se mantiene el nombre antiguo por claridad en las llamadas. */
export const animarConquista = (codi) => animarMarcado(codi, "hecho");

/**
 * Animación inversa: la mancha se recoge hacia el centroide y el barrio
 * vuelve a pendiente. Se llama con el registro ya borrado, así que el color
 * se pasa desde fuera o se deduce del color que el nodo tenía puesto.
 */
export async function animarRetirada(codi) {
  const nodo = nodosBarri.get(Number(codi));
  if (!nodo) return;
  const eraPlan = nodo.classList.contains("barri--plan");
  animando = true;
  codiAnimando = Number(codi);
  const f = datos.porCodi.get(Number(codi));
  const d = trazo(f);
  const [cx, cy] = proyeccion(f.properties.label);
  const radio = radioCobertura(f, cx, cy);

  manchaConquista.setAttribute("fill", eraPlan ? "var(--mostaza)" : "var(--terracota)");
  manchaConquista.setAttribute("d", d);
  blotCirculo.setAttribute("cx", cx);
  blotCirculo.setAttribute("cy", cy);
  blotCirculo.setAttribute("r", radio);

  nodo.style.transition = "none";
  nodo.classList.remove("barri--hecho", "barri--plan");
  nodosTrama.get(Number(codi))?.classList.remove("trama-plan--on");
  requestAnimationFrame(() => (nodo.style.transition = ""));

  await animarValor(420, easeCubicOut, (p) =>
    blotCirculo.setAttribute("r", (radio * (1 - p)).toFixed(1))
  );
  manchaConquista.setAttribute("d", "");
  codiAnimando = null;
  animando = false;
}

/* ──────────────────────────── arranque ───────────────────────────────── */

export async function iniciarMapa(contenedor, opciones = {}) {
  svg = contenedor.querySelector("svg");
  alTocar = opciones.alTocar ?? null;

  if (document.fonts?.ready) {
    try {
      await document.fonts.load(FUENTE_ETIQUETA);
    } catch {
      /* sin la fuente cargada las medidas serían aproximadas; da igual */
    }
  }

  medir(contenedor);
  prepararProyeccion();
  construir();
  montarZoom();
  montarToques();
  encuadreBase = zoomIdentity;
  aplicarTransform(zoomIdentity);

  let temporizador;
  const redimensionar = () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      const previo = { ...transformActual };
      medir(contenedor);
      prepararProyeccion();
      cacheBounds.clear();
      construir();
      zb.translateExtent([
        [0, 0],
        [ancho, alto],
      ]);
      select(svg).call(zb);
      repintar();
      aplicarTransform(zoomIdentity);
      void previo;
    }, 220);
  };
  window.addEventListener("resize", redimensionar);
  window.addEventListener("orientationchange", redimensionar);

  return { repintar, resaltar, irABarri, volverAlEncuadre, animarConquista };
}

export function zoomActual() {
  return transformActual.k;
}
