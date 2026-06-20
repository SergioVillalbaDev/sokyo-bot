// Auto-respuestas / triggers: si un mensaje coincide con un patrón configurado,
// el bot responde automáticamente (FAQs automáticas). Se engancha en
// messageCreate solo para mensajes que NO son comandos.
const { construirMensaje } = require('./embeds.js');

// Cooldown en memoria por (guild:patron) para no spamear si varios escriben a la vez.
const ultimas = new Map();
const COOLDOWN_MS = 8000;

function coincide(texto, patron, tipo) {
    if (tipo === 'exacto') return texto === patron;
    if (tipo === 'empieza') return texto.startsWith(patron);
    return texto.includes(patron); // 'contiene' (por defecto)
}

// Devuelve true si alguna auto-respuesta coincidió (haya respondido o esté en cooldown).
async function revisarAutoRespuestas(message, cfg) {
    if (!cfg || !Array.isArray(cfg.autoRespuestas) || cfg.autoRespuestas.length === 0) return false;
    const texto = (message.content || '').toLowerCase().trim();
    if (!texto) return false;

    for (const ar of cfg.autoRespuestas) {
        if (!ar || !ar.activo || !ar.patron || !ar.respuesta) continue;
        if (!coincide(texto, String(ar.patron).toLowerCase().trim(), ar.tipo)) continue;

        const clave = `${message.guildId}:${ar.patron}`;
        const ahora = Date.now();
        if (ahora - (ultimas.get(clave) || 0) < COOLDOWN_MS) return true; // en cooldown
        ultimas.set(clave, ahora);

        try {
            const payload = ar.comoEmbed
                ? construirMensaje('', { descripcion: ar.respuesta, color: '#5865F2' })
                : { content: String(ar.respuesta).slice(0, 2000) };
            await message.channel.send(payload);
            if (ar.eliminarMensaje) await message.delete().catch(() => {});
        } catch (e) {
            console.error('Error en auto-respuesta:', e.message);
        }
        return true; // solo dispara la primera coincidencia
    }
    return false;
}

module.exports = { revisarAutoRespuestas };
