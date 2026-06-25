// /filtro — EXTRA del plan Pro: aplica un filtro de audio a lo que suena.
// La música normal es GRATIS para todos; los filtros son un añadido de Pro
// (no capan nada de la base). Requiere voz + rol DJ, igual que el resto.
const { SlashCommandBuilder } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { gateMusica } = require('../utils/musica.js');
const { esPro } = require('../utils/billing.js');

const NOMBRES = {
    bassboost: '🔊 Bassboost', nightcore: '⚡ Nightcore', vaporwave: '🌫️ Vaporwave',
    '8d': '🎧 8D', karaoke: '🎤 Karaoke', tremolo: '🎶 Trémolo', off: 'sin filtros',
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('filtro')
        .setDescription('Aplica un filtro de audio (Pro): bassboost, nightcore, 8D…')
        .addStringOption((opt) =>
            opt.setName('tipo')
                .setDescription('Filtro a aplicar')
                .setRequired(true)
                .addChoices(
                    { name: '🔊 Bassboost', value: 'bassboost' },
                    { name: '⚡ Nightcore', value: 'nightcore' },
                    { name: '🌫️ Vaporwave', value: 'vaporwave' },
                    { name: '🎧 8D', value: '8d' },
                    { name: '🎤 Karaoke', value: 'karaoke' },
                    { name: '🎶 Trémolo', value: 'tremolo' },
                    { name: '❌ Quitar filtros', value: 'off' },
                )),

    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player || !player.queue.current) {
            return interaction.reply({ content: '⏹️ No hay nada sonando.', ephemeral: true });
        }

        // Voz + rol DJ (igual que el resto de comandos de música).
        const voz = await gateMusica(interaction);
        if (!voz.ok) return interaction.reply({ content: voz.error, ephemeral: true });

        // Gate Pro: los filtros son un extra. La música base sigue gratis.
        const cfg = await ServidorConfig.findOne({ guildId: interaction.guildId });
        if (!esPro(cfg)) {
            return interaction.reply({
                content: '✨ Los filtros de audio son un extra del plan **Pro**. La música normal es gratis; Pro añade filtros, ecualizador y más. Échale un ojo a los planes en el panel.',
                ephemeral: true,
            });
        }

        const tipo = interaction.options.getString('tipo');
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
            console.error('Filtro de música:', e.message);
            return interaction.reply({ content: '⚠️ No se pudo aplicar el filtro.', ephemeral: true });
        }

        return interaction.reply(tipo === 'off'
            ? '❌ Filtros quitados.'
            : `✅ Filtro aplicado: **${NOMBRES[tipo]}**.`);
    },
};
