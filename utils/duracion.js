// Utilidades de duración para recordatorios y anuncios.
// Convierte texto tipo "2h", "30m", "1d12h", "90s" a milisegundos.

const FACTOR = { d: 86400000, h: 3600000, m: 60000, s: 1000 };

// Devuelve los milisegundos de una cadena de duración, o 0 si no hay nada válido.
function parseDuracion(str) {
    if (!str || typeof str !== 'string') return 0;
    const re = /(\d+)\s*(d|h|m|s)/gi;
    let ms = 0;
    let match;
    while ((match = re.exec(str)) !== null) {
        ms += parseInt(match[1], 10) * FACTOR[match[2].toLowerCase()];
    }
    return ms;
}

// Formatea milisegundos a algo legible: 9000000 -> "2h 30m".
function formatoDuracion(ms) {
    let resto = Math.max(0, Math.floor(ms));
    const d = Math.floor(resto / FACTOR.d); resto %= FACTOR.d;
    const h = Math.floor(resto / FACTOR.h); resto %= FACTOR.h;
    const m = Math.floor(resto / FACTOR.m); resto %= FACTOR.m;
    const s = Math.floor(resto / FACTOR.s);
    return [d && `${d}d`, h && `${h}h`, m && `${m}m`, s && `${s}s`].filter(Boolean).join(' ') || '0s';
}

module.exports = { parseDuracion, formatoDuracion };
