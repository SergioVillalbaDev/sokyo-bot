const { Events } = require('discord.js');
const Log = require('../models/Log.js');
const { getConfig, logActivo } = require('../utils/config.js');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        try {
            const cfg = await getConfig(member.guild.id);
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