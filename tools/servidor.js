// Servidor estático mínimo para revisar la app en local.
//   node tools/servidor.js [puerto]
// No forma parte de la app: en producción son archivos sueltos en GitHub Pages.

import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));
const PUERTO = Number(process.argv[2] ?? 8777);

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".geojson": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

createServer((peticion, respuesta) => {
  const ruta = decodeURIComponent(new URL(peticion.url, "http://x").pathname);
  let destino = join(RAIZ, normalize(ruta).replace(/^(\.\.[/\\])+/, ""));
  try {
    if (statSync(destino).isDirectory()) destino = join(destino, "index.html");
  } catch {
    respuesta.writeHead(404).end("no está");
    return;
  }
  try {
    statSync(destino);
  } catch {
    respuesta.writeHead(404).end("no está");
    return;
  }
  respuesta.writeHead(200, {
    "Content-Type": TIPOS[extname(destino)] ?? "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(destino).pipe(respuesta);
}).listen(PUERTO, () => console.log(`http://localhost:${PUERTO}`));
