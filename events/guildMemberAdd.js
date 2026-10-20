const { Events } = require('discord.js');
const { obtenerConfig } = require('../utils/config.js');
const { registrarLog } = require('../utils/logger.js');

const DIA_MS = 24 * 60 * 60 * 1000;

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member, client) {
        const config = await obtenerConfig(member.guild.id);
        if (config.modulos?.logsMiembros === false) return;

        const creada = member.user.createdAt;
        const diasCuenta = Math.floor((Date.now() - creada.getTime()) / DIA_MS);
        const aviso = diasCuenta < 7 ? '\n⚠️ Cuenta muy reciente (posible multicuenta)' : '';
        await registrarLog(client, {
            guildId: member.guild.id,
            categoria: 'Entradas',
            accion: '👋 Usuario Entró',
            usuario: member.user.username,
            usuarioId: member.id,
            detalles: `<@${member.id}> · Cuenta creada el ${creada.toLocaleDateString('es-ES')} (hace ${diasCuenta} días)\nMiembros ahora: ${member.guild.memberCount}${aviso}`,
            color: '#2ecc71'
        });
    }
};
