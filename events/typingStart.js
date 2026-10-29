const { Events } = require('discord.js');
const { marcarEscribiendo } = require('../utils/escribiendo.js');

// Alguien escribe en un ticket desde Discord: el chat del panel enseña
// «Fulano está escribiendo…» (lo pregunta cada pocos segundos).
module.exports = {
    name: Events.TypingStart,
    async execute(typing) {
        const canal = typing.channel;
        if (!canal?.name?.startsWith('ticket-') || typing.user?.bot) return;
        const nombre = typing.member?.displayName || typing.user?.globalName || typing.user?.username || '';
        marcarEscribiendo(canal.id, { id: typing.user.id, nombre, origen: 'discord' });
    },
};
