const { SlashCommandBuilder } = require('discord.js');
const { gateMusica } = require('../utils/musica.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Resume the paused music'),

    async execute(interaction, client) {
        const voz = await gateMusica(interaction);
        if (!voz.ok) return interaction.reply({ content: voz.error, ephemeral: true });

        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player || !player.queue.current) {
            return interaction.reply({ content: '⏹️ There’s nothing to resume.', ephemeral: true });
        }
        if (!player.paused) {
            return interaction.reply({ content: '▶️ The music is already playing.', ephemeral: true });
        }

        await player.resume();
        return interaction.reply('▶️ Back on! Music resumed.');
    },
};
