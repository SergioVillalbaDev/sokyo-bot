const { Events } = require('discord.js');
const Log = require('../models/Log.js');
const ServidorConfig = require('../models/ServidorConfig.js');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        try {
            await Log.create({
                guildId: member.guild.id,
                categoria: 'Entradas',
                accion: '👋 Usuario Entró',
                usuario: member.user.username,
                detalles: `Cuenta creada el: ${member.user.createdAt.toLocaleDateString('es-ES')}`,
                color: '#2ecc71'
            });
        } catch (error) { console.error('Error guardando log Join:', error); }

        // Auto-rol de bienvenida (solo si no hay verificación pendiente: en ese caso el rol lo da el botón).
        try {
            const config = await ServidorConfig.findOne({ guildId: member.guild.id });
            const rolId = config?.bienvenida?.autoRolId;
            if (rolId && !member.user.bot) await member.roles.add(rolId, 'Auto-rol de bienvenida');
        } catch (error) { console.error('Error dando auto-rol:', error.message); }
    }
};
