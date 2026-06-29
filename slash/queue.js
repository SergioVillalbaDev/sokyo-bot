const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { formatDuration, COLOR_MUSICA } = require('../utils/musica.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Show the song queue'),

    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player || !player.queue.current) {
            return interaction.reply({ content: '📭 The queue is empty and nothing is playing.', ephemeral: true });
        }

        const actual = player.queue.current;
        const siguientes = player.queue.tracks.slice(0, 10);

        const lista = siguientes.length
            ? siguientes.map((t, i) => `**${i + 1}.** ${t.info.title} \`${formatDuration(t.info.duration)}\``).join('\n')
            : '_No more songs in the queue._';

        const embed = new EmbedBuilder()
            .setColor(COLOR_MUSICA)
            .setTitle('🎶 Music queue')
            .addFields(
                { name: '▶️ Now playing', value: `${actual.info.title} \`${formatDuration(actual.info.duration)}\`` },
                { name: '⏭️ Up next', value: lista },
            );

        const restantes = player.queue.tracks.length - siguientes.length;
        if (restantes > 0) embed.setFooter({ text: `…and ${restantes} more in the queue` });

        return interaction.reply({ embeds: [embed] });
    },
};
