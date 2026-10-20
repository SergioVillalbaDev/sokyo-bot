const { Events } = require('discord.js');
const { obtenerConfig } = require('../utils/config.js');

// Al entrar en un servidor nuevo creamos su configuración para que aparezca en el panel web.
module.exports = {
    name: Events.GuildCreate,
    async execute(guild) {
        await obtenerConfig(guild.id);
        console.log(`➕ Añadido al servidor ${guild.name} (${guild.id}).`);
    }
};
