const { SlashCommandBuilder } = require('discord.js');
const { gateMusica } = require('../utils/musica.js');
const { t } = require('../utils/i18n.js');
const ES = (v) => ({ 'es-ES': v, 'es-419': v }); // nombres y textos en español

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setNameLocalizations(ES('pausar'))
        .setDescription('Pause the current song')
        .setDescriptionLocalizations(ES('Pausar la canción')),

    async execute(interaction, client, cfg) {
        const voz = await gateMusica(interaction);
        if (!voz.ok) return interaction.reply({ content: voz.error, flags: 64 });

        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player || !player.queue.current) {
            return interaction.reply({ content: t(cfg, '⏹️ No hay nada sonando.', '⏹️ Nothing is playing.'), flags: 64 });
        }
        if (player.paused) {
            return interaction.reply({ content: t(cfg, '⏸️ La música ya está en pausa. Usa `/resume`.', '⏸️ The music is already paused. Use `/resume`.'), flags: 64 });
        }

        await player.pause();
        return interaction.reply(t(cfg, '⏸️ Música pausada. Usa `/resume` para continuar.', '⏸️ Music paused. Use `/resume` to continue.'));
    },
};
