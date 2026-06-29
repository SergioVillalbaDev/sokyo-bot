const { SlashCommandBuilder } = require('discord.js');
const { gateMusica } = require('../utils/musica.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip to the next song in the queue'),

    async execute(interaction, client) {
        const voz = await gateMusica(interaction);
        if (!voz.ok) return interaction.reply({ content: voz.error, ephemeral: true });

        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player || !player.queue.current) {
            return interaction.reply({ content: '⏹️ Nothing is playing right now.', ephemeral: true });
        }
        if (!player.queue.tracks.length) {
            return interaction.reply({ content: '🚫 No more songs in the queue. Use `/stop` to stop.', ephemeral: true });
        }

        const saltada = player.queue.current;
        await player.skip();
        return interaction.reply(`⏭️ Skipped: **${saltada.info.title}**`);
    },
};
