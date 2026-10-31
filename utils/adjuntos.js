// Los enlaces de los adjuntos de Discord caducan (~24 h). Discord permite renovarlos
// con POST /attachments/refresh-urls, así que antes de enseñar imágenes en la web
// renovamos las caducadas y guardamos el enlace nuevo.
const Mensaje = require('../models/Mensaje.js');

const HOSTS_DISCORD = ['cdn.discordapp.com', 'media.discordapp.net'];

function caducaPronto(url) {
    try {
        const u = new URL(url);
        if (!HOSTS_DISCORD.includes(u.hostname)) return false;
        const ex = u.searchParams.get('ex');
        if (!ex) return true; // enlace antiguo sin firma: también se puede renovar
        const caduca = parseInt(ex, 16) * 1000;
        return caduca - Date.now() < 60 * 60 * 1000; // menos de 1 h de vida
    } catch { return false; }
}

async function renovar(client, urls) {
    const resultado = new Map();
    for (let i = 0; i < urls.length; i += 50) {
        const lote = urls.slice(i, i + 50);
        try {
            const res = await client.rest.post('/attachments/refresh-urls', { body: { attachment_urls: lote } });
            (res.refreshed_urls || []).forEach(r => resultado.set(r.original, r.refreshed));
        } catch (e) {
            console.error('No se pudieron renovar enlaces de adjuntos:', e.message);
        }
    }
    return resultado;
}

// Recibe documentos Mensaje (lean u hydrated) y devuelve copias planas con enlaces válidos.
async function conImagenesVigentes(client, mensajes) {
    const planos = mensajes.map(m => (typeof m.toObject === 'function' ? m.toObject() : { ...m }));
    const pendientes = [...new Set(planos.flatMap(m => (m.imagenes || []).filter(caducaPronto)))];
    if (pendientes.length === 0 || !client) return planos;

    const nuevos = await renovar(client, pendientes);
    if (nuevos.size === 0) return planos;

    const actualizaciones = [];
    for (const m of planos) {
        if (!m.imagenes || !m.imagenes.some(u => nuevos.has(u))) continue;
        m.imagenes = m.imagenes.map(u => nuevos.get(u) || u);
        actualizaciones.push({ updateOne: { filter: { _id: m._id }, update: { $set: { imagenes: m.imagenes } } } });
    }
    if (actualizaciones.length > 0) await Mensaje.bulkWrite(actualizaciones).catch(() => {});
    return planos;
}

module.exports = { conImagenesVigentes };
