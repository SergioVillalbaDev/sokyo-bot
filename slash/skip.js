const { SlashCommandBuilder } = require('discord.js');
const { gateMusica } = require('../utils/musica.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Salta a la siguiente canción de la cola'),

    async execute(interaction, client) {
        const voz = await gateMusica(interaction);
        if (!voz.ok) return interaction.reply({ content: voz.error, ephemeral: true });

        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player || !player.queue.current) {
            return interaction.reply({ content: '⏹️ No hay nada sonando ahora mismo.', ephemeral: true });
        }
        if (!player.queue.tracks.length) {
            return interaction.reply({ content: '🚫 No hay más canciones en la cola. Usa `/stop` para parar.', ephemeral: true });
        }

        const saltada = player.queue.current;
        await player.skip();
        return interaction.reply(`⏭️ Saltada: **${saltada.info.title}**`);
    },
};
