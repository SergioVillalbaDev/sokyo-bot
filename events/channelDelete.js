const { Events } = require('discord.js');
const { esCanalTicket } = require('../utils/ticketCache.js');
const { marcarCanalEliminado } = require('../utils/ticketManager.js');

// Si alguien borra a mano el canal de un ticket, lo damos por cerrado (los datos se conservan).
module.exports = {
    name: Events.ChannelDelete,
    async execute(channel, client) {
        if (!esCanalTicket(channel.id)) return;
        await marcarCanalEliminado(client, channel.id);
    }
};
