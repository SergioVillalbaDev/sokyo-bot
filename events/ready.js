const { Events, ActivityType } = require('discord.js');
const { iniciarAutoCierre } = require('../utils/autoClose.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`🚀 Bienvenidos a la órbita. Logged in as ${client.user.tag}!`);

        client.user.setPresence({
            activities: [{ name: '🎫 tickets de soporte', type: ActivityType.Watching }],
            status: 'online'
        });

        // Arranca el barrido de auto-cierre por inactividad (configurable por servidor).
        iniciarAutoCierre(client);
    },
};
