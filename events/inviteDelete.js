const { Events } = require('discord.js');
const { eliminar } = require('../utils/invitaciones.js');

module.exports = {
    name: Events.InviteDelete,
    execute(invite) {
        if (invite.guild) eliminar(invite.guild.id, invite.code);
    }
};
