// /247 — EXTRA del plan Pro: modo 24/7. El bot NO sale del canal de voz aunque
// se vacíe la cola o el canal. La música base sigue gratis; esto es un añadido.
// Es una configuración del servidor: requiere permiso de Gestionar servidor.
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { esPro } = require('../utils/billing.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('247')
        .setDescription('Activa o desactiva el modo 24/7 de música (Pro): el bot no sale del canal'),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({ content: '🔧 Necesitas el permiso **Gestionar servidor** para cambiar el modo 24/7.', ephemeral: true });
        }

        const cfg = await ServidorConfig.findOne({ guildId: interaction.guildId });

        // Gate Pro: el 24/7 es un extra. La música normal es gratis para todos.
        if (!esPro(cfg)) {
            return interaction.reply({
                content: '✨ El modo **24/7** es un extra del plan **Pro**. La música normal es gratis; Pro añade 24/7, filtros y más. Échale un ojo a los planes en el panel.',
                ephemeral: true,
            });
        }

        const nuevo = !(cfg && cfg.musica && cfg.musica.modo247);
        await ServidorConfig.updateOne(
            { guildId: interaction.guildId },
            { $set: { 'musica.modo247': nuevo } },
            { upsert: true },
        );

        return interaction.reply(nuevo
            ? '🔁 Modo **24/7 activado**. Me quedaré en el canal aunque se vacíe la cola o el canal de voz.'
            : '⏹️ Modo **24/7 desactivado**. Saldré del canal cuando me quede solo o sin música.');
    },
};
