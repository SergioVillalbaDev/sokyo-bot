const { Events } = require('discord.js');
const Log = require('../models/Log.js');
const { getConfig, logActivo } = require('../utils/config.js');
const { enviarLogADiscord } = require('../utils/logsManager.js');

module.exports = {
    name: Events.MessageDelete,
    async execute(message, client) {
        if (message.author?.bot) return;
        try {
            const cfg = await getConfig(message.guildId);
            if (!logActivo(cfg, 'mensajesBorrados')) return;
            const contenido = message.content ? `"${message.content}"` : '*(Old message / not cached)*';
            const nombreCanal = message.channel?.name ? `#${message.channel.name}` : `Channel ${message.channelId}`;
            const imagenes = message.attachments ? [...message.attachments.values()].map((a) => a.url) : [];
            const log = await Log.create({
                guildId: message.guildId,
                categoria: 'Mensajes Borrados',
                accion: '🗑️ Message deleted',
                usuario: message.author?.username || 'Unknown',
                detalles: `Channel: ${nombreCanal}\nContent: ${contenido}`,
                imagenes,
                color: '#e74c3c'
            });
            await enviarLogADiscord(client, log);
        } catch (error) { console.error('Error guardando log Delete:', error); }
    }
};
