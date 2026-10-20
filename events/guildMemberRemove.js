const { Events } = require('discord.js');
const { obtenerConfig } = require('../utils/config.js');
const { registrarLog } = require('../utils/logger.js');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member, client) {
        const config = await obtenerConfig(member.guild.id);
        if (config.modulos?.logsMiembros === false) return;

        // Si el miembro no estaba en caché (partial) no conocemos sus roles.
        const roles = member.partial
            ? 'desconocidos'
            : (member.roles.cache.filter(r => r.id !== member.guild.id).map(r => r.name).join(', ') || 'ninguno');
        const tiempo = member.joinedAt ? `\nEstuvo desde el ${member.joinedAt.toLocaleDateString('es-ES')}` : '';
        await registrarLog(client, {
            guildId: member.guild.id,
            categoria: 'Salidas',
            accion: '🚶 Usuario Salió',
            usuario: member.user?.username || 'Desconocido',
            usuarioId: member.id,
            detalles: `<@${member.id}> · Roles: ${roles}${tiempo}\nMiembros ahora: ${member.guild.memberCount}`,
            color: '#95a5a6'
        });
    }
};
