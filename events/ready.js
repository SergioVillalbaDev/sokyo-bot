const { Events, ActivityType } = require('discord.js');
const { iniciarAutoCierre } = require('../utils/autoClose.js');
const { iniciarProgramador } = require('../utils/scheduler.js');
const { barrerRolesTemporales } = require('../utils/rolePanelManager.js');
const { barrerSancionesVencidas } = require('../utils/moderationManager.js');
const { registrarVoz } = require('../utils/actividad.js');
const { otorgarXpVoz } = require('../utils/niveles.js');
const { getConfigCached } = require('../utils/config.js');

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

        // Arranca el programador de anuncios programados y recordatorios.
        iniciarProgramador(client);

        // Barrido de roles temporales vencidos (cada 60 s).
        setInterval(() => barrerRolesTemporales(client).catch((e) => console.error('Barrido temporales:', e.message)), 60000);

        // Barrido de bans temporales vencidos (cada 60 s).
        setInterval(() => barrerSancionesVencidas(client).catch((e) => console.error('Barrido sanciones:', e.message)), 60000);

        // XP por voz: cada minuto, a quien esté en un canal de voz (acompañado).
        setInterval(async () => {
            for (const guild of client.guilds.cache.values()) {
                try {
                    const cfg = await getConfigCached(guild.id);
                    if (!cfg?.nivelesActivo || !cfg.xpVozActivo) continue;
                    for (const vs of guild.voiceStates.cache.values()) {
                        if (!vs.channelId || !vs.member || vs.member.user.bot) continue;
                        const canal = guild.channels.cache.get(vs.channelId);
                        const humanos = canal ? canal.members.filter((m) => !m.user.bot).size : 0;
                        if (humanos < 2) continue; // no XP si está solo
                        await otorgarXpVoz(vs.member, cfg).catch(() => {});
                    }
                } catch (e) { console.error('Error en XP de voz:', e.message); }
            }
        }, 60000);

        // Registrar a quien YA esté en voz al arrancar (los eventos solo capturan cambios futuros).
        for (const guild of client.guilds.cache.values()) {
            for (const vs of guild.voiceStates.cache.values()) {
                if (vs.channelId && vs.member && !vs.member.user.bot) {
                    registrarVoz(guild.id, vs.member, vs.channelId).catch(() => {});
                }
            }
        }
    },
};
