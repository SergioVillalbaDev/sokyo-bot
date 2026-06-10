const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`🚀 Bienvenidos a la órbita. Logged in as ${client.user.tag}!`);
    },
};