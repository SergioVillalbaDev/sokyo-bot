// /filter — Pro plan EXTRA: applies an audio filter to what's playing.
// Regular music is FREE for everyone; filters are a Pro add-on (they don't cap
// anything in the base experience). Requires voice + DJ role, like the rest.
const { SlashCommandBuilder } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { gateMusica } = require('../utils/musica.js');
const { esPro } = require('../utils/billing.js');

const NOMBRES = {
    bassboost: '🔊 Bassboost', nightcore: '⚡ Nightcore', vaporwave: '🌫️ Vaporwave',
    '8d': '🎧 8D', karaoke: '🎤 Karaoke', tremolo: '🎶 Tremolo', off: 'no filters',
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('filter')
        .setDescription('Apply an audio filter (Pro): bassboost, nightcore, 8D…')
        .addStringOption((opt) =>
            opt.setName('type')
                .setDescription('Filter to apply')
                .setRequired(true)
                .addChoices(
                    { name: '🔊 Bassboost', value: 'bassboost' },
                    { name: '⚡ Nightcore', value: 'nightcore' },
                    { name: '🌫️ Vaporwave', value: 'vaporwave' },
                    { name: '🎧 8D', value: '8d' },
                    { name: '🎤 Karaoke', value: 'karaoke' },
                    { name: '🎶 Tremolo', value: 'tremolo' },
                    { name: '❌ Remove filters', value: 'off' },
                )),

    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player || !player.queue.current) {
            return interaction.reply({ content: '⏹️ Nothing is playing.', ephemeral: true });
        }

        // Voz + rol DJ (igual que el resto de comandos de música).
        const voz = await gateMusica(interaction);
        if (!voz.ok) return interaction.reply({ content: voz.error, ephemeral: true });

        // Gate Pro: los filtros son un extra. La música base sigue gratis.
        const cfg = await ServidorConfig.findOne({ guildId: interaction.guildId });
        if (!esPro(cfg)) {
            return interaction.reply({
                content: '✨ Audio filters are a **Pro** plan extra. Regular music is free; Pro adds filters, an equalizer and more. Check out the plans in the panel.',
                ephemeral: true,
            });
        }

        const tipo = interaction.options.getString('type');
        const fm = player.filterManager;

        try {
            await fm.resetFilters(); // partimos siempre de limpio (un filtro a la vez)
            switch (tipo) {
                case 'bassboost': await fm.setEQPreset('BassboostHigh'); break;
                case 'nightcore': await fm.toggleNightcore(); break;
                case 'vaporwave': await fm.toggleVaporwave(); break;
                case '8d': await fm.toggleRotation(); break;
                case 'karaoke': await fm.toggleKaraoke(); break;
                case 'tremolo': await fm.toggleTremolo(); break;
                case 'off': default: break; // ya está reseteado
            }
        } catch (e) {
            console.error('Music filter:', e.message);
            return interaction.reply({ content: '⚠️ Could not apply the filter.', ephemeral: true });
        }

        return interaction.reply(tipo === 'off'
            ? '❌ Filters removed.'
            : `✅ Filter applied: **${NOMBRES[tipo]}**.`);
    },
};
