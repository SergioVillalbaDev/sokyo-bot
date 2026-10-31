const { Events } = require('discord.js');
const { registrarLog } = require('../utils/logs.js');

module.exports = {
    name: Events.MessageDelete,
    async execute(message, client) {
        if (message.author?.bot || !message.guildId) return;
        const contenido = message.content ? `"${message.content}"` : '*(Mensaje antiguo/sin caché)*';
        const nombreCanal = message.channel?.name ? `#${message.channel.name}` : `Canal ${message.channelId}`;
        await registrarLog(client, {
            guildId: message.guildId,
            categoria: 'Mensajes Borrados',
            accion: '🗑️ Mensaje Borrado',
            usuario: message.author?.username || 'Desconocido',
            detalles: `Canal: ${nombreCanal}\nContenido: ${contenido}`,
            color: '#e74c3c'
        });
    }
};
