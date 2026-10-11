// La ruleta: un tablero de nombres que pasa a toda velocidad y frena hasta
// pararse en un barrio pendiente.

import { datos } from "./datos.js";
import { estadoDe } from "./estado.js";
import { listaSugerencias } from "./fichas.js";
import { esc, nodos, reduccionMovimiento } from "./ui.js";

const ALTO = 112; // alto de cada nombre, igual que en el CSS
const PASOS = 85; // nombres que pasan antes de parar
const DURACION = 3000;
const POTENCIA = 4; // 1-(1-t)^4: arranca rápida y acaba muy lenta

const tablero = document.getElementById("tablero");
const pista = document.getElementById("tablero-pista");
const distrito = document.getElementById("tablero-distrito");
const cajaSug = document.getElementById("ruleta-sugerencias");
const botonSorpresa = document.getElementById("btn-sorpresa");
const enlaces = document.getElementById("ruleta-enlaces");

let girando = false;
let elegido = null;
let alVerEnMapa = null;

export function configurarRuleta({ alVerEnMapa: fn }) {
  alVerEnMapa = fn;
}

function pendientes() {
  return datos.barris.filter((f) => estadoDe(f.properties.codi) === "pendiente");
}

function nombreEl(texto) {
  const div = document.createElement("div");
  div.className = "tablero__nombre";
  div.textContent = texto;
  return div;
}

function mostrarResultado(f) {
  const { codi, districte_nom } = f.properties;
  elegido = codi;
  distrito.textContent = districte_nom;
  // la tira ya no hace falta: queda el nombre final, centrado
  pista.replaceChildren(nombreEl(f.properties.nom));
  pista.style.transform = "translateY(0)";
  tablero.classList.add("tablero--parado");
  enlaces.hidden = false;
  botonSorpresa.textContent = "Sorpréndenos";

  cajaSug.replaceChildren();
  const lista = listaSugerencias(codi, { alMarcar: () => preparar() });
  if (lista.childElementCount) {
    cajaSug.append(nodos(`<p class="sugerencias__titulo">Dónde comer</p>`));
    cajaSug.append(lista);
  }
}

function preparar() {
  girando = false;
  elegido = null;
  tablero.classList.remove("tablero--parado");
  distrito.textContent = "";
  enlaces.hidden = true;
  cajaSug.replaceChildren();
  pista.style.transform = "translateY(0)";
  const restantes = pendientes();
  pista.replaceChildren();
  botonSorpresa.disabled = restantes.length === 0;
}

function girar() {
  if (girando) return;
  const restantes = pendientes();
  if (!restantes.length) return;

  const destino = restantes[Math.floor(Math.random() * restantes.length)];

  if (reduccionMovimiento()) {
    pista.replaceChildren(nombreEl(destino.properties.nom));
    pista.style.transform = "translateY(0)";
    mostrarResultado(destino);
    return;
  }

  girando = true;
  enlaces.hidden = true;
  cajaSug.replaceChildren();
  distrito.textContent = "";
  tablero.classList.remove("tablero--parado");

  // tira de nombres: ruido al azar y, al final, el elegido
  const tira = [];
  for (let i = 0; i < PASOS; i++) {
    tira.push(restantes[Math.floor(Math.random() * restantes.length)].properties.nom);
  }
  tira.push(destino.properties.nom);
  pista.replaceChildren(...tira.map(nombreEl));

  const recorrido = (tira.length - 1) * ALTO;
  const t0 = performance.now();
  const paso = (ahora) => {
    const t = Math.min(1, (ahora - t0) / DURACION);
    const avance = 1 - Math.pow(1 - t, POTENCIA);
    pista.style.transform = `translateY(${-(recorrido * avance).toFixed(2)}px)`;
    if (t < 1) {
      requestAnimationFrame(paso);
    } else {
      girando = false;
      mostrarResultado(destino);
    }
  };
  requestAnimationFrame(paso);
}

export function iniciarRuleta() {
  preparar();
  botonSorpresa.addEventListener("click", girar);
  document.getElementById("btn-otra-vez").addEventListener("click", girar);
  document.getElementById("btn-ver-mapa").addEventListener("click", () => {
    if (elegido != null) alVerEnMapa?.(elegido);
  });
  return { refrescar: preparar };
}
