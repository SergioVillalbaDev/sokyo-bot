const { Events } = require('discord.js');
const Mensaje = require('../models/Mensaje.js');
const Ticket = require('../models/Ticket.js');
const ticketCache = require('../utils/ticketCache.js');
const { obtenerConfig, buscarMotivo } = require('../utils/config.js');
const { puedeAtender } = require('../utils/permisos.js');

const COMANDOS_ANTIGUOS = { sokyo: '/setup', user: '/usuario', dado: '/dado', moneda: '/moneda' };

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot || !message.guildId) return;

        // 1. Guardar los mensajes de los tickets (para el panel web, la IA y el transcript)
        if (ticketCache.tiene(message.channelId)) {
            try {
                await Mensaje.create({
                    ticketId: message.channelId,
                    usuario: message.author.username,
                    usuarioId: message.author.id,
                    contenido: message.content,
                    imagenes: [...message.attachments.values()].map(a => a.url)
                });

                // Si escribe alguien del staff, se registra para las métricas de respuesta
                const ticket = await Ticket.findOne({ canalId: message.channelId }).select('creadorId motivo motivoId primeraRespuestaStaff').lean();
                if (ticket && ticket.creadorId !== message.author.id && message.member) {
                    const config = await obtenerConfig(message.guildId);
                    if (puedeAtender(message.member, config, buscarMotivo(config, ticket.motivoId || ticket.motivo))) {
                        const ahora = new Date();
                        const cambios = { ultimaInteractStaff: ahora };
                        if (!ticket.primeraRespuestaStaff) cambios.primeraRespuestaStaff = ahora;
                        await Ticket.updateOne({ canalId: message.channelId }, { $set: cambios });
                    }
                }
            } catch (error) {
                console.error('❌ Error al guardar mensaje de ticket:', error);
            }
            return;
        }

        // 2. Aviso para quien siga usando los comandos antiguos con "!"
        const comando = message.content.startsWith('!') ? message.content.slice(1).split(/\s+/)[0].toLowerCase() : null;
        if (comando && COMANDOS_ANTIGUOS[comando]) {
            await message.reply(`ℹ️ Los comandos ahora se usan con barra: prueba **${COMANDOS_ANTIGUOS[comando]}**.`).catch(() => {});
        }
    }
};
