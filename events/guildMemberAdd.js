const { Events } = require('discord.js');
const Log = require('../models/Log.js');
const { getConfig, logActivo } = require('../utils/config.js');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        let cfg;
        try {
            cfg = await getConfig(member.guild.id);
        } catch (error) {
            console.error('Error obteniendo config en guildMemberAdd:', error);
            return;
        }

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
