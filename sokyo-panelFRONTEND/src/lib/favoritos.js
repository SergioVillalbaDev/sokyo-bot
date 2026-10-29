// Secciones favoritas del panel: se fijan arriba del menú con la estrella ☆ que
// sale al pasar por encima de cada sección. Se guardan en este navegador.
import { useSyncExternalStore } from 'react';

const CLAVE = 'sokyoFavoritos';
const EVENTO = 'sokyo-favoritos';
const MAX = 8;

let ultimoTexto = null;
let ultimaLista = [];
function leer() {
  let texto = '[]';
  try { texto = localStorage.getItem(CLAVE) || '[]'; } catch { /* sin almacenamiento */ }
  // Misma lista mientras no cambie (useSyncExternalStore necesita la misma referencia).
  if (texto !== ultimoTexto) {
    ultimoTexto = texto;
    try { const l = JSON.parse(texto); ultimaLista = Array.isArray(l) ? l.filter((x) => typeof x === 'string') : []; } catch { ultimaLista = []; }
  }
  return ultimaLista;
}

export function alternarFavorito(tab) {
  const lista = leer();
  const nueva = lista.includes(tab) ? lista.filter((x) => x !== tab) : [...lista, tab].slice(-MAX);
  try { localStorage.setItem(CLAVE, JSON.stringify(nueva)); } catch { /* no es crítico */ }
  window.dispatchEvent(new Event(EVENTO));
}

const suscribir = (avisar) => {
  window.addEventListener(EVENTO, avisar);
  window.addEventListener('storage', avisar);
  return () => { window.removeEventListener(EVENTO, avisar); window.removeEventListener('storage', avisar); };
};
const VACIA = [];
export const useFavoritos = () => useSyncExternalStore(suscribir, leer, () => VACIA);
