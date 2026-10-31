const { Events, ActivityType } = require('discord.js');
const ticketCache = require('../utils/ticketCache.js');
const { urlInvitacion } = require('../utils/marca.js');

// Registra los comandos / en Discord. Con DEV_GUILD_ID se registran solo en ese
// servidor (aparecen al instante, útil para probar); si no, de forma global.
async function registrarComandos(client) {
    const definiciones = client.commands.map(c => c.data.toJSON());
    const devGuild = process.env.DEV_GUILD_ID;
    if (devGuild) {
        const guild = await client.guilds.fetch(devGuild);
        await guild.commands.set(definiciones);
        console.log(`✅ ${definiciones.length} comandos / registrados en el servidor de pruebas ${guild.name}`);
    } else {
        await client.application.commands.set(definiciones);
        console.log(`✅ ${definiciones.length} comandos / registrados globalmente`);
    }
}

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`🚀 Bienvenidos a la órbita. Logged in as ${client.user.tag}! (${client.guilds.cache.size} servidores)`);

        client.user.setPresence({
            activities: [{ name: '🎫 /setup · tickets con IA', type: ActivityType.Watching }],
            status: 'online'
        });

        try {
            await registrarComandos(client);
        } catch (e) {
            console.error('❌ No se pudieron registrar los comandos /:', e.message);
        }

        try {
            const total = await ticketCache.cargar();
            console.log(`🎫 ${total} canales de ticket en memoria`);
        } catch (e) {
            console.error('❌ No se pudo cargar la lista de tickets:', e.message);
        }

        const url = urlInvitacion(client.application.id);
        if (url) console.log(`🔗 Enlace para invitar al bot: ${url}`);
    }
};
