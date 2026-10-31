// Si alguien borra a mano el canal de un ticket, el ticket se marca como cerrado
// para que no cuente como abierto (ni bloquee al usuario por el límite de tickets).
const { Events } = require('discord.js');
const Ticket = require('../models/Ticket.js');
const ticketCache = require('../utils/ticketCache.js');

module.exports = {
    name: Events.ChannelDelete,
    async execute(channel) {
        if (!ticketCache.tiene(channel.id)) return;
        ticketCache.quitar(channel.id);
        try {
            await Ticket.updateOne({ canalId: channel.id, fechaCierre: null }, { fechaCierre: new Date() });
            await Ticket.updateOne({ canalId: channel.id }, { canalBorrado: true, estado: 'Cerrado' });
        } catch (e) {
            console.error('Error marcando ticket borrado:', e);
        }
    }
};
