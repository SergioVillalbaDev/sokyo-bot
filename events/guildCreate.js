const { Events, ChannelType, PermissionsBitField } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { construirBienvenida, construirSaludoPublico, cargarMensajeEntrada } = require('../utils/onboarding.js');
const { cargarInvitaciones } = require('../utils/invitaciones.js');

module.exports = {
    name: Events.GuildCreate,
    async execute(guild) {
        try {
            // 1. Crear la configuración del servidor si aún no existe.
            let config = await ServidorConfig.findOne({ guildId: guild.id });
            // 2.0.0: un servidor nuevo habla el idioma de su comunidad desde el primer mensaje
            // (Discord dice el idioma del servidor: es-ES, es-419…). Se cambia con /idioma o en el panel.
            if (!config) {
                config = await ServidorConfig.create({ guildId: guild.id, idioma: /^es/i.test(guild.preferredLocale || '') ? 'es' : 'en' });
                // Los textos de fábrica (panel de tickets, verificación…) en ese idioma desde el primer momento.
                if (config.idioma === 'es') {
                    await require('../utils/textosPorDefecto.js').adaptarTextosAlIdioma(guild.id, 'es').catch(() => {});
                    config = await ServidorConfig.findOne({ guildId: guild.id }) || config;
                }
            }
            // Si vuelve a un servidor con el seguimiento de invitaciones activo.
            if (config.crecimiento?.invitaciones?.activo) cargarInvitaciones(guild).catch(() => {});
            // 1.34.0: sus comandos (solo los de lo que tenga activo).
            require('../utils/comandosServidor.js').sincronizar(guild).catch(() => {});

            // 1.5. PRUEBA GRATUITA de Pro (7 días) la PRIMERA vez que entra el bot.
            // Deja que prueben las funciones premium; al caducar, el barrido los
            // devuelve a Free (red de seguridad en utils/scheduler.js).
            if (!config.trialUsado && !config.esPremium) {
                config.esPremium = true;
                config.plan = 'pro';
                config.premiumHasta = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                config.trialUsado = true;
                await config.save().catch(() => {});
                console.log(`🎁 Prueba Pro de 7 días activada en ${guild.name} (${guild.id})`);
            }

            // Mensaje de entrada: lo configuran los propietarios del bot (panel → Propietario).
            const entrada = await cargarMensajeEntrada();
            if (entrada.activo) {
                const bienvenida = construirBienvenida(guild, config, undefined, entrada);

                // 2. Por privado al dueño del servidor (así la configuración no se ve en público).
                let llegoAlDueno = false;
                if (entrada.alDueno) {
                    try {
                        const owner = await guild.fetchOwner();
                        await owner.send(bienvenida);
                        llegoAlDueno = true;
                    } catch { /* el dueño tiene los MD cerrados */ }
                }

                // 3. En el servidor (canal del sistema o el primero donde pueda escribir), 2.0.0: SIEMPRE un
                //    saludo corto para todos (qué es Sokyo, /menu, /ayuda, «Mi cuenta»). La configuración va
                //    también aquí si no llegó por privado («respaldo») o si los propietarios lo quieren («siempre»).
                const yo = guild.members.me;
                const puedeEscribir = (c) => c.type === ChannelType.GuildText && c.permissionsFor(yo)?.has([PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.EmbedLinks]);
                const canal = (guild.systemChannel && puedeEscribir(guild.systemChannel))
                    ? guild.systemChannel
                    : guild.channels.cache.filter(puedeEscribir).sort((x, y) => x.rawPosition - y.rawPosition).first();
                if (canal) {
                    await canal.send(construirSaludoPublico(guild, config)).catch(() => {});
                    if (entrada.alCanal === 'siempre' || (entrada.alCanal === 'respaldo' && !llegoAlDueno)) await canal.send(bienvenida).catch(() => {});
                }
            }

            console.log(`🎉 Bot añadido a un servidor nuevo: ${guild.name} (${guild.id})`);
        } catch (error) {
            console.error('Error en el onboarding (guildCreate):', error);
        }
    },
};
