const { Events } = require('discord.js');
const Log = require('../models/Log.js');
const { getConfig, logActivo } = require('../utils/config.js');
const { revisarEntrada } = require('../utils/antiRaid.js');
const { asignarCohorte, enviarMD } = require('../utils/embudo.js');
const { enviarBienvenida, enviarBienvenidasExtra, apuntarFallo } = require('../utils/bienvenida.js');
const { enviarLogADiscord } = require('../utils/logsManager.js');
const { manejarEntradaServidorSoporte } = require('../utils/soporte.js');
const { registrarEntrada } = require('../utils/invitaciones.js');
const { t } = require('../utils/i18n.js');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member, client) {
        // El servidor de soporte prioritario NO es un servidor de cliente: no lleva
        // autorol/embudo/bienvenida/logs de ese sistema, solo el auto-rol de Premium.
        if (member.guild.id === process.env.SUPPORT_GUILD_ID) {
            try { await manejarEntradaServidorSoporte(member); }
            catch (e) { console.error('Soporte: error en guildMemberAdd:', e.message); }
            return;
        }

        let cfg;
        try {
            cfg = await getConfig(member.guild.id);
        } catch (error) {
            console.error('Error obteniendo config en guildMemberAdd:', error);
            return;
        }

        // --- Crecimiento: ¿con qué invitación ha entrado? (lo antes posible, sin
        // esperar: el resto de la bienvenida no depende de ello) ---
        registrarEntrada(member, client, cfg).catch((e) => console.error('Error registrando la invitación:', e.message));

        // --- Anti-raid + cuentas nuevas/multicuentas ---
        // Si el miembro fue expulsado/baneado, no seguimos con el autorol.
        try {
            if (await revisarEntrada(member, cfg, client)) return;
        } catch (error) { console.error('Error en anti-raid:', error.message); }

        // --- Autorol al entrar (bots y personas usan listas distintas) ---
        try {
            const roles = member.user.bot ? (cfg?.autoRolesBots || []) : (cfg?.autoRoles || []);
            if (roles.length > 0) {
                // Solo los roles que el bot realmente puede asignar (jerarquía).
                const asignables = roles.filter((id) => {
                    const rol = member.guild.roles.cache.get(id);
                    return rol && rol.editable;
                });
                if (asignables.length > 0) {
                    await member.roles.add(asignables).catch((e) => console.error('No se pudo asignar autorol:', e.message));
                }
            }
        } catch (error) { console.error('Error aplicando autorol:', error); }

        // --- Embudo de bienvenida A/B: asignar variante al entrar ---
        // Si la entrega incluye MD, se le manda su onboarding por privado.
        // (la entrega por panel es un botón fijo publicado en el canal)
        try {
            const cohorte = await asignarCohorte(member, cfg);
            const entrega = cfg?.embudoAB?.entrega;
            if (cohorte && !member.user.bot && (entrega === 'md' || entrega === 'ambos')) {
                await enviarMD(member, cfg.embudoAB, cohorte);
            }
        } catch (error) { console.error('Error en embudo de bienvenida:', error.message); }

        // --- Mensaje de bienvenida en el canal (editable, con embed/GIFs) ---
        if (!member.user.bot) {
            try {
                const r = await enviarBienvenida(member, cfg);
                // Encendida pero no ha podido salir (sin permiso, canal borrado…):
                // que el staff lo vea en el Registro y en el canal de logs.
                if (r && r.error && cfg?.bienvenida?.activo) {
                    await apuntarFallo(client, member, cfg, { categoria: 'Entradas', accion: t(cfg, '⚠️ No se pudo dar la bienvenida', '⚠️ The welcome message failed'), error: r.error });
                }
            } catch (error) { console.error('Error en mensaje de bienvenida:', error.message); }

            // Bienvenidas extra que se mandan al entrar (las de «al recibir un rol» van en guildMemberUpdate).
            try {
                for (const { conf, r } of await enviarBienvenidasExtra(member, cfg, { evento: 'entrar' })) {
                    if (r && r.error) await apuntarFallo(client, member, cfg, { categoria: 'Entradas', accion: t(cfg, `⚠️ No se pudo mandar la bienvenida «${conf.nombre || '?'}»`, `⚠️ The “${conf.nombre || '?'}” welcome failed`), error: r.error });
                }
            } catch (error) { console.error('Error en bienvenidas extra:', error.message); }
        }

        // --- Log de entrada (comportamiento existente) ---
        try {
            if (!logActivo(cfg, 'entradas')) return;
            const log = await Log.create({
                guildId: member.guild.id,
                categoria: 'Entradas',
                accion: t(cfg, '👋 El usuario se ha unido', '👋 User joined'),
                usuario: member.user.username,
                detalles: t(cfg, `Cuenta creada el: ${member.user.createdAt.toLocaleDateString('es-ES')}`, `Account created on: ${member.user.createdAt.toLocaleDateString('en-US')}`),
                color: '#2ecc71'
            });
            await enviarLogADiscord(client, log);
        } catch (error) { console.error('Error guardando log Join:', error); }
    }
};
