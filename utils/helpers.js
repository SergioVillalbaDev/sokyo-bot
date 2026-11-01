// Funciones puras reutilizables (sin Discord ni base de datos) => fáciles de testear.

// "10m", "2h", "1d", "30" (minutos por defecto), "1h30m" -> milisegundos. null si no es válida.
function parseDuracion(texto) {
    if (texto === undefined || texto === null) return null;
    const s = String(texto).trim().toLowerCase().replace(/\s+/g, '');
    if (!s) return null;
    if (/^\d+$/.test(s)) return parseInt(s, 10) * 60_000;
    const unidades = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };
    const re = /(\d+)([smhdw])/g;
    let total = 0, consumido = 0, m;
    while ((m = re.exec(s)) !== null) { total += parseInt(m[1], 10) * unidades[m[2]]; consumido += m[0].length; }
    if (consumido !== s.length || total <= 0) return null;
    return total;
}

function formatDuracion(ms) {
    if (ms === null || ms === undefined || isNaN(ms)) return '—';
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    if (h < 48) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
    const d = Math.floor(h / 24);
    return h % 24 ? `${d} d ${h % 24} h` : `${d} d`;
}

// Sustituye {usuario} {staff} {ticket} {servidor} en una plantilla.
function renderPlantilla(texto, vars = {}) {
    return String(texto || '').replace(/\{(usuario|staff|ticket|servidor)\}/gi, (_, k) => {
        const v = vars[k.toLowerCase()];
        return v === undefined || v === null ? `{${k}}` : String(v);
    });
}

// Nombre de macro normalizado: minúsculas, sin espacios ni símbolos raros.
function normalizarNombreMacro(n) {
    return String(n || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9áéíóúüñ_-]/g, '').slice(0, 32);
}

// XP necesaria para pasar del nivel n al n+1 (curva tipo MEE6).
const xpNecesario = (n) => 5 * n * n + 50 * n + 100;

// Dado un XP total devuelve { nivel, xpEnNivel, xpSiguiente }.
function nivelDesdeXp(xp) {
    let nivel = 0, resto = Math.max(0, xp);
    while (resto >= xpNecesario(nivel)) { resto -= xpNecesario(nivel); nivel++; }
    return { nivel, xpEnNivel: resto, xpSiguiente: xpNecesario(nivel) };
}

// Extrae los dominios de todas las URLs / invitaciones de un texto.
function extraerDominios(texto) {
    const dominios = [];
    const re = /(?:https?:\/\/|www\.)([a-z0-9][a-z0-9.-]*\.[a-z]{2,})(?:[/:?#]|\b)/gi;
    let m;
    while ((m = re.exec(texto || '')) !== null) dominios.push(m[1].toLowerCase().replace(/^www\./, ''));
    const invitaciones = /(?:discord\.gg|discord(?:app)?\.com\/invite)\/[a-z0-9-]+/gi;
    if (invitaciones.test(texto || '')) dominios.push('discord.gg');
    return [...new Set(dominios)];
}

// ¿Está el dominio en la lista blanca? (acepta subdominios: docs.google.com con "google.com")
function dominioPermitido(dominio, lista = []) {
    const d = String(dominio).toLowerCase();
    return lista.some(p => {
        const permitido = String(p).toLowerCase().replace(/^www\./, '').trim();
        return permitido && (d === permitido || d.endsWith('.' + permitido));
    });
}

// Coincidencias de una FAQ: devuelve los artículos cuyas palabras clave aparecen en el texto.
function buscarArticulos(articulos, texto, max = 3) {
    const t = String(texto || '').toLowerCase();
    return articulos
        .map(a => ({ a, puntos: (a.palabras || []).filter(p => p && t.includes(String(p).toLowerCase())).length }))
        .filter(x => x.puntos > 0)
        .sort((x, y) => y.puntos - x.puntos)
        .slice(0, max)
        .map(x => x.a);
}

// Escapa texto para HTML (transcripciones).
const escaparHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Escapa un campo CSV (con protección básica contra inyección de fórmulas en Excel).
function campoCsv(v) {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const escaparRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = {
    parseDuracion, formatDuracion, renderPlantilla, normalizarNombreMacro, xpNecesario, nivelDesdeXp,
    extraerDominios, dominioPermitido, buscarArticulos, escaparHtml, campoCsv, escaparRegex
};
