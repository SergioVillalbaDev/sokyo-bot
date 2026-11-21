// Validación de datos que llegan por la API (el panel o cualquier cliente con la clave).
const HEX = /^#[0-9a-fA-F]{6}$/;
const SNOWFLAKE = /^\d{17,20}$/;

const esTexto = (v) => typeof v === 'string';
const limpio = (v) => (esTexto(v) ? v.trim() : '');

// Mensajes enviados a Discord desde la API (límite real de Discord: 2000, y dejamos hueco al prefijo [usuario]).
function validarMensaje(contenido, max = 1800) {
    const t = limpio(contenido);
    if (!t) return { ok: false, error: 'El mensaje está vacío.' };
    if (t.length > max) return { ok: false, error: `El mensaje supera los ${max} caracteres.` };
    return { ok: true, valor: t };
}

function validarNombreAutor(v, porDefecto = 'Staff') {
    const t = limpio(v).replace(/[\r\n]+/g, ' ');
    if (!t) return porDefecto;
    return t.slice(0, 32);
}

// Motivos del menú de tickets. Discord permite máx. 25 opciones y etiquetas de 1-100 caracteres.
function validarMotivos(entrada) {
    if (!Array.isArray(entrada) || entrada.length < 1 || entrada.length > 25) {
        return { ok: false, error: 'Debe haber entre 1 y 25 motivos.' };
    }
    const vistos = new Set();
    const salida = [];
    for (const m of entrada) {
        const nombre = limpio(typeof m === 'string' ? m : m?.nombre);
        const urgencia = limpio(typeof m === 'string' ? 'Normal' : m?.urgencia) || 'Normal';
        if (!nombre || nombre.length > 100) return { ok: false, error: 'Cada motivo necesita un nombre de 1 a 100 caracteres.' };
        if (urgencia.length > 50) return { ok: false, error: 'El nombre de urgencia es demasiado largo.' };
        if (vistos.has(nombre.toLowerCase())) return { ok: false, error: `Motivo duplicado: ${nombre}` };
        vistos.add(nombre.toLowerCase());
        salida.push({ nombre, urgencia });
    }
    return { ok: true, valor: salida };
}

function validarUrgencias(entrada) {
    if (!Array.isArray(entrada) || entrada.length < 1 || entrada.length > 25) {
        return { ok: false, error: 'Debe haber entre 1 y 25 urgencias.' };
    }
    const vistos = new Set();
    const salida = [];
    for (const u of entrada) {
        const nombre = limpio(u?.nombre);
        const color = limpio(u?.color);
        const nivel = Number(u?.nivel);
        if (!nombre || nombre.length > 50) return { ok: false, error: 'Cada urgencia necesita un nombre de 1 a 50 caracteres.' };
        if (!HEX.test(color)) return { ok: false, error: `Color no válido en "${nombre}" (usa #RRGGBB).` };
        if (!Number.isInteger(nivel) || nivel < 0 || nivel > 100) return { ok: false, error: `Nivel no válido en "${nombre}".` };
        if (vistos.has(nombre.toLowerCase())) return { ok: false, error: `Urgencia duplicada: ${nombre}` };
        vistos.add(nombre.toLowerCase());
        salida.push({ nombre, color, nivel });
    }
    return { ok: true, valor: salida };
}

// Límites de los embeds de Discord: título 256, descripción 4096, footer 2048.
function validarTextos({ titulo, descripcion, footer }) {
    const t = limpio(titulo), d = limpio(descripcion), f = limpio(footer);
    if (!t || t.length > 256) return { ok: false, error: 'El título debe tener de 1 a 256 caracteres.' };
    if (!d || d.length > 4000) return { ok: false, error: 'La descripción debe tener de 1 a 4000 caracteres.' };
    if (f.length > 2048) return { ok: false, error: 'El footer supera los 2048 caracteres.' };
    return { ok: true, valor: { titulo: t, descripcion: d, footer: f } };
}

module.exports = { HEX, SNOWFLAKE, validarMensaje, validarNombreAutor, validarMotivos, validarUrgencias, validarTextos };
