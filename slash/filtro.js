// /filter — Pro plan EXTRA: applies an audio filter to what's playing.
// Regular music is FREE for everyone; filters are a Pro add-on (they don't cap
// anything in the base experience). Requires voice + DJ role, like the rest.
const { SlashCommandBuilder } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { gateMusica } = require('../utils/musica.js');
const { esPro } = require('../utils/billing.js');
const { t } = require('../utils/i18n.js');
const ES = (v) => ({ 'es-ES': v, 'es-419': v }); // nombres y textos en español

function nombresFiltro(cfg) {
    return {
        bassboost: '🔊 Bassboost', nightcore: '⚡ Nightcore', vaporwave: '🌫️ Vaporwave',
        '8d': '🎧 8D', karaoke: '🎤 Karaoke', tremolo: '🎶 Tremolo', off: t(cfg, 'sin filtros', 'no filters'),
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('filter')
        .setNameLocalizations(ES('filtro'))
        .setDescription('Apply an audio filter (Pro): bassboost, nightcore, 8D…')
        .setDescriptionLocalizations(ES('Efectos de sonido (Pro): bassboost, nightcore, 8D…'))
        .addStringOption((opt) =>
            opt.setName('type')
                .setNameLocalizations(ES('efecto'))
                .setDescription('Filter to apply')
                .setDescriptionLocalizations(ES('Qué efecto poner'))
                .setRequired(true)
                .addChoices(
                    { name: '🔊 Bassboost', value: 'bassboost' },
                    { name: '⚡ Nightcore', value: 'nightcore' },
                    { name: '🌫️ Vaporwave', value: 'vaporwave' },
                    { name: '🎧 8D', value: '8d' },
                    { name: '🎤 Karaoke', value: 'karaoke' },
                    { name: '🎶 Tremolo', value: 'tremolo' },
                    { name: '❌ Remove filters', name_localizations: ES('❌ Quitar efectos'), value: 'off' },
                )),

    async execute(interaction, client, cfgArg) {
        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player || !player.queue.current) {
            return interaction.reply({ content: t(cfgArg, '⏹️ No hay nada sonando.', '⏹️ Nothing is playing.'), flags: 64 });
        }

        // Voz + rol DJ (igual que el resto de comandos de música).
        const voz = await gateMusica(interaction);
        if (!voz.ok) return interaction.reply({ content: voz.error, flags: 64 });

        // Gate Pro: los filtros son un extra. La música base sigue gratis.
        const cfg = await ServidorConfig.findOne({ guildId: interaction.guildId });
        if (!esPro(cfg)) {
            return interaction.reply({
                content: t(cfg, '✨ Los filtros de audio son un extra del plan **Pro**. La música normal es gratis; Pro añade filtros, ecualizador y más. Echa un vistazo a los planes en el panel.', '✨ Audio filters are a **Pro** plan extra. Regular music is free; Pro adds filters, an equalizer and more. Check out the plans in the panel.'),
                flags: 64,
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
            return interaction.reply({ content: t(cfg, '⚠️ No se pudo aplicar el filtro.', '⚠️ Could not apply the filter.'), flags: 64 });
        }

        return interaction.reply(tipo === 'off'
            ? t(cfg, '❌ Filtros eliminados.', '❌ Filters removed.')
            : t(cfg, `✅ Filtro aplicado: **${nombresFiltro(cfg)[tipo]}**.`, `✅ Filter applied: **${nombresFiltro(cfg)[tipo]}**.`));
    },
};
