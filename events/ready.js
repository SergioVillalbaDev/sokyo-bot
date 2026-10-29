const { Events, ActivityType } = require('discord.js');
const { iniciarAutoCierre } = require('../utils/autoClose.js');
const { iniciarProgramador } = require('../utils/scheduler.js');
const { barrerRolesTemporales } = require('../utils/rolePanelManager.js');
const { barrerSancionesVencidas } = require('../utils/moderationManager.js');
const { registrarVoz } = require('../utils/actividad.js');
const { otorgarXpVoz } = require('../utils/niveles.js');
const { getConfigCached } = require('../utils/config.js');
const { barrerCanales: barrerCanalesVoz } = require('../utils/vozTemporal.js');
const { anunciarActualizacion } = require('../utils/anuncioActualizacion.js');
const { adaptarTodos } = require('../utils/textosPorDefecto.js');
const { esperarMongo } = require('../utils/config.js');
const { cargarTodas: cargarInvitaciones } = require('../utils/invitaciones.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`🚀 Bienvenidos a la órbita. Logged in as ${client.user.tag}!`);

        // Estado rotativo: cada vistazo a la lista de miembros muestra un gancho distinto
        // (ticket, moderación, niveles, música, economía, posicionamiento) en vez de
        // anclarse solo a tickets. Sin contador de servidores: con pocos, resta más de lo que suma.
        const presencias = [
            () => ({ name: '🎫 Support Tickets', type: ActivityType.Watching }),
            () => ({ name: '🛡️ Your Server 24/7', type: ActivityType.Watching }),
            () => ({ name: '📈 XP Roll In', type: ActivityType.Watching }),
            () => ({ name: '🎧 Lofi & Bangers', type: ActivityType.Listening }),
            () => ({ name: '🎉 Giveaways & Polls', type: ActivityType.Watching }),
            () => ({ name: '🤖 5 Bots, 1 Brain', type: ActivityType.Watching }),
        ];
        let presenciaIdx = 0;
        const rotarPresencia = () => {
            client.user.setPresence({ activities: [presencias[presenciaIdx % presencias.length]()], status: 'online' });
            presenciaIdx++;
        };
        rotarPresencia();
        setInterval(rotarPresencia, 25000);

        // Textos de fábrica de cada servidor en su idioma (p. ej. "Abrir un ticket" en español).
        esperarMongo().then(adaptarTodos).catch((e) => console.error('Adaptar textos al idioma:', e.message));

        // Memoria de los ausentes, los mensajes fijos y las salas de los grupos (se miran a menudo).
        esperarMongo().then(() => Promise.all([
            require('../utils/ausente.js').cargar(),
            require('../utils/mensajesFijos.js').cargar(),
            require('../utils/grupos.js').cargarSalas(),
        ])).catch((e) => console.error('Cargar ausentes / mensajes fijos / grupos:', e.message));

        // Crecimiento: usos actuales de las invitaciones (para saber quién invita a quién).
        esperarMongo().then(() => cargarInvitaciones(client)).catch((e) => console.error('Cargar invitaciones:', e.message));

        // Primera vez con una versión nueva: avisar de "Bot actualizado" (ANUNCIO_SERVIDOR).
        anunciarActualizacion(client).catch((e) => console.error('Aviso de actualización:', e.message));

        // Arranca el barrido de auto-cierre por inactividad (configurable por servidor).
        iniciarAutoCierre(client);

        // Arranca el programador de anuncios programados y recordatorios.
        iniciarProgramador(client);

        // Barrido de roles temporales vencidos (cada 60 s).
        setInterval(() => barrerRolesTemporales(client).catch((e) => console.error('Barrido temporales:', e.message)), 60000);

        // Barrido de bans temporales vencidos (cada 60 s).
        setInterval(() => barrerSancionesVencidas(client).catch((e) => console.error('Barrido sanciones:', e.message)), 60000);

        // Limpieza de canales de voz temporales huérfanos/vacíos al arrancar.
        barrerCanalesVoz(client).catch((e) => console.error('Barrido voz temporal:', e.message));

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
