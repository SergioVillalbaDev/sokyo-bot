const { Events } = require('discord.js');
const Log = require('../models/Log.js');
const { esCanalPublico, recortar } = require('../utils/privacidad.js');

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        if (!message.guildId || message.author?.bot) return;
        if (!esCanalPublico(message)) return; // nunca registramos el contenido de canales privados
        try {
            const contenido = message.content ? `"${recortar(message.content)}"` : '*(Mensaje antiguo/sin caché)*';
            const nombreCanal = message.channel?.name ? `#${message.channel.name}` : `Canal ${message.channelId}`;
            await Log.create({
                guildId: message.guildId,
                categoria: 'Mensajes Borrados',
                accion: '🗑️ Mensaje Borrado',
                usuario: message.author?.username || 'Desconocido',
                detalles: `Canal: ${nombreCanal}\nContenido: ${contenido}`,
                color: '#e74c3c'
            });
        } catch (error) { console.error('Error guardando log Delete:', error); }
    }
};
