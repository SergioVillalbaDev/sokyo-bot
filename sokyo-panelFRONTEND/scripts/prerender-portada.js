// Portada ya pintada en el HTML (plugin de Vite, solo al compilar).
//
// Sin esto, el móvil ve la página en blanco hasta que descarga y ejecuta todo el
// JavaScript de la web (unos 120 KB): en Lighthouse, el texto del hero salía a
// los ~3,4 s. Al terminar `vite build`, este plugin compila src/prerender.js para
// Node, pinta la parte de arriba de la portada (barra, hero y «Dos entradas») en
// cada idioma y la mete en dist/index.html dentro de un <template> por idioma:
//  - un script al principio de <head> (tras el viewport) elige el idioma (como src/i18n/index.js) y
//    precarga la captura grande del hero de ese idioma, sin esperar al CSS;
//  - otro, justo después de #root, copia ahí la portada de ese idioma antes del
//    primer pintado;
//  - y main.jsx «hidrata» lo que ya se ve en vez de pintarlo de cero.
// Van en <template> (y no una directamente en #root) para que el navegador no
// descargue las capturas del otro idioma.
//
// Si algo falla aquí, avisa y deja index.html como estaba: la web funciona igual
// (solo tarda más en verse). Funciona también con `--outDir` (deploy/deploy.sh).
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Buffer } from 'node:buffer';

const IDIOMAS = ['es', 'en'];
const RAIZ = '<div id="root"></div>';
// El script de <head> va justo detrás del viewport: antes, el móvil aún mide 980 px
// de ancho y la precarga elegía la captura más grande (1800 px en vez de 640).
const CABECERA = /<meta name="viewport"[^>]*>/i;

// Navegador, al principio de <head> (antes que el CSS y la app). Autosuficiente:
// se copia tal cual. `precargas`: { es: '<link rel="preload" …>…', en: … }, las
// que React pone al pintar (logo y capturas del hero). Fuera de la portada (panel, Mi cuenta, legal, vuelta del login) no
// marca nada: main.jsx decide lo mismo y pinta lo que toque. Pone también en
// <html> el tema de la portada, el tamaño de letra y el modo ligero (los de
// Landing.jsx y main.jsx), para que el primer pintado ya sea el definitivo.
function elegirPortada(precargas) {
  var d = document, h = d.documentElement, l = location, n = navigator;
  var leer = function (k) { try { return localStorage.getItem(k); } catch { return null; } };
  try {
    var letra = leer('sokyoLetra'), ligero = leer('sokyoLigero') || 'auto';
    var modesto = /firefox\//i.test(n.userAgent || '') || (n.hardwareConcurrency && n.hardwareConcurrency <= 4)
      || (n.deviceMemory && n.deviceMemory <= 4) || !!(n.connection && n.connection.saveData);
    h.classList.toggle('sk-letra-grande', letra === 'grande');
    h.classList.toggle('sk-letra-muy-grande', letra === 'muy-grande');
    h.classList.toggle('sk-ligero', ligero === 'si' || (ligero === 'auto' && !!modesto));

    if (/^#(dashboard|legal)/.test(l.hash) || /^\/(panel|cuenta|account|mi-cuenta)\/?$/i.test(l.pathname)
      || /[?&](portal|staff)(=|&|$)/.test(l.search)) return;
    var codigos = ['es', 'en'], guardado = leer('sokyoLang');
    var idioma = codigos.indexOf(guardado) >= 0 ? guardado : '';
    var lista = n.languages || [n.language || ''];
    for (var i = 0; i < lista.length && !idioma; i++) {
      var c = String(lista[i]).slice(0, 2).toLowerCase();
      if (codigos.indexOf(c) >= 0) idioma = c;
    }
    idioma = idioma || 'en';
    h.setAttribute('data-portada', idioma);
    h.setAttribute('data-theme', 'lima');
    if (precargas[idioma]) d.head.insertAdjacentHTML('beforeend', precargas[idioma]);
  } catch { h.removeAttribute('data-portada'); }
}

