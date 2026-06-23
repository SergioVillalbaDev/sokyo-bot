const { SlashCommandBuilder } = require('discord.js');
const { gateMusica } = require('../utils/musica.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Reanuda la música pausada'),

    async execute(interaction, client) {
        const voz = await gateMusica(interaction);
        if (!voz.ok) return interaction.reply({ content: voz.error, ephemeral: true });

        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player || !player.queue.current) {
            return interaction.reply({ content: '⏹️ No hay nada que reanudar.', ephemeral: true });
        }
        if (!player.paused) {
            return interaction.reply({ content: '▶️ La música ya está sonando.', ephemeral: true });
        }

        await player.resume();
        return interaction.reply('▶️ ¡Seguimos! Música reanudada.');
    },
};
