// Helpers de configuración por servidor, compartidos por eventos y utilidades.
const ServidorConfig = require('../models/ServidorConfig.js');

// Devuelve la configuración del servidor (o null si no existe / falla).
async function getConfig(guildId) {
    try {
        if (!guildId) return null;
        return await ServidorConfig.findOne({ guildId });
    } catch (e) {
        console.error('Error leyendo ServidorConfig:', e);
        return null;
    }
}

// ¿Está activada esta categoría de logs? Por defecto SÍ (preserva el comportamiento previo).
function logActivo(config, clave) {
    return !(config && config.logsActivos && config.logsActivos[clave] === false);
}

// Caché en memoria (TTL corto) para consultas muy frecuentes como el prefijo,
// que se lee en CADA mensaje. Evita golpear la BD constantemente.
const _cache = new Map();
async function getConfigCached(guildId, ttlMs = 30000) {
    if (!guildId) return null;
    const ahora = Date.now();
    const entrada = _cache.get(guildId);
    if (entrada && (ahora - entrada.t) < ttlMs) return entrada.v;
    const v = await getConfig(guildId);
    _cache.set(guildId, { v, t: ahora });
    return v;
}

module.exports = { getConfig, getConfigCached, logActivo };
