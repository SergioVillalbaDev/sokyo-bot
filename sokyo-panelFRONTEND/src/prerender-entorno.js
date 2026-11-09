// Entorno mínimo de navegador para pintar la portada en Node al compilar
// (scripts/prerender-portada.js). Va importado ANTES que nada en
// src/prerender.js: i18n lee localStorage y navigator al cargarse.
const vacio = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {}, key: () => null, length: 0 };
for (const nombre of ['localStorage', 'sessionStorage']) {
  try {
    Object.defineProperty(globalThis, nombre, { value: vacio, configurable: true, writable: true });
  } catch { /* Node ya trae uno que no se deja cambiar: vale ese */ }
}
