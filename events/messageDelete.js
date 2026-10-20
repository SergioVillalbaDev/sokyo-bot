const { Events, escapeMarkdown } = require('discord.js');
const Mensaje = require('../models/Mensaje.js');
const { obtenerConfig } = require('../utils/config.js');
const { registrarLog } = require('../utils/logger.js');
const { esCanalTicket } = require('../utils/ticketCache.js');
const { truncar } = require('../utils/texto.js');

module.exports = {
    name: Events.MessageDelete,
    async execute(message, client) {
        if (!message.guildId || message.author?.bot) return;

        // En los tickets no lo borramos de la conversación: lo marcamos (útil para el staff).
        if (esCanalTicket(message.channelId)) {
            await Mensaje.updateOne({ mensajeId: message.id }, { $set: { borrado: true } });
        }

        const config = await obtenerConfig(message.guildId);
        if (config.modulos?.logsMensajes === false) return;

        const contenido = message.partial
            ? '*(no disponible: el mensaje era anterior al arranque del bot)*'
            : (message.content ? `"${truncar(escapeMarkdown(message.content), 3500)}"` : '*(sin texto)*');
        const adjuntos = message.attachments?.size ? `\nAdjuntos: ${message.attachments.size}` : '';
        await registrarLog(client, {
            guildId: message.guildId,
            categoria: 'Mensajes Borrados',
            accion: '🗑️ Mensaje Borrado',
            usuario: message.author?.username || 'Desconocido',
            usuarioId: message.author?.id || null,
            detalles: `Canal: <#${message.channelId}>\nContenido: ${contenido}${adjuntos}`,
            color: '#e74c3c'
        });
    }
};
