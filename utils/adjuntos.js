// Las URLs de adjuntos de Discord están firmadas y caducan (~24 h). Para que las imágenes
// de los tickets sigan viéndose en el panel, renovamos las que estén a punto de caducar
// usando el endpoint oficial de Discord y guardamos las nuevas en la base de datos.
const Mensaje = require('../models/Mensaje.js');

const HOSTS_DISCORD = ['cdn.discordapp.com', 'media.discordapp.net'];
const MARGEN_SEG = 60 * 10; // renovamos si caducan en menos de 10 minutos

function caducaPronto(url) {
    try {
        const u = new URL(url);
        if (!HOSTS_DISCORD.includes(u.hostname)) return false;
        const ex = u.searchParams.get('ex');
        if (!ex) return false; // URL antigua sin firma: no caduca
        return parseInt(ex, 16) - MARGEN_SEG < Math.floor(Date.now() / 1000);
    } catch {
        return false;
    }
}

// Recibe documentos de Mensaje y devuelve los mismos con las URLs renovadas.
async function refrescarAdjuntos(client, mensajes) {
    const caducadas = [...new Set(mensajes.flatMap(m => (m.imagenes || []).filter(caducaPronto)))];
    if (caducadas.length === 0) return mensajes;

    const nuevas = new Map();
    try {
        for (let i = 0; i < caducadas.length; i += 50) {
            const lote = caducadas.slice(i, i + 50);
            const res = await client.rest.post('/attachments/refresh-urls', { body: { attachment_urls: lote } });
            (res?.refreshed_urls || []).forEach(({ original, refreshed }) => nuevas.set(original, refreshed));
        }
    } catch (error) {
        console.warn('No se pudieron renovar las URLs de adjuntos:', error.message);
        return mensajes;
    }

    for (const msg of mensajes) {
        if (!(msg.imagenes || []).some(url => nuevas.has(url))) continue;
        msg.imagenes = msg.imagenes.map(url => nuevas.get(url) || url);
        await Mensaje.updateOne({ _id: msg._id }, { $set: { imagenes: msg.imagenes } }).catch(() => {});
    }
    return mensajes;
}

module.exports = { refrescarAdjuntos };
