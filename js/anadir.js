// La hoja del botón «+»: nombre del restaurante, barrio y estado.

import { datos } from "./datos.js";
import { estadoDe, guardar } from "./estado.js";
import { FLECHA, abrirHoja, cerrarHoja, esc, nodos, reemplazarHoja } from "./ui.js";

let alGuardar = null;

export function configurarAnadir({ alGuardar: fn }) {
  alGuardar = fn;
}

/** Clave de orden alfabético catalán, sin el artículo inicial. */
function clave(nom) {
  return nom.replace(/^(l'|els |les |el |la |)/i, "").toLocaleLowerCase("ca");
}

function disponibles() {
  const grupos = [];
  for (const d of datos.distritos) {
    const barris = d.barris
      .filter((f) => estadoDe(f.properties.codi) !== "hecho")
      .sort((a, b) => clave(a.properties.nom).localeCompare(clave(b.properties.nom), "ca"));
    if (barris.length) grupos.push({ nom: d.nom, barris });
  }
  return grupos;
}

/* ───────────────────────── selector de barrio ────────────────────────── */

function abrirSelector(estadoForm, volver) {
  const caja = nodos(`
    <div>
      <div class="ficha__cabecera">
        <h2 class="ficha__barri">¿Qué barrio?</h2>
      </div>
      <div class="buscador">
        <input type="search" id="buscar-barri" placeholder="Buscar barrio"
               autocapitalize="none" autocomplete="off" spellcheck="false"
               enterkeyhint="search" aria-label="Buscar barrio">
      </div>
      <div id="lista-barris"></div>
    </div>`).firstElementChild;

  const lista = caja.querySelector("#lista-barris");
  const entrada = caja.querySelector("#buscar-barri");

  const pintar = (filtro = "") => {
    const f = filtro.trim().toLocaleLowerCase("ca");
    lista.replaceChildren();
    let total = 0;
    for (const grupo of disponibles()) {
      const barris = f
        ? grupo.barris.filter((b) => b.properties.nom.toLocaleLowerCase("ca").includes(f))
        : grupo.barris;
      if (!barris.length) continue;
      total += barris.length;
      lista.append(nodos(`<p class="grupo__titulo">${esc(grupo.nom)}</p>`));
      for (const b of barris) {
        const { codi, nom } = b.properties;
        const enPlan = estadoDe(codi) === "plan";
        const boton = nodos(`
          <button class="opcion" type="button">
            <span>${esc(nom)}</span>
            ${enPlan ? '<span class="opcion__marca">En plan</span>' : ""}
          </button>`).firstElementChild;
        boton.addEventListener("click", () => {
          estadoForm.codi = codi;
          volver();
        });
        lista.append(boton);
      }
    }
    if (!total) lista.append(nodos(`<p class="vacio">Ningún barrio con ese nombre.</p>`));
  };

  entrada.addEventListener("input", () => pintar(entrada.value));
  pintar();
  reemplazarHoja(caja);
}

/* ──────────────────────────── el formulario ──────────────────────────── */

export function abrirAnadir() {
  const estadoForm = { nombre: "", codi: null, estado: "hecho" };

  const pintarFormulario = () => {
    const caja = nodos(`
      <div>
        <div class="ficha__cabecera">
          <h2 class="ficha__barri">Un barrio más</h2>
        </div>
        <div class="campo">
          <label class="campo__etiqueta" for="nuevo-nombre">Restaurante</label>
          <input class="campo__texto" id="nuevo-nombre" type="text"
                 placeholder="Nombre del sitio" autocapitalize="words"
                 autocomplete="off" spellcheck="false" enterkeyhint="done">
        </div>
        <div class="campo">
          <span class="campo__etiqueta">Barrio</span>
          <button type="button" class="selector-barri" id="abrir-selector">
            <span id="barri-elegido"></span>${FLECHA}
          </button>
        </div>
        <div class="campo">
          <span class="campo__etiqueta">Estado</span>
          <div class="conmutador" role="group">
            <button type="button" data-estado="hecho">Hecho</button>
            <button type="button" data-estado="plan">En plan</button>
          </div>
        </div>
        <div class="formulario__pie">
          <button class="boton boton--primario" id="guardar-nuevo">Guardar</button>
        </div>
      </div>`).firstElementChild;

    const entrada = caja.querySelector("#nuevo-nombre");
    const elegido = caja.querySelector("#barri-elegido");
    const selector = caja.querySelector("#abrir-selector");
    const botonGuardar = caja.querySelector("#guardar-nuevo");
    const conmutador = [...caja.querySelectorAll("[data-estado]")];

    entrada.value = estadoForm.nombre;

    const refrescar = () => {
      const nom = estadoForm.codi
        ? datos.porCodi.get(estadoForm.codi).properties.nom
        : "Elegir barrio";
      elegido.textContent = nom;
      selector.classList.toggle("selector-barri--vacio", !estadoForm.codi);
      for (const b of conmutador) {
        b.setAttribute("aria-pressed", String(b.dataset.estado === estadoForm.estado));
      }
      botonGuardar.disabled = !(estadoForm.nombre.trim() && estadoForm.codi);
    };

    entrada.addEventListener("input", () => {
      estadoForm.nombre = entrada.value;
      refrescar();
    });
    entrada.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        entrada.blur();
      }
    });
    selector.addEventListener("click", () => {
      estadoForm.nombre = entrada.value;
      abrirSelector(estadoForm, pintarFormulario);
    });
    for (const b of conmutador) {
      b.addEventListener("click", () => {
        estadoForm.estado = b.dataset.estado;
        refrescar();
      });
    }
    botonGuardar.addEventListener("click", () => {
      const nombre = entrada.value.trim();
      if (!nombre || !estadoForm.codi) return;
      const codi = estadoForm.codi;
      const estado = estadoForm.estado;
      guardar(codi, nombre, estado);
      cerrarHoja();
      alGuardar?.(codi, estado);
    });

    refrescar();
    reemplazarHoja(caja);
    return caja;
  };

  // primera apertura
  abrirHoja(document.createElement("div"), { etiqueta: "Añadir restaurante" });
  pintarFormulario();
}
