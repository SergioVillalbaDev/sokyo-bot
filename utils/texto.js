// Pequeñas utilidades de texto compartidas.

// Recorta un texto al máximo indicado añadiendo "…" (los límites de Discord son estrictos).
function truncar(texto, max) {
    const str = String(texto ?? '');
    return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

// Convierte un nombre en algo válido para un canal de Discord: minúsculas, sin acentos ni símbolos.
function slug(texto, max = 20) {
    const limpio = String(texto ?? '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, max)
        .replace(/-+$/g, '');
    return limpio || 'usuario';
}

// Escapa texto para insertarlo en HTML.
function escaparHtml(texto) {
    return String(texto ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Cita un bloque de texto en Markdown de Discord.
function citar(texto) {
    return String(texto ?? '').split('\n').map(linea => `> ${linea}`).join('\n');
}

module.exports = { truncar, slug, escaparHtml, citar };
