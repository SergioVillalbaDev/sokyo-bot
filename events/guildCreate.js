// Cuando añaden el bot a un servidor nuevo: crea su configuración y explica cómo empezar.
const { Events, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { obtenerConfig } = require('../utils/config.js');

module.exports = {
    name: Events.GuildCreate,
    async execute(guild) {
        console.log(`➕ Añadido a un servidor: ${guild.name} (${guild.id})`);
        try { await obtenerConfig(guild.id); } catch (e) { console.error('Error creando config:', e); }

        const P = PermissionsBitField.Flags;
        const yo = guild.members.me;
        const canal = [guild.systemChannel, ...guild.channels.cache.values()]
            .find(c => c && c.isTextBased?.() && !c.isThread?.() && c.permissionsFor(yo)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks]));
        if (!canal) return;

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('👋 ¡Gracias por añadir Sokyo!')
            .setDescription([
                'Sistema de tickets con formularios, panel web e IA que responde las dudas repetidas.',
                '',
                '**Para empezar, un administrador solo tiene que escribir:**',
                '`/setup rol_staff:@TuRolDeSoporte`',
                '',
                'Crea la categoría de tickets, el canal de logs y publica el panel en 1 minuto.',
                process.env.FRONTEND_URL ? `\nPanel web: ${process.env.FRONTEND_URL}` : ''
            ].join('\n'));
        await canal.send({ embeds: [embed] }).catch(() => {});
    }
};
