const { SlashCommandBuilder } = require('discord.js');
const { gateMusica } = require('../utils/musica.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Para la música, vacía la cola y sale del canal de voz'),

    async execute(interaction, client) {
        const voz = await gateMusica(interaction);
        if (!voz.ok) return interaction.reply({ content: voz.error, ephemeral: true });

        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player) {
            return interaction.reply({ content: '⏹️ No hay nada que parar.', ephemeral: true });
        }

        await player.destroy();
        return interaction.reply('⏹️ Música detenida y cola vaciada. ¡Hasta la próxima!');
    },
};
