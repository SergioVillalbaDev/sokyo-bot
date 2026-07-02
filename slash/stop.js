const { SlashCommandBuilder } = require('discord.js');
const { gateMusica } = require('../utils/musica.js');
const { t } = require('../utils/i18n.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop the music, clear the queue and leave the voice channel'),

    async execute(interaction, client, cfg) {
        const voz = await gateMusica(interaction);
        if (!voz.ok) return interaction.reply({ content: voz.error, ephemeral: true });

        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player) {
            return interaction.reply({ content: t(cfg, '⏹️ No hay nada que detener.', '⏹️ There’s nothing to stop.'), ephemeral: true });
        }

        await player.destroy();
        return interaction.reply(t(cfg, '⏹️ Música detenida y cola vaciada. ¡Hasta la próxima!', '⏹️ Music stopped and queue cleared. See you next time!'));
    },
};
