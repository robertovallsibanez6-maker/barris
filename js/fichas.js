// Las tres fichas de barrio (conquistado, en plan, pendiente), la edición y
// las tarjetas de sugerencias.

import { datos, fraseDe, sugerenciasDe } from "./datos.js";
import { borrar, guardar, registro } from "./estado.js";
import { FLECHA, abrirHoja, cerrarHoja, esc, montarPlegable, nodos, reemplazarHoja } from "./ui.js";

let alConquistar = null;
let alRetirar = null;

export function configurarFichas({ alConquistar: c, alRetirar: r }) {
  alConquistar = c;
  alRetirar = r;
}

/* ───────────────────────── tarjetas de sugerencias ───────────────────── */

function enlaceMaps(s) {
  if (s.maps) return s.maps;
  const consulta = [s.nombre, s.direccion, "Barcelona"].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`;
}

function tarjetaSugerencia(codi, s, alMarcar) {
  const reservar = s.reservar
    ? `<a class="enlace enlace--suave" href="${esc(s.reservar)}" target="_blank" rel="noopener">Reservar${FLECHA}</a>`
    : "";
  const frag = nodos(`
    <article class="sug">
      <div class="sug__fila1">
        <h3 class="sug__nombre">${esc(s.nombre)}</h3>
        <span class="sug__precio">${esc(s.precio ?? "")}</span>
      </div>
      <p class="sug__cocina">${esc(s.cocina ?? "")}</p>
      <p class="sug__porque">${esc(s.porque ?? "")}</p>
      ${s.pide ? `<p class="sug__pide"><b>Pide:</b> ${esc(s.pide)}</p>` : ""}
      <div class="sug__enlaces">
        <a class="enlace enlace--suave" href="${esc(enlaceMaps(s))}" target="_blank" rel="noopener">Cómo llegar${FLECHA}</a>
        ${reservar}
      </div>
      <div class="sug__marcar">
        <button class="enlace" data-accion="plan">Apuntar${FLECHA}</button>
        <button class="enlace" data-accion="hecho">Ya hemos ido${FLECHA}</button>
      </div>
    </article>`);
  const art = frag.firstElementChild;
  art.querySelector('[data-accion="plan"]').addEventListener("click", () => {
    guardar(codi, s.nombre, "plan");
    alMarcar(codi, "plan");
  });
  art.querySelector('[data-accion="hecho"]').addEventListener("click", () => {
    guardar(codi, s.nombre, "hecho");
    alMarcar(codi, "hecho");
  });
  return art;
}

/**
 * Lista de tarjetas de un barrio. `alMarcar` se llama después de apuntar o de
 * marcar como ido; por defecto cierra la hoja y lanza la conquista.
 */
function listaSugerencias(codi, { alMarcar } = {}) {
  const lista = sugerenciasDe(codi);
  const caja = document.createElement("div");
  if (!lista.length) return caja;
  const tras =
    alMarcar ??
    ((c, estado) => {
      cerrarHoja();
      if (estado === "hecho") alConquistar?.(c);
    });
  for (const s of lista) caja.append(tarjetaSugerencia(codi, s, tras));
  return caja;
}

/* ──────────────────────────── cabecera común ─────────────────────────── */

function cabecera(codi) {
  const p = datos.porCodi.get(codi).properties;
  return nodos(`
    <div class="ficha__cabecera">
      <h2 class="ficha__barri">${esc(p.nom)}</h2>
      <p class="ficha__distrito">${esc(p.districte_nom)}</p>
    </div>
    <hr class="regla">`);
}

/* ───────────────────────────── las tres fichas ───────────────────────── */

function fichaConquistado(codi, r) {
  const caja = document.createElement("div");
  caja.append(cabecera(codi));
  caja.append(
    nodos(`
    <div class="ficha__trofeo">
      <p class="ficha__restaurante">${esc(r.restaurante)}</p>
      <p class="ficha__estado">Conquistado</p>
    </div>
    <div class="ficha__pie">
      <button class="enlace enlace--suave" data-accion="editar">Editar${FLECHA}</button>
    </div>`)
  );
  caja.querySelector('[data-accion="editar"]').addEventListener("click", () =>
    abrirEdicion(codi)
  );
  return caja;
}

function fichaPlan(codi, r) {
  const caja = document.createElement("div");
  caja.append(cabecera(codi));
  caja.append(
    nodos(`
    <div class="ficha__trofeo">
      <p class="ficha__restaurante ficha__restaurante--plan">${esc(r.restaurante)}</p>
      <p class="ficha__estado">En plan</p>
    </div>
    <div class="ficha__acciones">
      <button class="boton boton--primario" data-accion="hecho">Hecho</button>
      <button class="enlace enlace--suave" data-accion="editar">Editar${FLECHA}</button>
    </div>`)
  );
  caja.querySelector('[data-accion="hecho"]').addEventListener("click", () => {
    guardar(codi, r.restaurante, "hecho");
    cerrarHoja();
    alConquistar?.(codi);
  });
  caja.querySelector('[data-accion="editar"]').addEventListener("click", () =>
    abrirEdicion(codi)
  );

  const otras = sugerenciasDe(codi);
  if (otras.length) {
    const plegable = nodos(`
      <section class="plegable">
        <button class="plegable__cabeza">
          <span>Otras ideas</span>
          <span class="plegable__signo" aria-hidden="true"></span>
        </button>
        <div class="plegable__cuerpo"></div>
      </section>`).firstElementChild;
    plegable.querySelector(".plegable__cuerpo").append(listaSugerencias(codi));
    caja.append(plegable);
    montarPlegable(plegable);
  }
  return caja;
}

function fichaPendiente(codi) {
  const caja = document.createElement("div");
  caja.append(cabecera(codi));
  const frase = fraseDe(codi);
  if (frase) caja.append(nodos(`<p class="ficha__frase">${esc(frase)}</p>`));
  const lista = sugerenciasDe(codi);
  if (lista.length) {
    caja.append(nodos(`<p class="sugerencias__titulo">Dónde comer</p>`));
    caja.append(listaSugerencias(codi));
  }
  return caja;
}

/* ─────────────────────────────── edición ─────────────────────────────── */

function abrirEdicion(codi) {
  const r = registro(codi);
  if (!r) return;
  const caja = document.createElement("div");
  caja.append(cabecera(codi));
  caja.append(
    nodos(`
    <div class="campo">
      <label class="campo__etiqueta" for="editar-nombre">Restaurante</label>
      <input class="campo__texto" id="editar-nombre" type="text"
             autocapitalize="words" autocomplete="off" spellcheck="false"
             enterkeyhint="done" value="${esc(r.restaurante)}">
    </div>
    <div class="campo">
      <span class="campo__etiqueta">Estado</span>
      <div class="conmutador" role="group">
        <button type="button" data-estado="hecho" aria-pressed="${r.estado === "hecho"}">Hecho</button>
        <button type="button" data-estado="plan" aria-pressed="${r.estado === "plan"}">En plan</button>
      </div>
    </div>
    <div class="formulario__pie">
      <button class="boton boton--primario" data-accion="guardar">Guardar</button>
      <button class="enlace enlace--suave" data-accion="eliminar">Eliminar el registro${FLECHA}</button>
    </div>`)
  );

  const entrada = caja.querySelector("#editar-nombre");
  const guardarBtn = caja.querySelector('[data-accion="guardar"]');
  let estado = r.estado;
  const botones = [...caja.querySelectorAll("[data-estado]")];
  const pintar = () => {
    for (const b of botones) b.setAttribute("aria-pressed", String(b.dataset.estado === estado));
    guardarBtn.disabled = !entrada.value.trim();
  };
  for (const b of botones) {
    b.addEventListener("click", () => {
      estado = b.dataset.estado;
      pintar();
    });
  }
  entrada.addEventListener("input", pintar);
  entrada.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      guardarBtn.click();
    }
  });

  guardarBtn.addEventListener("click", () => {
    const nombre = entrada.value.trim();
    if (!nombre) return;
    const eraHecho = r.estado === "hecho";
    guardar(codi, nombre, estado);
    cerrarHoja();
    if (!eraHecho && estado === "hecho") alConquistar?.(codi);
  });

  caja.querySelector('[data-accion="eliminar"]').addEventListener("click", () =>
    confirmarBorrado(codi)
  );

  pintar();
  reemplazarHoja(caja);
}

function confirmarBorrado(codi) {
  const nom = datos.porCodi.get(codi).properties.nom;
  const caja = nodos(`
    <div class="confirmar">
      <p class="confirmar__texto">¿Borrar el registro de ${esc(nom)}?</p>
      <div class="confirmar__acciones">
        <button class="boton boton--primario" data-accion="si">Borrar</button>
        <button class="enlace enlace--suave" data-accion="no">Dejarlo como está${FLECHA}</button>
      </div>
    </div>`).firstElementChild;
  caja.querySelector('[data-accion="si"]').addEventListener("click", () => {
    cerrarHoja();
    alRetirar?.(codi);
  });
  caja.querySelector('[data-accion="no"]').addEventListener("click", () => abrirFicha(codi));
  reemplazarHoja(caja);
}

/* ─────────────────────────────── entrada ─────────────────────────────── */

export function abrirFicha(codi, { nueva = false } = {}) {
  const r = registro(codi);
  const contenido =
    r?.estado === "hecho"
      ? fichaConquistado(codi, r)
      : r?.estado === "plan"
        ? fichaPlan(codi, r)
        : fichaPendiente(codi);
  const nom = datos.porCodi.get(codi).properties.nom;
  if (nueva) abrirHoja(contenido, { etiqueta: nom });
  else reemplazarHoja(contenido);
}

export { listaSugerencias };
