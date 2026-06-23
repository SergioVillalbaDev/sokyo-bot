const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { formatDuration, COLOR_MUSICA } = require('../utils/musica.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Muestra la cola de canciones'),

    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player || !player.queue.current) {
            return interaction.reply({ content: '📭 La cola está vacía y no hay nada sonando.', ephemeral: true });
        }

        const actual = player.queue.current;
        const siguientes = player.queue.tracks.slice(0, 10);

        const lista = siguientes.length
            ? siguientes.map((t, i) => `**${i + 1}.** ${t.info.title} \`${formatDuration(t.info.duration)}\``).join('\n')
            : '_No hay más canciones en la cola._';

        const embed = new EmbedBuilder()
            .setColor(COLOR_MUSICA)
            .setTitle('🎶 Cola de música')
            .addFields(
                { name: '▶️ Sonando ahora', value: `${actual.info.title} \`${formatDuration(actual.info.duration)}\`` },
                { name: '⏭️ A continuación', value: lista },
            );

        const restantes = player.queue.tracks.length - siguientes.length;
        if (restantes > 0) embed.setFooter({ text: `…y ${restantes} más en la cola` });

        return interaction.reply({ embeds: [embed] });
    },
};
