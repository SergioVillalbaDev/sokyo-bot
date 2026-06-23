const { SlashCommandBuilder } = require('discord.js');
const { gateMusica } = require('../utils/musica.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Cambia el volumen (0-150). Sin número, muestra el actual')
        .addIntegerOption((opt) =>
            opt.setName('nivel')
                .setDescription('Volumen en porcentaje (0 a 150)')
                .setMinValue(0)
                .setMaxValue(150)
                .setRequired(false)),

    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player || !player.queue.current) {
            return interaction.reply({ content: '⏹️ No hay nada sonando.', ephemeral: true });
        }

        const nivel = interaction.options.getInteger('nivel');
        // Sin número: solo mostrar el volumen actual.
        if (nivel === null) {
            return interaction.reply(`🔊 Volumen actual: **${player.volume}%**`);
        }

        // Cambiar el volumen requiere voz + música activa + rol DJ.
        const voz = await gateMusica(interaction);
        if (!voz.ok) return interaction.reply({ content: voz.error, ephemeral: true });

        // Respetar el tope de volumen configurado.
        if (nivel > voz.cfg.volumenMax) {
            return interaction.reply({ content: `🔊 El máximo permitido aquí es **${voz.cfg.volumenMax}%**.`, ephemeral: true });
        }
        await player.setVolume(nivel);
        const icono = nivel === 0 ? '🔇' : nivel < 50 ? '🔉' : '🔊';
        return interaction.reply(`${icono} Volumen ajustado a **${nivel}%**.`);
    },
};
