const { Events } = require('discord.js');
const Log = require('../models/Log.js');

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        if (message.author?.bot) return;
        try {
            const contenido = message.content ? `"${message.content}"` : '*(Mensaje antiguo/sin caché)*';
            await Log.create({
                guildId: message.guildId,
                categoria: 'Mensajes Borrados',
                accion: '🗑️ Mensaje Borrado',
                usuario: message.author?.username || 'Desconocido',
                detalles: `Canal: <#${message.channelId}>\nContenido: ${contenido}`,
                color: '#e74c3c'
            });
        } catch (error) { console.error('Error guardando log Delete:', error); }
    }
};