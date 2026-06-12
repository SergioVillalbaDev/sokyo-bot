const { Events } = require('discord.js');
const Log = require('../models/Log.js');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        try {
            await Log.create({
                guildId: member.guild.id,
                categoria: 'Salidas',
                accion: '🚶‍♂️ Usuario Salió',
                usuario: member.user.username,
                detalles: `Roles que tenía: ${member.roles.cache.size - 1}`,
                color: '#95a5a6'
            });
        } catch (error) { console.error('Error guardando log Leave:', error); }
    }
};