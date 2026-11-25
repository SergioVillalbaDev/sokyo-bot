// Freno a las subidas de imágenes (2.0.1). Sin él, cualquiera con cuenta de Discord podía subir
// imágenes de 8 MB sin parar desde «Mi cuenta» y llenar la tarjeta de la Raspberry Pi.
//  · Por persona: 20 subidas por hora y 100 MB al día (en memoria: se reinicia con el bot, y vale).
//  · Para todos: si la carpeta de subidas pasa de 3 GB, no se aceptan más hasta que haya sitio.
const fs = require('fs');
const path = require('path');

const MAX_HORA = 20;
const MAX_BYTES_DIA = 100 * 1024 * 1024;
const MAX_CARPETA = 3 * 1024 * 1024 * 1024;
const HORA = 3600000;
const DIA = 24 * HORA;

const uso = new Map(); // clave → { horas: [ms...], bytes: [[ms, n]...] }
let tamCarpeta = { t: 0, bytes: 0 };

function tamanoCarpeta(dir) {
    if (Date.now() - tamCarpeta.t < 5 * 60000) return tamCarpeta.bytes;
    let total = 0;
    try { for (const f of fs.readdirSync(dir)) { try { total += fs.statSync(path.join(dir, f)).size; } catch { /* borrado mientras tanto */ } } } catch { /* sin carpeta */ }
    tamCarpeta = { t: Date.now(), bytes: total };
    return total;
}

// ¿Puede subir `bytes` ahora? Devuelve null si sí (y lo apunta) o el motivo si no.
function permitir(clave, bytes, { dir = null, ahora = Date.now() } = {}) {
    const u = uso.get(clave) || { horas: [], bytes: [] };
    u.horas = u.horas.filter((t) => ahora - t < HORA);
    u.bytes = u.bytes.filter(([t]) => ahora - t < DIA);
    if (u.horas.length >= MAX_HORA) return 'Has subido muchas imágenes seguidas. Espera un rato.';
    if (u.bytes.reduce((a, [, n]) => a + n, 0) + bytes > MAX_BYTES_DIA) return 'Has llegado al máximo de imágenes de hoy. Prueba mañana.';
    if (dir && tamanoCarpeta(dir) + bytes > MAX_CARPETA) return 'Ahora mismo no se pueden subir más imágenes. Prueba más tarde.';
    u.horas.push(ahora); u.bytes.push([ahora, bytes]);
    uso.set(clave, u);
    if (uso.size > 5000) uso.delete(uso.keys().next().value);
    tamCarpeta.bytes += bytes;
    return null;
}

// Deja solo los `quedar` archivos más nuevos que empiezan por `prefijo` (p. ej. los fondos de una persona).
function limpiarViejos(dir, prefijo, quedar = 3) {
    try {
        const lista = fs.readdirSync(dir).filter((f) => f.startsWith(prefijo))
            .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t);
        for (const { f } of lista.slice(quedar)) fs.unlinkSync(path.join(dir, f));
    } catch { /* limpiar es un extra */ }
}

const _reiniciar = () => { uso.clear(); tamCarpeta = { t: 0, bytes: 0 }; };
module.exports = { permitir, limpiarViejos, MAX_HORA, MAX_BYTES_DIA, MAX_CARPETA, _reiniciar };
