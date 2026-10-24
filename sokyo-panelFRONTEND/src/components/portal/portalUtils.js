// Utilidades de "Mi cuenta" (portal de usuarios) sin componentes: así los
// archivos .jsx solo exportan componentes (Fast Refresh).

// Pantallas del portal, en el orden del menú inferior. El #hash de la URL
// dice cuál está abierta (/cuenta#tienda): así funcionan el botón "atrás" del
// móvil y los enlaces directos que manda el bot.
export const VISTAS = ['inicio', 'tickets', 'tienda', 'musica', 'tarjeta'];

// "#tickets/123" -> { vista: 'tickets', ticket: '123' }; "#tienda/mochila" -> sub 'mochila'.
export function leerHash(hash = window.location.hash) {
  const [v, extra] = hash.replace(/^#/, '').split('/');
  const vista = VISTAS.includes(v) ? v : 'inicio';
  // Un enlace mal copiado (%E0%A4…) no puede dejar la página en blanco.
  let ticket = null;
  if (vista === 'tickets' && extra) { try { ticket = decodeURIComponent(extra); } catch { ticket = extra; } }
  return {
    vista,
    ticket,
    sub: vista === 'tienda' && extra ? extra : null,
  };
}

export const fmtNum = (n, idioma) => Number(n || 0).toLocaleString(idioma === 'en' ? 'en-US' : 'es-ES');
export const fmtCorto = (n, idioma) => new Intl.NumberFormat(idioma === 'en' ? 'en-US' : 'es-ES', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n || 0));

// Milisegundos -> "3 h 12 min" / "45 min".
export function fmtEspera(ms, t) {
  const min = Math.max(1, Math.ceil(ms / 60000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return t('portal.common.hoursMinutes', { h, m });
  return t('portal.common.minutes', { m });
}

// Tickets cuyo último mensaje leí: { canalId: fechaISO }. Para saber qué
// respuestas del equipo son nuevas.
const CLAVE_VISTOS = 'portalTicketsVistos';
export function leerVistos() {
  try { return JSON.parse(localStorage.getItem(CLAVE_VISTOS) || '{}') || {}; } catch { return {}; }
}
// Devuelve true si ha cambiado algo (para no repintar en cada refresco del chat).
export function marcarVisto(canalId, fecha = new Date()) {
  try {
    const v = leerVistos();
    const iso = new Date(fecha).toISOString();
    if (v[canalId] === iso) return false;
    v[canalId] = iso;
    localStorage.setItem(CLAVE_VISTOS, JSON.stringify(v));
    return true;
  } catch { return false; /* sin almacenamiento: los avisos se repetirán, nada grave */ }
}

// Respuestas del equipo que aún no he visto (a partir del resumen).
export function respuestasNuevas(resumen, vistos = leerVistos()) {
  const lista = resumen?.tickets?.recientes || [];
  return lista.filter((tk) => tk.ultimo && !tk.ultimo.mio
    && (!vistos[tk.canalId] || new Date(tk.ultimo.fecha) > new Date(vistos[tk.canalId])));
}

// Rarezas de la tienda: color propio (el brillo de cada carta).
export const RAREZAS = {
  legendario: { color: '#f5b942' },
  epico: { color: '#c084fc' },
  raro: { color: '#38bdf8' },
  comun: { color: '#2dd4bf' },
};
export const rareza = (r) => RAREZAS[r] || RAREZAS.comun;
export const ICONO_TIPO = { consumible: '🧪', equipo: '🛡️', material: '💎' };

// Precio con la oferta relámpago aplicada si sigue activa (mismo criterio que el bot).
export function precioEfectivo(item, ahora = Date.now()) {
  const o = item.oferta;
  const activa = !!(o && o.porcentaje > 0 && o.expiraEn && new Date(o.expiraEn).getTime() > ahora);
  return {
    precio: activa ? Math.max(0, Math.round(item.precio * (1 - o.porcentaje / 100))) : item.precio,
    oferta: activa,
    porcentaje: activa ? o.porcentaje : 0,
    expiraEn: activa ? o.expiraEn : null,
  };
}

// Escala "bonita" para el eje de la gráfica: 4, 5, 10, 20, 50, 100…
export function maximoBonito(max) {
  if (max <= 4) return 4;
  const pot = 10 ** Math.floor(Math.log10(max));
  for (const f of [1, 2, 2.5, 5, 10]) if (f * pot >= max) return f * pot;
  return 10 * pot;
}

// Curva suave que nunca se pasa de los puntos (monótona, Fritsch–Carlson): con
// una curva normal, entre un día de 0 y uno de 40 la línea bajaba de cero.
export function trazoMonotono(puntos) {
  const n = puntos.length;
  if (n === 0) return '';
  if (n === 1) return `M${puntos[0][0]},${puntos[0][1]}`;
  const dx = [], dy = [], m = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(puntos[i + 1][0] - puntos[i][0]);
    dy.push(puntos[i + 1][1] - puntos[i][1]);
    m.push(dy[i] / dx[i]);
  }
  const tg = [m[0]];
  for (let i = 1; i < n - 1; i++) tg.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  tg.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { tg[i] = 0; tg[i + 1] = 0; continue; }
    const a = tg[i] / m[i], b = tg[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); tg[i] = k * a * m[i]; tg[i + 1] = k * b * m[i]; }
  }
  let d = `M${puntos[0][0]},${puntos[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${puntos[i][0] + h},${puntos[i][1] + tg[i] * h} ${puntos[i + 1][0] - h},${puntos[i + 1][1] - tg[i + 1] * h} ${puntos[i + 1][0]},${puntos[i + 1][1]}`;
  }
  return d;
}
