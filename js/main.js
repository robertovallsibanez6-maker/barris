// Arranque y conexión de las piezas.

import { abrirAnadir, configurarAnadir } from "./anadir.js";
import { cargarDatos, datos } from "./datos.js";
import {
  TOTAL_BARRIS,
  borrar,
  contar,
  estadoDe,
  exportar,
  importar,
  iniciar as iniciarEstado,
  suscribir,
} from "./estado.js";
import { abrirFicha, configurarFichas } from "./fichas.js";
import {
  animarMarcado,
  animarRetirada,
  iniciarMapa,
  irABarri,
  repintar,
  resaltar,
  volverAlEncuadre,
} from "./mapa.js";
import { configurarRuleta, iniciarRuleta } from "./ruleta.js";
import { iniciarSync } from "./sync.js";
import { alternarAltura, cerrarHoja, esc, hojaAbierta, nodos } from "./ui.js";

/* ──────────────────────────── contador ───────────────────────────────── */

const rodillo = document.getElementById("rodillo");
const lineaRelleno = document.getElementById("linea-relleno");
let ultimoRecuento = null;

function numeroEl(n) {
  const span = document.createElement("span");
  span.className = "rodillo__num";
  span.textContent = String(n);
  return span;
}

function pintarContador({ animar = false } = {}) {
  const { hechos } = contar();
  lineaRelleno.style.width = `${(hechos / TOTAL_BARRIS) * 100}%`;
  if (hechos === ultimoRecuento) return;
  const previo = ultimoRecuento;
  ultimoRecuento = hechos;

  if (!animar || previo === null) {
    rodillo.replaceChildren(numeroEl(hechos));
    return;
  }
  const viejo = rodillo.firstElementChild;
  const nuevo = numeroEl(hechos);
  nuevo.classList.add("rodillo__num--entra");
  rodillo.append(nuevo);
  viejo?.classList.add("rodillo__num--sale");
  setTimeout(() => {
    viejo?.remove();
    nuevo.classList.remove("rodillo__num--entra");
  }, 320);
}

/* ─────────────────────── desglose por distritos ──────────────────────── */

const desglose = document.getElementById("desglose");
const desgloseCaja = document.getElementById("desglose-caja");
const progresoToque = document.getElementById("progreso-toque");
let desgloseAbierto = false;

function pintarDesglose() {
  desgloseCaja.replaceChildren();
  for (const d of datos.distritos) {
    const total = d.barris.length;
    const hechos = d.barris.filter((f) => estadoDe(f.properties.codi) === "hecho").length;
    const fila = nodos(`
      <div class="desglose__fila">
        <span class="desglose__nombre">${esc(d.nom)}</span>
        <span class="desglose__cifra">${hechos}/${total}</span>
        <span class="desglose__barra"><i style="width:${(hechos / total) * 100}%"></i></span>
      </div>`);
    desgloseCaja.append(fila);
  }
  const copias = nodos(`
    <div class="desglose__copias">
      <button class="enlace enlace--suave" data-accion="exportar">Exportar</button>
      <button class="enlace enlace--suave" data-accion="importar">Importar</button>
    </div>`);
  desgloseCaja.append(copias);

  const aviso = (boton, texto) => {
    const original = boton.textContent;
    boton.textContent = texto;
    setTimeout(() => (boton.textContent = original), 1800);
  };

  const btnExportar = desgloseCaja.querySelector('[data-accion="exportar"]');
  btnExportar.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(exportar());
      aviso(btnExportar, "Copiado");
    } catch {
      aviso(btnExportar, "No se ha podido copiar");
    }
  });

  const btnImportar = desgloseCaja.querySelector('[data-accion="importar"]');
  btnImportar.addEventListener("click", async () => {
    try {
      const texto = await navigator.clipboard.readText();
      importar(texto);
      aviso(btnImportar, "Importado");
    } catch {
      aviso(btnImportar, "Portapapeles no válido");
    }
  });
}

function cerrarDesglose() {
  if (!desgloseAbierto) return;
  desgloseAbierto = false;
  progresoToque.setAttribute("aria-expanded", "false");
  alternarAltura(desglose, false);
}

