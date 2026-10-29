// Aspecto a gusto de cada uno (Preferencias ⚙ del panel): tamaño de letra, vista
// compacta y tema que sigue al del sistema (claro de día, oscuro de noche). Se
// guarda en este navegador. La letra vale para toda la web; lo compacto, para el
// panel (src/dashboard.css, clase sk-compacto en <html>).
const CLAVES = { letra: 'sokyoLetra', compacto: 'sokyoCompacto', temaAuto: 'sokyoTemaAuto' };
const EVENTO = 'sokyo-aspecto';
export const TAMANOS = ['normal', 'grande', 'muy-grande'];

const leer = (k, def) => { try { return localStorage.getItem(CLAVES[k]) ?? def; } catch { return def; } };
const escribir = (k, v) => { try { localStorage.setItem(CLAVES[k], v); } catch { /* sin almacenamiento */ } };

export const tamanoLetra = () => (TAMANOS.includes(leer('letra', 'normal')) ? leer('letra', 'normal') : 'normal');
export const vistaCompacta = () => leer('compacto', '0') === '1';
export const temaAutomatico = () => leer('temaAuto', '0') === '1';

// Pone las clases en <html>. Se llama al arrancar (main.jsx) y al cambiar algo.
export function aplicarAspecto() {
  if (typeof document === 'undefined') return;
  const h = document.documentElement.classList;
  const letra = tamanoLetra();
  h.toggle('sk-letra-grande', letra === 'grande');
  h.toggle('sk-letra-muy-grande', letra === 'muy-grande');
  h.toggle('sk-compacto', vistaCompacta());
}

const avisar = () => { aplicarAspecto(); window.dispatchEvent(new Event(EVENTO)); };
export const ponerTamanoLetra = (v) => { escribir('letra', TAMANOS.includes(v) ? v : 'normal'); avisar(); };
export const ponerVistaCompacta = (v) => { escribir('compacto', v ? '1' : '0'); avisar(); };
export const ponerTemaAutomatico = (v) => { escribir('temaAuto', v ? '1' : '0'); avisar(); };

const consulta = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null);
export const sistemaClaro = () => !!consulta()?.matches;

export const suscribirAspecto = (cb) => {
  const mq = consulta();
  window.addEventListener(EVENTO, cb);
  mq?.addEventListener?.('change', cb);
  return () => { window.removeEventListener(EVENTO, cb); mq?.removeEventListener?.('change', cb); };
};

// Con «seguir al sistema»: si el tema elegido es oscuro y el sistema está en claro,
// se usa el claro; y al revés, el oscuro por defecto (Aurora).
const CLAROS = ['light', 'lavanda', 'cereza'];
export function temaEfectivo(tema) {
  if (!temaAutomatico()) return tema;
  const claro = sistemaClaro();
  if (claro) return CLAROS.includes(tema) ? tema : 'light';
  return CLAROS.includes(tema) ? 'lima' : tema;
}
