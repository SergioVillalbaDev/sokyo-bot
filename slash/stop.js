const { SlashCommandBuilder } = require('discord.js');
const { gateMusica } = require('../utils/musica.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop the music, clear the queue and leave the voice channel'),

    async execute(interaction, client) {
        const voz = await gateMusica(interaction);
        if (!voz.ok) return interaction.reply({ content: voz.error, ephemeral: true });

        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player) {
            return interaction.reply({ content: '⏹️ There’s nothing to stop.', ephemeral: true });
        }

        await player.destroy();
        return interaction.reply('⏹️ Music stopped and queue cleared. See you next time!');
    },
};
