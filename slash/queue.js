const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { formatDuration, COLOR_MUSICA } = require('../utils/musica.js');
const { t } = require('../utils/i18n.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Show the song queue'),

    async execute(interaction, client, cfg) {
        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player || !player.queue.current) {
            return interaction.reply({ content: t(cfg, '📭 La cola está vacía y no hay nada sonando.', '📭 The queue is empty and nothing is playing.'), ephemeral: true });
        }

        const actual = player.queue.current;
        const siguientes = player.queue.tracks.slice(0, 10);

        const lista = siguientes.length
            ? siguientes.map((track, i) => `**${i + 1}.** ${track.info.title} \`${formatDuration(track.info.duration)}\``).join('\n')
            : t(cfg, '_No hay más canciones en la cola._', '_No more songs in the queue._');

        const embed = new EmbedBuilder()
            .setColor(COLOR_MUSICA)
            .setTitle(t(cfg, '🎶 Cola de música', '🎶 Music queue'))
            .addFields(
                { name: t(cfg, '▶️ Sonando ahora', '▶️ Now playing'), value: `${actual.info.title} \`${formatDuration(actual.info.duration)}\`` },
                { name: t(cfg, '⏭️ A continuación', '⏭️ Up next'), value: lista },
            );

        const restantes = player.queue.tracks.length - siguientes.length;
        if (restantes > 0) embed.setFooter({ text: t(cfg, `…y ${restantes} más en la cola`, `…and ${restantes} more in the queue`) });

        return interaction.reply({ embeds: [embed] });
    },
};
