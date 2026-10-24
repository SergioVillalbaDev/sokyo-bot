const { Events } = require('discord.js');
const { alCrearInvitacion } = require('../utils/invitaciones.js');

// Crecimiento · mantiene al día los usos de las invitaciones (utils/invitaciones.js).
module.exports = {
    name: Events.InviteCreate,
    async execute(invite) {
        alCrearInvitacion(invite);
    },
};
