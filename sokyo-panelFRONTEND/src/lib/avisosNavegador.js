// Avisos del navegador (y de la app): un ticket nuevo, una respuesta en un ticket
// o un reporte nuevo aunque tengas el panel en otra pestaña o minimizado. Se
// activan en Preferencias ⚙ (el navegador pide permiso una vez).
const CLAVE = 'sokyoAvisosNavegador';
const EVENTO = 'sokyo-avisos-navegador';

export const soportado = () => typeof window !== 'undefined' && 'Notification' in window;
const permiso = () => (soportado() ? Notification.permission : 'denied');
const quiere = () => { try { return localStorage.getItem(CLAVE) === '1'; } catch { return false; } };

// 'activo' | 'apagado' | 'bloqueado' (el navegador lo tiene denegado) | 'no-soportado'
export function estadoAvisos() {
  if (!soportado()) return 'no-soportado';
  if (permiso() === 'denied') return 'bloqueado';
  return quiere() && permiso() === 'granted' ? 'activo' : 'apagado';
}

export async function activarAvisos() {
  if (!soportado()) return 'no-soportado';
  const p = permiso() === 'granted' ? 'granted' : await Notification.requestPermission();
  if (p === 'granted') { try { localStorage.setItem(CLAVE, '1'); } catch { /* sin almacenamiento */ } }
  window.dispatchEvent(new Event(EVENTO));
  return estadoAvisos();
}
export function desactivarAvisos() {
  try { localStorage.setItem(CLAVE, '0'); } catch { /* sin almacenamiento */ }
  window.dispatchEvent(new Event(EVENTO));
}
export const suscribirAvisos = (cb) => { window.addEventListener(EVENTO, cb); return () => window.removeEventListener(EVENTO, cb); };

// Manda un aviso (si están activos). `alPulsar`: qué abrir al tocarlo.
export function avisar(titulo, cuerpo, { tag, alPulsar } = {}) {
  if (estadoAvisos() !== 'activo') return;
  try {
    const n = new Notification(titulo, { body: String(cuerpo || '').slice(0, 180), icon: '/assets/logo-96.webp', tag });
    n.onclick = () => { window.focus(); alPulsar?.(); n.close(); };
  } catch {
    // Algunos móviles solo dejan avisar desde un service worker: ahí no se avisa.
  }
}
