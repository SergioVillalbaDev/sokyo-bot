const { SlashCommandBuilder } = require('discord.js');
const { gateMusica } = require('../utils/musica.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pausa la canción actual'),

    async execute(interaction, client) {
        const voz = await gateMusica(interaction);
        if (!voz.ok) return interaction.reply({ content: voz.error, ephemeral: true });

        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player || !player.queue.current) {
            return interaction.reply({ content: '⏹️ No hay nada sonando.', ephemeral: true });
        }
        if (player.paused) {
            return interaction.reply({ content: '⏸️ La música ya está en pausa. Usa `/resume`.', ephemeral: true });
        }

        await player.pause();
        return interaction.reply('⏸️ Música en pausa. Usa `/resume` para continuar.');
    },
};
