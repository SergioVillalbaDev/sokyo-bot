const { Events, ChannelType, PermissionsBitField } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { construirGuia } = require('../utils/onboarding.js');

module.exports = {
    name: Events.GuildCreate,
    async execute(guild) {
        try {
            // 1. Crear la configuración del servidor si aún no existe.
            let config = await ServidorConfig.findOne({ guildId: guild.id });
            if (!config) config = await ServidorConfig.create({ guildId: guild.id });

            const guia = construirGuia(guild, config);

            // 2. Intentar MD privado al dueño del servidor.
            try {
                const owner = await guild.fetchOwner();
                await owner.send(guia);
            } catch { /* el dueño tiene los MD cerrados: lo dejamos en un canal */ }

            // 3. Respaldo en un canal: el del sistema, o el primero donde el bot pueda escribir.
            const yo = guild.members.me;
            const puedeEscribir = (c) => c.type === ChannelType.GuildText && c.permissionsFor(yo)?.has(PermissionsBitField.Flags.SendMessages);
            const canal = (guild.systemChannel && puedeEscribir(guild.systemChannel))
                ? guild.systemChannel
                : guild.channels.cache.find(puedeEscribir);
            if (canal) await canal.send(guia).catch(() => {});

            console.log(`🎉 Bot añadido a un servidor nuevo: ${guild.name} (${guild.id})`);
        } catch (error) {
            console.error('Error en el onboarding (guildCreate):', error);
        }
    },
};
