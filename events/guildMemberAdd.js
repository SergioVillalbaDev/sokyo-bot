const { Events } = require('discord.js');
const Log = require('../models/Log.js');
const { getConfig, logActivo } = require('../utils/config.js');
const { revisarEntrada } = require('../utils/antiRaid.js');
const { asignarCohorte, enviarMD } = require('../utils/embudo.js');
const { enviarBienvenida } = require('../utils/bienvenida.js');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member, client) {
        let cfg;
        try {
            cfg = await getConfig(member.guild.id);
        } catch (error) {
            console.error('Error obteniendo config en guildMemberAdd:', error);
            return;
        }

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
            try { await enviarBienvenida(member, cfg); }
            catch (error) { console.error('Error en mensaje de bienvenida:', error.message); }
        }

        // --- Log de entrada (comportamiento existente) ---
        try {
            if (!logActivo(cfg, 'entradas')) return;
            await Log.create({
                guildId: member.guild.id,
                categoria: 'Entradas',
                accion: '👋 Usuario Entró',
                usuario: member.user.username,
                detalles: `Cuenta creada el: ${member.user.createdAt.toLocaleDateString('es-ES')}`,
                color: '#2ecc71'
            });
        } catch (error) { console.error('Error guardando log Join:', error); }
    }
};