// Navegador, justo después de #root y las plantillas: pone la portada del idioma
// elegido y quita las plantillas (ya no hacen falta).
function ponerPortada() {
  var d = document, raiz = d.getElementById('root');
  var idioma = d.documentElement.getAttribute('data-portada');
  var plantilla = idioma && d.getElementById('pre-' + idioma);
  if (plantilla) {
    raiz.replaceChildren(plantilla.content.cloneNode(true));
    raiz.setAttribute('data-pre', idioma);
  }
  d.querySelectorAll('template[id^="pre-"]').forEach(function (t) { t.remove(); });
}

// React 19 pone delante de lo que pinta un <link rel="preload"> por cada imagen
// de arriba. Su sitio es <head> (lo pone elegirPortada), no #root.
function separarPrecargas(html) {
  const precargas = html.match(/^(?:<link\b[^>]*>)+/i)?.[0] || '';
  return { precargas, marcado: html.slice(precargas.length) };
}

// En línea dentro de <script>: que nada pueda cerrar la etiqueta antes de tiempo.
const enLinea = (fn, ...args) => `<script>(${fn})(${args.map((a) => JSON.stringify(a).replace(/</g, '\\u003c')).join(',')})</script>`;

// En Node no hay CSS que procesar: los import de .css se quedan en nada.
const sinCss = () => ({
  name: 'sokyo-sin-css',
  enforce: 'pre',
  resolveId: (id) => (/\.css(\?|$)/.test(id) ? '\0sokyo-sin-css' : null),
  load: (id) => (id === '\0sokyo-sin-css' ? '' : null),
});

export function prerenderPortada() {
  let raiz = '';
  let salida = '';
  let modo = 'production';
  return {
    name: 'sokyo-prerender-portada',
    apply: (_config, { command, isSsrBuild }) => command === 'build' && !isSsrBuild,
    configResolved(config) {
      raiz = config.root;
      salida = path.resolve(config.root, config.build.outDir);
      modo = config.mode;
    },
    async closeBundle() {
      const temporal = path.join(raiz, 'node_modules', '.sokyo-prerender');
      try {
        await build({
          configFile: false,
          root: raiz,
          mode: modo,
          logLevel: 'warn',
          publicDir: false,
          plugins: [react(), sinCss()],
          build: {
            ssr: path.join(raiz, 'src', 'prerender.js'),
            outDir: temporal,
            emptyOutDir: true,
            minify: false,
            sourcemap: false,
            // .mjs: dentro de node_modules Node no mira el "type": "module" del panel.
            rollupOptions: { output: { entryFileNames: '[name].mjs', chunkFileNames: '[name]-[hash].mjs' } },
          },
        });
        // ?v=: si se compila otra vez en el mismo proceso, que no reutilice el módulo anterior.
        const { pintar } = await import(`${pathToFileURL(path.join(temporal, 'prerender.mjs')).href}?v=${Date.now()}`);
        const pintado = {};
        const precargas = {};
        for (const idioma of IDIOMAS) {
          ({ marcado: pintado[idioma], precargas: precargas[idioma] } = separarPrecargas(await pintar(idioma)));
        }

        const archivo = path.join(salida, 'index.html');
        const html = await readFile(archivo, 'utf8');
        if (!html.includes(RAIZ) || !CABECERA.test(html)) throw new Error(`index.html no tiene <meta name="viewport"> o ${RAIZ}`);
        const plantillas = IDIOMAS.map((i) => `<template id="pre-${i}">${pintado[i]}</template>`).join('');
        const nuevo = html
          .replace(CABECERA, (cabecera) => `${cabecera}\n    ${enLinea(elegirPortada, precargas)}`)
          .replace(RAIZ, () => `${RAIZ}${plantillas}${enLinea(ponerPortada)}`);
        await writeFile(archivo, nuevo);
        const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1);
        console.log(`✓ Portada pintada en index.html (${IDIOMAS.map((i) => `${i} ${kb(pintado[i])} KB`).join(', ')})`);
      } catch (e) {
        console.warn(`⚠ No se pudo pintar la portada en index.html (la web funciona igual, solo tarda más en verse): ${e?.stack || e}`);
      } finally {
        await rm(temporal, { recursive: true, force: true }).catch(() => {});
      }
    },
  };
}
