const { Events, ActivityType } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`🚀 Bienvenidos a la órbita. Logged in as ${client.user.tag}!`);

        client.user.setPresence({
            activities: [{ name: '🎫 tickets de soporte', type: ActivityType.Watching }],
            status: 'online'
        });
    },
};
