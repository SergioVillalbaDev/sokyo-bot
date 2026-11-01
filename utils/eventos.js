// Bus de eventos en vivo para el panel (Server-Sent Events).
// El resto del bot llama a emitir(guildId, tipo, datos); la API reparte el evento solo a las
// conexiones del staff que tienen permiso para verlo.

const conexiones = new Set(); // { res, puede(guildId):boolean }

function suscribir(conexion) {
    conexiones.add(conexion);
    return () => conexiones.delete(conexion);
}

function emitir(guildId, tipo, datos = {}) {
    const payload = `event: ${tipo}\ndata: ${JSON.stringify({ guildId, ...datos })}\n\n`;
    for (const c of conexiones) {
        try { if (c.puede(guildId)) c.res.write(payload); } catch { conexiones.delete(c); }
    }
}

module.exports = { suscribir, emitir, _total: () => conexiones.size };
