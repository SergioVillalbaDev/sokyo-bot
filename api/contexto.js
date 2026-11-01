// Resuelve "quién es este staff y qué puede hacer en este servidor" para cada petición de la API.
// Los permisos se calculan SIEMPRE en el servidor a partir de los roles/permisos reales de Discord
// (nunca se fía de lo que diga el navegador). Caché de 15 s para no consultar Discord en cada clic.
const { calcularPermisos } = require('../utils/permisos.js');
const configCache = require('../utils/configCache.js');

const TTL_MS = 15_000;

module.exports = (client) => {
    const cache = new Map();

    async function contexto(guildId, userId) {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return null;
        const clave = `${guildId}:${userId}`;
        const hit = cache.get(clave);
        if (hit && hit.caduca > Date.now()) return hit.valor;

        const member = await guild.members.fetch(userId).catch(() => null);
        const config = await configCache.obtener(guildId);
        const valor = member ? { guild, member, config, calculo: calcularPermisos(member, config) } : null;
        cache.set(clave, { valor, caduca: Date.now() + TTL_MS });
        return valor;
    }

    const invalidar = (guildId) => {
        configCache.invalidar(guildId);
        for (const k of cache.keys()) if (k.startsWith(`${guildId}:`)) cache.delete(k);
    };

    return { contexto, invalidar };
};
