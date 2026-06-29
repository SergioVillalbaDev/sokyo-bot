// /247 — Pro plan EXTRA: 24/7 mode. The bot does NOT leave the voice channel
// even if the queue or the channel empties. Base music stays free; this is an
// add-on. It's a server setting: requires the Manage Server permission.
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { esPro } = require('../utils/billing.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('247')
        .setDescription('Turn music 24/7 mode on or off (Pro): the bot stays in the channel'),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({ content: '🔧 You need the **Manage Server** permission to change 24/7 mode.', ephemeral: true });
        }

        const cfg = await ServidorConfig.findOne({ guildId: interaction.guildId });

        // Gate Pro: el 24/7 es un extra. La música normal es gratis para todos.
        if (!esPro(cfg)) {
            return interaction.reply({
                content: '✨ **24/7** mode is a **Pro** plan extra. Regular music is free; Pro adds 24/7, filters and more. Check out the plans in the panel.',
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
            ? '🔁 **24/7 mode enabled**. I’ll stay in the channel even if the queue or voice channel empties.'
            : '⏹️ **24/7 mode disabled**. I’ll leave the channel when I’m left alone or out of music.');
    },
};
