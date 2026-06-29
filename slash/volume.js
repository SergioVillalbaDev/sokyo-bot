const { SlashCommandBuilder } = require('discord.js');
const { gateMusica } = require('../utils/musica.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Change the volume (0-150). Without a number, shows the current one')
        .addIntegerOption((opt) =>
            opt.setName('level')
                .setDescription('Volume as a percentage (0 to 150)')
                .setMinValue(0)
                .setMaxValue(150)
                .setRequired(false)),

    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player || !player.queue.current) {
            return interaction.reply({ content: '⏹️ Nothing is playing.', ephemeral: true });
        }

        const nivel = interaction.options.getInteger('level');
        // Sin número: solo mostrar el volumen actual.
        if (nivel === null) {
            return interaction.reply(`🔊 Current volume: **${player.volume}%**`);
        }

        // Cambiar el volumen requiere voz + música activa + rol DJ.
        const voz = await gateMusica(interaction);
        if (!voz.ok) return interaction.reply({ content: voz.error, ephemeral: true });

        // Respetar el tope de volumen configurado.
        if (nivel > voz.cfg.volumenMax) {
            return interaction.reply({ content: `🔊 The maximum allowed here is **${voz.cfg.volumenMax}%**.`, ephemeral: true });
        }
        await player.setVolume(nivel);
        const icono = nivel === 0 ? '🔇' : nivel < 50 ? '🔉' : '🔊';
        return interaction.reply(`${icono} Volume set to **${nivel}%**.`);
    },
};
