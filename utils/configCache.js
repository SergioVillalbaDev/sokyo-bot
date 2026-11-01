// Caché corta de la configuración por servidor: evita una consulta a MongoDB por cada mensaje.
const ServidorConfig = require('../models/ServidorConfig.js');

const TTL_MS = 30_000;
const cache = new Map();

async function obtener(guildId) {
    const hit = cache.get(guildId);
    if (hit && hit.caduca > Date.now()) return hit.config;
    const config = await ServidorConfig.findOne({ guildId });
    cache.set(guildId, { config, caduca: Date.now() + TTL_MS });
    return config;
}

const invalidar = (guildId) => cache.delete(guildId);

module.exports = { obtener, invalidar };
