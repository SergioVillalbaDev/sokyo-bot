const { Events } = require('discord.js');
const { registrarLog } = require('../utils/logs.js');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member, client) {
        const dias = Math.floor((Date.now() - member.user.createdTimestamp) / 86400000);
        await registrarLog(client, {
            guildId: member.guild.id,
            categoria: 'Entradas',
            accion: dias < 7 ? '⚠️ Usuario Entró (cuenta nueva)' : '👋 Usuario Entró',
            usuario: member.user.username,
            detalles: `Cuenta creada el: ${member.user.createdAt.toLocaleDateString('es-ES')} (hace ${dias} días)`,
            color: dias < 7 ? '#e67e22' : '#2ecc71'
        });
    }
};
