const { Events } = require('discord.js');
const { registrarLog } = require('../utils/logs.js');

module.exports = {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage, client) {
        // Si el mensaje nuevo no está en caché (partial), lo pedimos a Discord
        if (newMessage.partial) {
            try { newMessage = await newMessage.fetch(); } catch { return; }
        }
        if (newMessage.author?.bot || !newMessage.guildId) return;

        // Evita registrar cuando solo se carga un enlace/imagen (mismo contenido).
        if (!oldMessage.partial && oldMessage.content === newMessage.content) return;

        const viejo = oldMessage.partial ? '*(Sin caché)*' : (oldMessage.content || '*(Vacío)*');
        const nuevo = newMessage.content || '*(Vacío)*';
        const nombreCanal = newMessage.channel?.name ? `#${newMessage.channel.name}` : `Canal ${newMessage.channelId}`;

        await registrarLog(client, {
            guildId: newMessage.guildId,
            categoria: 'Mensajes Editados',
            accion: '✏️ Mensaje Editado',
            usuario: newMessage.author?.username || 'Desconocido',
            detalles: `Canal: ${nombreCanal}\n**Antes:** ${viejo}\n**Después:** ${nuevo}`,
            color: '#f1c40f'
        });
    }
};
