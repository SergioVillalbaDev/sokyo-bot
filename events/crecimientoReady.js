const { Events } = require('discord.js');
const { cachearGuild } = require('../utils/invitaciones.js');

// Al arrancar, guardamos las invitaciones existentes para poder detectar cuál se usa
module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        for (const guild of client.guilds.cache.values()) await cachearGuild(guild);
    }
};
