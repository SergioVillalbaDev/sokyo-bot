// Formateadores y pequeñas utilidades de presentación.

const DIA_MS = 24 * 60 * 60 * 1000;

export const numeroTicket = (ticket) => (ticket?.numero ? `#${String(ticket.numero).padStart(4, '0')}` : '');

export function haceTiempo(fecha, ahora = Date.now()) {
  if (!fecha) return '—';
  const seg = Math.round((ahora - new Date(fecha).getTime()) / 1000);
  if (seg < 45) return 'ahora mismo';
  const min = Math.round(seg / 60);
  if (min < 60) return `hace ${min} min`;
  const horas = Math.round(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias < 30) return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
  return new Date(fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const fechaCorta = (fecha) => (fecha ? new Date(fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—');
export const fechaLarga = (fecha) => (fecha ? new Date(fecha).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
export const hora = (fecha) => (fecha ? new Date(fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '');

export function etiquetaDia(fecha, ahora = Date.now()) {
  const d = new Date(fecha);
  const hoy = new Date(ahora);
  if (d.toDateString() === hoy.toDateString()) return 'Hoy';
  if (d.toDateString() === new Date(ahora - DIA_MS).toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function duracion(ms) {
  if (ms == null) return '—';
  const min = Math.round(ms / 60000);
  if (min < 1) return '< 1 min';
  if (min < 60) return `${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 48) return `${horas} h ${min % 60} min`;
  return `${Math.floor(horas / 24)} d ${horas % 24} h`;
}


export function esImagen(url) {
  try {
    return /\.(png|jpe?g|gif|webp|avif)$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

export function nombreArchivo(url) {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').pop());
  } catch {
    return 'archivo';
  }
}

// Texto de contraste (negro o blanco) para un color de fondo en hexadecimal.
export function textoSobre(hex) {
  const limpio = String(hex || '').replace('#', '');
  if (limpio.length !== 6) return '#fff';
  const [r, g, b] = [0, 2, 4].map(i => parseInt(limpio.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#111' : '#fff';
}

export const enlaceDiscord = (guildId, canalId) => `https://discord.com/channels/${guildId}/${canalId}`;
