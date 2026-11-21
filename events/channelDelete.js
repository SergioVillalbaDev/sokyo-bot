const { Events } = require('discord.js');
const Ticket = require('../models/Ticket.js');
const ticketCache = require('../utils/ticketCache.js');

// Si borran el canal de un ticket abierto, el ticket pasa a Cerrado (así no cuenta para el límite por usuario).
module.exports = {
    name: Events.ChannelDelete,
    async execute(canal) {
        try {
            ticketCache.quitar(canal.id);
            await Ticket.updateOne({ canalId: canal.id, estado: { $ne: 'Cerrado' } }, { estado: 'Cerrado', fechaCierre: new Date() });
        } catch (error) { console.error('Error cerrando ticket de canal borrado:', error.message); }
    }
};
