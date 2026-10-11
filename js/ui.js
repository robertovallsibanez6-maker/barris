// Piezas compartidas: la hoja inferior, el plegable, y utilidades pequeñas.

const consultaMovimiento = window.matchMedia?.("(prefers-reduced-motion: reduce)");

export function reduccionMovimiento() {
  return !!consultaMovimiento?.matches;
}

export function esc(texto) {
  return String(texto ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

/** Construye nodos a partir de HTML. Devuelve un fragmento. */
export function nodos(html) {
  const plantilla = document.createElement("template");
  plantilla.innerHTML = html.trim();
  return plantilla.content;
}

export const FLECHA = '<span class="flecha" aria-hidden="true"></span>';

/* ───────────────────────────── hoja inferior ─────────────────────────── */

const hoja = document.getElementById("hoja");
const cuerpo = document.getElementById("hoja-cuerpo");
const asa = document.getElementById("hoja-asa");
const velo = document.getElementById("velo");

let alCerrarActual = null;
let abierta = false;

export function hojaAbierta() {
  return abierta;
}

export function abrirHoja(contenido, { alCerrar = null, etiqueta = "" } = {}) {
  cuerpo.replaceChildren(contenido);
  cuerpo.scrollTop = 0;
  if (etiqueta) hoja.setAttribute("aria-label", etiqueta);
  alCerrarActual = alCerrar;
  velo.hidden = false;
  hoja.hidden = false;
  hoja.style.transform = "";
  // forzar un fotograma para que la transición arranque desde abajo
  void hoja.offsetHeight;
  hoja.classList.add("hoja--abierta");
  abierta = true;
  document.body.classList.add("con-hoja");
}

export function cerrarHoja() {
  if (!abierta) return;
  abierta = false;
  hoja.classList.remove("hoja--abierta", "hoja--arrastre");
  hoja.style.transform = "";
  velo.hidden = true;
  document.body.classList.remove("con-hoja");
  const fn = alCerrarActual;
  alCerrarActual = null;
  const ocultar = () => {
    if (!abierta) {
      hoja.hidden = true;
      cuerpo.replaceChildren();
    }
  };
  setTimeout(ocultar, reduccionMovimiento() ? 180 : 350);
  fn?.();
}

/** Sustituye el contenido de la hoja sin cerrarla. */
export function reemplazarHoja(contenido, { alCerrar } = {}) {
  cuerpo.replaceChildren(contenido);
  cuerpo.scrollTop = 0;
  if (alCerrar !== undefined) alCerrarActual = alCerrar;
}

velo.addEventListener("pointerdown", (ev) => {
  ev.preventDefault();
  cerrarHoja();
});

// arrastrar el asa hacia abajo para cerrar
let arrastre = null;
asa.addEventListener("pointerdown", (ev) => {
  arrastre = { y: ev.clientY, t: performance.now(), dy: 0, id: ev.pointerId };
  asa.setPointerCapture?.(ev.pointerId);
  hoja.classList.add("hoja--arrastre");
});
asa.addEventListener("pointermove", (ev) => {
  if (!arrastre || ev.pointerId !== arrastre.id) return;
  arrastre.dy = Math.max(0, ev.clientY - arrastre.y);
  hoja.style.transform = `translateY(${arrastre.dy}px)`;
});
const finArrastre = (ev) => {
  if (!arrastre || ev.pointerId !== arrastre.id) return;
  const { dy, t } = arrastre;
  const velocidad = dy / Math.max(1, performance.now() - t);
  arrastre = null;
  hoja.classList.remove("hoja--arrastre");
  if (dy > 86 || velocidad > 0.6) {
    hoja.style.transform = "";
    cerrarHoja();
  } else {
    hoja.style.transform = "";
  }
};
asa.addEventListener("pointerup", finArrastre);
asa.addEventListener("pointercancel", finArrastre);

/* ────────────────────────────── plegable ─────────────────────────────── */

/**
 * Espera al final de la transición de altura, o se rinde pasado un tiempo.
 * Con `prefers-reduced-motion` las transiciones de altura no llegan a
 * dispararse, así que sin este respaldo el remate nunca se ejecutaría.
 */
function trasAltura(el, fn) {
  let hecho = false;
  const rematar = (ev) => {
    if (ev && ev.propertyName !== "height") return;
    if (hecho) return;
    hecho = true;
    el.removeEventListener("transitionend", rematar);
    clearTimeout(temporizador);
    fn();
  };
  const temporizador = setTimeout(rematar, 500);
  el.addEventListener("transitionend", rematar);
}

/**
 * Convierte un `.plegable` en un acordeón con transición de altura medida.
 * Espera la estructura: .plegable > .plegable__cabeza + .plegable__cuerpo
 */
export function montarPlegable(raiz) {
  const cabeza = raiz.querySelector(".plegable__cabeza");
  const cuerpoP = raiz.querySelector(".plegable__cuerpo");
  let abiertoP = false;
  cabeza.addEventListener("click", () => {
    abiertoP = !abiertoP;
    raiz.classList.toggle("plegable--abierto", abiertoP);
    cabeza.setAttribute("aria-expanded", String(abiertoP));
    if (abiertoP) {
      cuerpoP.style.height = `${cuerpoP.scrollHeight}px`;
      trasAltura(cuerpoP, () => {
        if (raiz.classList.contains("plegable--abierto")) cuerpoP.style.height = "auto";
      });
    } else {
      cuerpoP.style.height = `${cuerpoP.scrollHeight}px`;
      void cuerpoP.offsetHeight;
      cuerpoP.style.height = "0px";
    }
  });
  cabeza.setAttribute("aria-expanded", "false");
}

/** Igual que el plegable, pero para un contenedor cuya altura se alterna. */
export function alternarAltura(el, abrir) {
  if (abrir) {
    el.hidden = false;
    el.style.height = `${el.scrollHeight}px`;
    trasAltura(el, () => {
      if (!el.hidden) el.style.height = "auto";
    });
  } else {
    el.style.height = `${el.scrollHeight}px`;
    void el.offsetHeight;
    el.style.height = "0px";
    trasAltura(el, () => {
      el.hidden = true;
    });
  }
}
