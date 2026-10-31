const { Events } = require('discord.js');
const { registrarLog } = require('../utils/logs.js');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member, client) {
        const estuvo = member.joinedTimestamp ? Math.floor((Date.now() - member.joinedTimestamp) / 86400000) : null;
        await registrarLog(client, {
            guildId: member.guild.id,
            categoria: 'Salidas',
            accion: '🚶‍♂️ Usuario Salió',
            usuario: member.user.username,
            detalles: `Roles que tenía: ${Math.max(0, (member.roles?.cache.size || 1) - 1)}${estuvo !== null ? `\nEstuvo en el servidor: ${estuvo} días` : ''}`,
            color: '#95a5a6'
        });
    }
};
