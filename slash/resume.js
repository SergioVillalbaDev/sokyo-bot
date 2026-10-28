const { SlashCommandBuilder } = require('discord.js');
const { gateMusica } = require('../utils/musica.js');
const { t } = require('../utils/i18n.js');
const ES = (v) => ({ 'es-ES': v, 'es-419': v }); // nombres y textos en español

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setNameLocalizations(ES('seguir'))
        .setDescription('Resume the paused music')
        .setDescriptionLocalizations(ES('Seguir con la música pausada')),

    async execute(interaction, client, cfg) {
        const voz = await gateMusica(interaction);
        if (!voz.ok) return interaction.reply({ content: voz.error, flags: 64 });

        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player || !player.queue.current) {
            return interaction.reply({ content: t(cfg, '⏹️ No hay nada que reanudar.', '⏹️ There’s nothing to resume.'), flags: 64 });
        }
        if (!player.paused) {
            return interaction.reply({ content: t(cfg, '▶️ La música ya está sonando.', '▶️ The music is already playing.'), flags: 64 });
        }

        await player.resume();
        return interaction.reply(t(cfg, '▶️ ¡De vuelta! Música reanudada.', '▶️ Back on! Music resumed.'));
    },
};
