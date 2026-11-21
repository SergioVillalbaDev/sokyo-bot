const { Events, ActivityType } = require('discord.js');
const ticketCache = require('../utils/ticketCache.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`🚀 Bienvenidos a la órbita. Logged in as ${client.user.tag}!`);

        client.user.setPresence({
            activities: [{ name: '🎫 tickets de soporte', type: ActivityType.Watching }],
            status: 'online'
        });

        try {
            await ticketCache.cargar();
            console.log('🎫 Caché de tickets abiertos cargada.');
        } catch (error) { console.error('No se pudo cargar la caché de tickets:', error.message); }
    },
};
