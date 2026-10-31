// Cuando alguien recibe un rol: manda las bienvenidas extra configuradas para ese
// rol (p. ej. la del canal de un juego al coger su rol). Ver utils/bienvenida.js.
const { Events } = require('discord.js');
const { getConfigCached } = require('../utils/config.js');
const { enviarBienvenidasExtra, apuntarFallo } = require('../utils/bienvenida.js');
const { t } = require('../utils/i18n.js');

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(antes, despues, client) {
        // Sin los roles de antes (miembro que no estaba en memoria) no se sabe cuál es
        // nuevo: mejor no mandar nada que repetir bienvenidas.
        if (!antes || antes.partial || !despues || despues.user?.bot) return;
        const nuevos = despues.roles.cache.filter((r) => !antes.roles.cache.has(r.id)).map((r) => r.id);
        if (!nuevos.length) return;
        try {
            const cfg = await getConfigCached(despues.guild.id);
            const hay = (cfg?.bienvenidasExtra || []).some((m) => m && m.activo && m.cuando === 'rol' && nuevos.includes(m.rolId));
            if (!hay) return;
            for (const { conf, r } of await enviarBienvenidasExtra(despues, cfg, { evento: 'rol', rolesNuevos: nuevos })) {
                if (r && r.error) await apuntarFallo(client, despues, cfg, { categoria: 'Entradas', accion: t(cfg, `⚠️ No se pudo mandar la bienvenida «${conf.nombre || '?'}»`, `⚠️ The “${conf.nombre || '?'}” welcome failed`), error: r.error });
            }
        } catch (error) { console.error('Error en bienvenidas por rol:', error.message); }
    },
};
