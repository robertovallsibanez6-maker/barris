// Service worker: guarda la app entera en caché para que abra sin conexión.
// Al cambiar cualquier archivo, sube VERSION y se renueva todo.

const VERSION = "barris-v1";

const ARCHIVOS = [
  ".",
  "index.html",
  "manifest.json",
  "config.js",
  "css/app.css",
  "js/main.js",
  "js/mapa.js",
  "js/datos.js",
  "js/estado.js",
  "js/fichas.js",
  "js/anadir.js",
  "js/ruleta.js",
  "js/sync.js",
  "js/ui.js",
  "js/d3.min.js",
  "data/barris.json",
  "data/barrios.json",
  "data/sugerencias.json",
  "data/semilla.json",
  "fonts/jost-latin.woff2",
  "fonts/jost-latin-ext.woff2",
  "icons/icono-180.png",
  "icons/icono-192.png",
  "icons/icono-512.png",
  "icons/icono-512-recortable.png",
];

self.addEventListener("install", (ev) => {
  ev.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(ARCHIVOS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(claves.filter((c) => c !== VERSION).map((c) => caches.delete(c)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (ev) => {
  const peticion = ev.request;
  if (peticion.method !== "GET") return;

  const url = new URL(peticion.url);
  if (url.origin !== self.location.origin) return; // Supabase va siempre a la red

  ev.respondWith(
    caches.match(peticion, { ignoreSearch: true }).then((guardado) => {
      if (guardado) {
        // refresco silencioso en segundo plano
        ev.waitUntil(
          fetch(peticion)
            .then((r) => r.ok && caches.open(VERSION).then((c) => c.put(peticion, r.clone())))
            .catch(() => {})
        );
        return guardado;
      }
      return fetch(peticion)
        .then((respuesta) => {
          if (respuesta.ok) {
            const copia = respuesta.clone();
            ev.waitUntil(caches.open(VERSION).then((c) => c.put(peticion, copia)));
          }
          return respuesta;
        })
        .catch(() => caches.match("index.html"));
    })
  );
});
