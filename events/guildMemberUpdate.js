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
        // Seguridad (1.13.0): si con sus roles nuevos alguien gana o pierde el acceso al panel, se avisa.
        avisarCambioDeAcceso(antes, despues, client).catch((e) => console.error('Alerta de acceso:', e.message));
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

async function avisarCambioDeAcceso(antes, despues, client) {
    const mismos = antes.roles.cache.size === despues.roles.cache.size && antes.roles.cache.every((r) => despues.roles.cache.has(r.id));
    if (mismos) return;
    const acceso = require('../utils/accesoPanel.js');
    const AccesoPersona = require('../models/AccesoPersona.js');
    const { OWNER_IDS } = require('../utils/propietarios.js');
    const cfg = (await getConfigCached(despues.guild.id)) || {};
    const c = await AccesoPersona.findOne({ guildId: despues.guild.id, userId: despues.id }).lean().catch(() => null);
    const ya = acceso.calcularAcceso(acceso.datosMiembro(antes, { ownerIds: OWNER_IDS }), cfg, c);
    const ahora = acceso.calcularAcceso(acceso.datosMiembro(despues, { ownerIds: OWNER_IDS }), cfg, c);
    if (ya.acceso === ahora.acceso) return;
    await acceso.alertaSeguridad(client, despues.guild.id, ahora.acceso
        ? { accion: t(cfg, '🔓 Alguien nuevo puede entrar al panel', '🔓 Someone new can open the panel'), usuario: despues.user.username, detalles: t(cfg, `<@${despues.id}> ahora puede entrar al panel de Sokyo por sus roles de Discord.`, `<@${despues.id}> can now open the Sokyo panel because of their Discord roles.`), color: '#f59e0b' }
        : { accion: t(cfg, '🔒 Alguien ya no puede entrar al panel', '🔒 Someone can no longer open the panel'), usuario: despues.user.username, detalles: t(cfg, `<@${despues.id}> ha perdido el acceso al panel de Sokyo (le han quitado un rol o un permiso).`, `<@${despues.id}> lost access to the Sokyo panel (a role or permission was removed).`), color: '#94a3b8' });
}

