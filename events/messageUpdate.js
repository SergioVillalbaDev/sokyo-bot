const { Events, escapeMarkdown } = require('discord.js');
const Mensaje = require('../models/Mensaje.js');
const { obtenerConfig } = require('../utils/config.js');
const { registrarLog } = require('../utils/logger.js');
const { esCanalTicket } = require('../utils/ticketCache.js');
const { truncar } = require('../utils/texto.js');

module.exports = {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage, client) {
        if (!newMessage.guildId) return;

        // Si el mensaje nuevo no está en caché (partial), lo pedimos a Discord
        if (newMessage.partial) {
            try { newMessage = await newMessage.fetch(); } catch { return; }
        }
        if (newMessage.author?.bot) return;

        // Discord también emite "update" al cargar la vista previa de un enlace. Si no hay fecha
        // de edición, o el texto no cambió, no es una edición real.
        if (!newMessage.editedTimestamp) return;
        if (!oldMessage.partial && oldMessage.content === newMessage.content) return;

        // Mantener al día la conversación guardada del ticket
        if (esCanalTicket(newMessage.channelId)) {
            await Mensaje.updateOne({ mensajeId: newMessage.id }, { $set: { contenido: newMessage.content, editado: true } });
        }

        const config = await obtenerConfig(newMessage.guildId);
        if (config.modulos?.logsMensajes === false) return;

        const viejo = oldMessage.partial ? '*(no disponible: el mensaje era anterior al arranque del bot)*' : (oldMessage.content || '*(vacío)*');
        const nuevo = newMessage.content || '*(vacío)*';
        await registrarLog(client, {
            guildId: newMessage.guildId,
            categoria: 'Mensajes Editados',
            accion: '✏️ Mensaje Editado',
            usuario: newMessage.author?.username || 'Desconocido',
            usuarioId: newMessage.author?.id || null,
            detalles: `Canal: <#${newMessage.channelId}> · [Ir al mensaje](${newMessage.url})\n**Antes:** ${truncar(oldMessage.partial ? viejo : escapeMarkdown(viejo), 1800)}\n**Después:** ${truncar(escapeMarkdown(nuevo), 1800)}`,
            color: '#f1c40f'
        });
    }
};
