// Secciones abiertas hace poco (las enseña el buscador del panel sin escribir nada).
const CLAVE = 'sokyoRecientes';
const MAX = 5;

export function leerRecientes() {
  try { const l = JSON.parse(localStorage.getItem(CLAVE) || '[]'); return Array.isArray(l) ? l : []; } catch { return []; }
}

export function anotarReciente(tab) {
  if (!tab || tab === 'inicio') return;
  try { localStorage.setItem(CLAVE, JSON.stringify([tab, ...leerRecientes().filter((x) => x !== tab)].slice(0, MAX))); } catch { /* no es crítico */ }
}
