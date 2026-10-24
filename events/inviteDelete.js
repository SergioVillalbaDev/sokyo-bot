const { Events } = require('discord.js');
const { alBorrarInvitacion } = require('../utils/invitaciones.js');

// Crecimiento · mantiene al día los usos de las invitaciones (utils/invitaciones.js).
module.exports = {
    name: Events.InviteDelete,
    async execute(invite) {
        alBorrarInvitacion(invite);
    },
};
