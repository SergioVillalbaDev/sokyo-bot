const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { formatDuration, COLOR_MUSICA } = require('../utils/musica.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Show the song that’s playing right now'),

    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guildId);
        const track = player?.queue.current;
        if (!player || !track) {
            return interaction.reply({ content: '⏹️ Nothing is playing right now.', ephemeral: true });
        }

        // Barra de progreso visual.
        const total = track.info.duration || 0;
        const pos = player.position || 0;
        let barra = '';
        if (total > 0) {
            const longitud = 18;
            const lleno = Math.min(longitud, Math.round((pos / total) * longitud));
            barra = '▬'.repeat(lleno) + '🔘' + '▬'.repeat(Math.max(0, longitud - lleno));
            barra = `\n\`${formatDuration(pos)}\` ${barra} \`${formatDuration(total)}\``;
        }

        const embed = new EmbedBuilder()
            .setColor(COLOR_MUSICA)
            .setAuthor({ name: '🎶 Now playing' })
            .setTitle(track.info.title)
            .setURL(track.info.uri || null)
            .setDescription(`**${track.info.author || 'Unknown'}**${barra}`);

        if (track.info.artworkUrl) embed.setThumbnail(track.info.artworkUrl);
        if (track.requester?.username) embed.setFooter({ text: `Requested by ${track.requester.username}` });

        return interaction.reply({ embeds: [embed] });
    },
};
