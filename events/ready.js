const { Events, ActivityType } = require('discord.js');
const { iniciarAutoCierre } = require('../utils/autoClose.js');
const { barrerRolesTemporales } = require('../utils/rolePanelManager.js');
const { barrerSancionesVencidas } = require('../utils/moderationManager.js');

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

        // Barrido de roles temporales vencidos (cada 60 s).
        setInterval(() => barrerRolesTemporales(client).catch((e) => console.error('Barrido temporales:', e.message)), 60000);

        // Barrido de bans temporales vencidos (cada 60 s).
        setInterval(() => barrerSancionesVencidas(client).catch((e) => console.error('Barrido sanciones:', e.message)), 60000);
    },
};
