const { SlashCommandBuilder } = require('discord.js');
const { gateMusica } = require('../utils/musica.js');
const { t } = require('../utils/i18n.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause the current song'),

    async execute(interaction, client, cfg) {
        const voz = await gateMusica(interaction);
        if (!voz.ok) return interaction.reply({ content: voz.error, ephemeral: true });

        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player || !player.queue.current) {
            return interaction.reply({ content: t(cfg, '⏹️ No hay nada sonando.', '⏹️ Nothing is playing.'), ephemeral: true });
        }
        if (player.paused) {
            return interaction.reply({ content: t(cfg, '⏸️ La música ya está en pausa. Usa `/resume`.', '⏸️ The music is already paused. Use `/resume`.'), ephemeral: true });
        }

        await player.pause();
        return interaction.reply(t(cfg, '⏸️ Música pausada. Usa `/resume` para continuar.', '⏸️ Music paused. Use `/resume` to continue.'));
    },
};
