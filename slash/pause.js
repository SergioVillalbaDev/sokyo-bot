const { SlashCommandBuilder } = require('discord.js');
const { gateMusica } = require('../utils/musica.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause the current song'),

    async execute(interaction, client) {
        const voz = await gateMusica(interaction);
        if (!voz.ok) return interaction.reply({ content: voz.error, ephemeral: true });

        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player || !player.queue.current) {
            return interaction.reply({ content: '⏹️ Nothing is playing.', ephemeral: true });
        }
        if (player.paused) {
            return interaction.reply({ content: '⏸️ The music is already paused. Use `/resume`.', ephemeral: true });
        }

        await player.pause();
        return interaction.reply('⏸️ Music paused. Use `/resume` to continue.');
    },
};
