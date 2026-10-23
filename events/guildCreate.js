const { Events, ChannelType, PermissionsBitField } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { construirBienvenida } = require('../utils/onboarding.js');

module.exports = {
    name: Events.GuildCreate,
    async execute(guild) {
        try {
            // 1. Crear la configuración del servidor si aún no existe.
            let config = await ServidorConfig.findOne({ guildId: guild.id });
            if (!config) config = await ServidorConfig.create({ guildId: guild.id });

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

            const bienvenida = construirBienvenida(guild, config);

            // 2. Intentar MD privado al dueño del servidor.
            try {
                const owner = await guild.fetchOwner();
                await owner.send(bienvenida);
            } catch { /* el dueño tiene los MD cerrados: lo dejamos en un canal */ }

            // 3. Respaldo en un canal: el del sistema, o el primero donde el bot pueda escribir.
            const yo = guild.members.me;
            const puedeEscribir = (c) => c.type === ChannelType.GuildText && c.permissionsFor(yo)?.has(PermissionsBitField.Flags.SendMessages);
            const canal = (guild.systemChannel && puedeEscribir(guild.systemChannel))
                ? guild.systemChannel
                : guild.channels.cache.find(puedeEscribir);
            if (canal) await canal.send(bienvenida).catch(() => {});

            console.log(`🎉 Bot añadido a un servidor nuevo: ${guild.name} (${guild.id})`);
        } catch (error) {
            console.error('Error en el onboarding (guildCreate):', error);
        }
    },
};
