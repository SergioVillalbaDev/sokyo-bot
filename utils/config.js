// Acceso a la configuración de cada servidor con una caché corta en memoria.
// Si un servidor todavía no tiene configuración, se crea con los valores por defecto,
// así el panel web y los comandos siempre tienen algo con lo que trabajar.
const ServidorConfig = require('../models/ServidorConfig.js');

const TTL_MS = 30 * 1000;
const cache = new Map(); // guildId -> { doc, expira }

async function obtenerConfig(guildId) {
    const enCache = cache.get(guildId);
    if (enCache && enCache.expira > Date.now()) return enCache.doc;

    let doc = await ServidorConfig.findOne({ guildId });
    if (!doc) {
        try {
            doc = await ServidorConfig.create({ guildId });
        } catch (error) {
            // Otra petición la creó a la vez: la leemos.
            if (error.code !== 11000) throw error;
            doc = await ServidorConfig.findOne({ guildId });
        }
    }
    cache.set(guildId, { doc, expira: Date.now() + TTL_MS });
    return doc;
}

// Aplica cambios y refresca la caché. Devuelve el documento actualizado.
async function actualizarConfig(guildId, cambios) {
    const doc = await ServidorConfig.findOneAndUpdate(
        { guildId },
        { $set: cambios },
        { returnDocument: 'after', upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    cache.set(guildId, { doc, expira: Date.now() + TTL_MS });
    return doc;
}

function invalidarConfig(guildId) {
    cache.delete(guildId);
}

module.exports = { obtenerConfig, actualizarConfig, invalidarConfig };
