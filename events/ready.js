const { Events, ActivityType } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { registrarComandos } = require('../utils/registrarComandos.js');
const inactividad = require('../utils/inactividad.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`🚀 Bienvenidos a la órbita. Logged in as ${client.user.tag}!`);

        client.user.setPresence({
            activities: [{ name: '🎫 tickets de soporte', type: ActivityType.Watching }],
            status: 'online'
        });

        // Cada servidor tiene su configuración y sus comandos "/" (registro instantáneo por servidor).
        for (const guild of client.guilds.cache.values()) {
            await ServidorConfig.updateOne({ guildId: guild.id }, { $setOnInsert: { guildId: guild.id } }, { upsert: true }).catch(() => {});
            await registrarComandos(client, guild);
        }

        inactividad.iniciar(client);
    },
};
