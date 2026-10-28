// Modo ligero: para PCs con pocos recursos y para Firefox (que recalcula en cada
// fotograma el cristal difuminado sobre el fondo animado y se arrastra). Quita
// el desenfoque del cristal, para el fondo y las animaciones de adorno. La web se
// ve casi igual (las tarjetas, algo más opacas) y va fluida.
// Preferencia: 'auto' (lo decide el equipo), 'si' o 'no'. Se guarda en este
// navegador y vale para la web, el panel y «Mi cuenta» (ver src/ligero.css).
const CLAVE = 'sokyoLigero';
const EVENTO = 'sokyo-ligero';

export const preferenciaLigero = () => { try { return localStorage.getItem(CLAVE) || 'auto'; } catch { return 'auto'; } };

// ¿Equipo modesto? Firefox, 4 núcleos o menos, 4 GB de memoria o menos (solo
// lo dicen Chrome y Edge) o el ahorro de datos activado.
export function equipoModesto() {
  const n = typeof navigator === 'undefined' ? {} : navigator;
  if (/firefox\//i.test(n.userAgent || '')) return true;
  if (n.hardwareConcurrency && n.hardwareConcurrency <= 4) return true;
  if (n.deviceMemory && n.deviceMemory <= 4) return true;
  return !!n.connection?.saveData;
}

export const ligeroActivo = () => {
  const p = preferenciaLigero();
  return p === 'si' || (p === 'auto' && equipoModesto());
};

// Pone (o quita) la clase sk-ligero en <html>. Se llama al arrancar (main.jsx).
export function aplicarLigero() {
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('sk-ligero', ligeroActivo());
}

export function ponerLigero(pref) {
  try { localStorage.setItem(CLAVE, pref); } catch { /* sin almacenamiento */ }
  aplicarLigero();
  window.dispatchEvent(new Event(EVENTO));
}

export const suscribirLigero = (avisar) => {
  window.addEventListener(EVENTO, avisar);
  return () => window.removeEventListener(EVENTO, avisar);
};
