const { Events } = require('discord.js');
const { registrar } = require('../utils/invitaciones.js');

module.exports = {
    name: Events.InviteCreate,
    execute(invite) {
        if (invite.guild) registrar(invite.guild.id, invite.code, invite.uses ?? 0);
    }
};
