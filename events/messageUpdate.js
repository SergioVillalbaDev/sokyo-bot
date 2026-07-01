const { Events } = require('discord.js');
const Log = require('../models/Log.js');
const { getConfig, logActivo } = require('../utils/config.js');
const { enviarLogADiscord } = require('../utils/logsManager.js');

module.exports = {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage, client) {
        try {
            // Si el mensaje nuevo no está en caché (partial), lo pedimos a Discord
            if (newMessage.partial) {
                try { newMessage = await newMessage.fetch(); } catch { return; }
            }

            if (newMessage.author?.bot) return;

            const cfg = await getConfig(newMessage.guildId);
            if (!logActivo(cfg, 'mensajesEditados')) return;

            // Evita registrar cuando solo se carga un enlace/imagen (mismo contenido).
            // Si el mensaje viejo era partial no tenemos su contenido, así que dejamos pasar.
            if (!oldMessage.partial && oldMessage.content === newMessage.content) return;

            const viejo = oldMessage.partial ? '*(Not cached)*' : (oldMessage.content || '*(Empty)*');
            const nuevo = newMessage.content || '*(Empty)*';
            const nombreCanal = newMessage.channel?.name ? `#${newMessage.channel.name}` : `Channel ${newMessage.channelId}`;
            const imagenes = newMessage.attachments ? [...newMessage.attachments.values()].map((a) => a.url) : [];

            const log = await Log.create({
                guildId: newMessage.guildId,
                categoria: 'Mensajes Editados',
                accion: '✏️ Message edited',
                usuario: newMessage.author?.username || 'Unknown',
                detalles: `Channel: ${nombreCanal}\n**Before:** ${viejo}\n**After:** ${nuevo}`,
                imagenes,
                color: '#f1c40f'
            });
            await enviarLogADiscord(client, log);
        } catch (error) { console.error('Error guardando log Update:', error); }
    }
};
