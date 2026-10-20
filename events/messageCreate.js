const { Events } = require('discord.js');
const Mensaje = require('../models/Mensaje.js');
const Ticket = require('../models/Ticket.js');
const { obtenerConfig } = require('../utils/config.js');
const { esStaff } = require('../utils/permisos.js');
const { esCanalTicket } = require('../utils/ticketCache.js');
const { registrarActividad } = require('../utils/ticketManager.js');

// Comandos antiguos con "!": ahora son slash commands. Avisamos en vez de ignorarlos.
const COMANDOS_ANTIGUOS = { sokyo: '/panel', user: '/usuario', dado: '/dado', moneda: '/moneda', ayuda: '/ayuda', help: '/ayuda' };

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot || !message.guild) return;

        // 1. Guardar la conversación de los tickets
        if (esCanalTicket(message.channelId)) {
            const ticket = await Ticket.findOne({ canalId: message.channelId }).select('creadorId').lean();
            if (ticket) {
                const config = await obtenerConfig(message.guildId);
                const staff = message.author.id !== ticket.creadorId && esStaff(message.member, config);
                await Mensaje.create({
                    ticketId: message.channelId,
                    mensajeId: message.id,
                    usuario: message.author.username,
                    usuarioId: message.author.id,
                    avatar: message.author.displayAvatarURL({ extension: 'png', size: 128 }),
                    esStaff: staff,
                    origen: 'discord',
                    contenido: message.content,
                    imagenes: message.attachments.map(adjunto => adjunto.url)
                });
                await registrarActividad(message.channelId, staff);
            }
        }

        // 2. Comandos antiguos
        if (!message.content.startsWith('!')) return;
        const nombre = message.content.slice(1).trim().split(/\s+/)[0]?.toLowerCase();
        const nuevo = COMANDOS_ANTIGUOS[nombre];
        if (nuevo) {
            await message.reply({ content: `ℹ️ Ahora uso comandos de barra: escribe **${nuevo}**.`, allowedMentions: { repliedUser: false } }).catch(() => {});
        }
    }
};