progresoToque.addEventListener("click", () => {
  desgloseAbierto = !desgloseAbierto;
  progresoToque.setAttribute("aria-expanded", String(desgloseAbierto));
  if (desgloseAbierto) pintarDesglose();
  alternarAltura(desglose, desgloseAbierto);
});

/* ───────────────────────────── pestañas ──────────────────────────────── */

const vistas = {
  mapa: document.getElementById("vista-mapa"),
  ruleta: document.getElementById("vista-ruleta"),
};
const pestanas = [...document.querySelectorAll(".pestana")];
let vistaActual = "mapa";

function irAVista(nombre) {
  if (nombre === vistaActual) return;
  const saliente = vistas[vistaActual];
  saliente.classList.remove("vista--activa");
  saliente.classList.toggle("vista--saliente-izq", nombre === "ruleta");
  vistas[nombre].classList.remove("vista--saliente-izq");
  vistas[nombre].classList.add("vista--activa");
  vistaActual = nombre;
  for (const p of pestanas) {
    const activa = p.dataset.vista === nombre;
    p.classList.toggle("pestana--activa", activa);
    if (activa) p.setAttribute("aria-current", "page");
    else p.removeAttribute("aria-current");
  }
}

for (const p of pestanas) {
  p.addEventListener("click", () => irAVista(p.dataset.vista));
}

/* ──────────────────────────── arranque ───────────────────────────────── */

const mapaEl = document.getElementById("mapa");

function atenuarMapa(atenuado) {
  mapaEl.classList.toggle("mapa--atenuado", atenuado);
}

async function marcar(codi, estado) {
  atenuarMapa(false);
  resaltar(null);
  await animarMarcado(codi, estado);
}

async function retirar(codi) {
  atenuarMapa(false);
  resaltar(null);
  borrar(codi);
  await animarRetirada(codi);
}

async function arrancar() {
  await cargarDatos();
  iniciarEstado(datos.semilla);

  await iniciarMapa(mapaEl, {
    alTocar: (codi) => {
      cerrarDesglose();
      resaltar(codi);
      atenuarMapa(true);
      abrirFicha(codi, { nueva: true });
    },
  });

  configurarFichas({ alConquistar: (codi) => void marcar(codi, "hecho"), alRetirar: retirar });
  configurarAnadir({ alGuardar: (codi, estado) => void marcar(codi, estado) });
  configurarRuleta({
    alVerEnMapa: (codi) => {
      irAVista("mapa");
      setTimeout(() => void irABarri(codi), 320);
    },
  });

  const ruleta = iniciarRuleta();

  document.getElementById("btn-mas").addEventListener("click", () => {
    cerrarDesglose();
    if (hojaAbierta()) cerrarHoja();
    abrirAnadir();
  });

  // cuando se cierra la hoja: quitar el resalte del mapa
  const velo = document.getElementById("velo");
  const observador = new MutationObserver(() => {
    if (velo.hidden) {
      resaltar(null);
      atenuarMapa(false);
    }
  });
  observador.observe(velo, { attributes: true, attributeFilter: ["hidden"] });

  suscribir(() => {
    repintar();
    pintarContador({ animar: true });
    if (desgloseAbierto) {
      pintarDesglose();
      desglose.style.height = "auto";
    }
    ruleta.refrescar();
  });

  pintarContador();
  void volverAlEncuadre({ duracion: 0 });
  document.body.classList.add("listo"); // dispara el fundido del mapa

  // el mapa entra entero en color arena y, una vez visible, los barrios
  // marcados se van tiñendo uno a uno en orden de distrito
  setTimeout(() => repintar({ animado: true }), 220);

  iniciarSync();
}

arrancar().catch((e) => {
  console.error(e);
  document.body.append(
    nodos(
      `<p class="vacio">No se han podido cargar los datos del mapa.<br>${esc(e.message)}</p>`
    )
  );
});

/* ───────────────────────── service worker ────────────────────────────── */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("sw", e));
  });
}
