const { Events, ActivityType } = require('discord.js');
const Ticket = require('../models/Ticket.js');
const { obtenerConfig } = require('../utils/config.js');
const { cargarCanalesTicket } = require('../utils/ticketCache.js');
const { marcarCanalEliminado } = require('../utils/ticketManager.js');
const { anunciarActualizacion } = require('../utils/anuncioActualizacion.js');
const { iniciarAutoCierre } = require('../utils/autoCierre.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`🚀 Bienvenidos a la órbita. Conectado como ${client.user.tag} en ${client.guilds.cache.size} servidor(es).`);

        client.user.setPresence({
            activities: [{ name: '🎫 tickets de soporte · /ayuda', type: ActivityType.Watching }],
            status: 'online'
        });

        // 1. Registrar los slash commands. Con GUILD_ID_DEV se registran solo en ese servidor
        //    (aparecen al instante, ideal para pruebas); si no, de forma global.
        try {
            const definiciones = client.commands.map(c => c.data.toJSON());
            const servidorDev = process.env.GUILD_ID_DEV && client.guilds.cache.get(process.env.GUILD_ID_DEV);
            if (servidorDev) await servidorDev.commands.set(definiciones);
            else await client.application.commands.set(definiciones);
            console.log(`✅ Slash commands registrados ${servidorDev ? `en ${servidorDev.name}` : 'globalmente'}.`);
        } catch (error) {
            console.error('❌ No se pudieron registrar los slash commands:', error.message);
        }

        // 2. Asegurar que todos los servidores tienen configuración (el panel la necesita).
        for (const guild of client.guilds.cache.values()) {
            await obtenerConfig(guild.id).catch(e => console.error(`Config de ${guild.name}:`, e.message));
        }

        // 3. Tickets cuyos canales se borraron mientras el bot estaba apagado.
        //    Ignoramos servidores no disponibles (caída de Discord): llegan sin canales.
        const guildIds = client.guilds.cache.filter(g => g.available).map(g => g.id);
        const tickets = await Ticket.find({ guildId: { $in: guildIds }, canalEliminado: { $ne: true } }).select('canalId guildId').lean();
        let huerfanos = 0;
        for (const { canalId, guildId } of tickets) {
            if (!client.guilds.cache.get(guildId).channels.cache.has(canalId)) {
                await marcarCanalEliminado(client, canalId, 'Canal eliminado (bot desconectado)');
                huerfanos++;
            }
        }
        if (huerfanos) console.log(`🧹 ${huerfanos} ticket(s) marcados como cerrados porque su canal ya no existe.`);

        const total = await cargarCanalesTicket();
        console.log(`🎫 ${total} canales de ticket en seguimiento.`);

        // 4. "Bot actualizado": en segundo plano, solo la primera vez que arranca esta versión.
        anunciarActualizacion(client).catch(e => console.error('📣 Aviso de actualización:', e));

        // 5. Cierre automático de tickets inactivos (cada 10 minutos, en los servidores que lo activen).
        iniciarAutoCierre(client);
    }
};
