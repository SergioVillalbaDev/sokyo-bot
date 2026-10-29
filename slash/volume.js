const { SlashCommandBuilder } = require('discord.js');
const { gateMusica } = require('../utils/musica.js');
const { t } = require('../utils/i18n.js');
const ES = (v) => ({ 'es-ES': v, 'es-419': v }); // nombres y textos en español

module.exports = {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setNameLocalizations(ES('volumen'))
        .setDescription('Change the volume (0-150). Without a number, shows the current one')
        .setDescriptionLocalizations(ES('Cambiar el volumen (0-150). Sin número, te dice el actual'))
        .addIntegerOption((opt) =>
            opt.setName('level')
                .setNameLocalizations(ES('nivel'))
                .setDescription('Volume as a percentage (0 to 150)')
                .setDescriptionLocalizations(ES('Volumen en % (de 0 a 150)'))
                .setMinValue(0)
                .setMaxValue(150)
                .setRequired(false)),

    async execute(interaction, client, cfg) {
        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player || !player.queue.current) {
            return interaction.reply({ content: t(cfg, '⏹️ No hay nada sonando.', '⏹️ Nothing is playing.'), flags: 64 });
        }

        const nivel = interaction.options.getInteger('level');
        // Sin número: solo mostrar el volumen actual.
        if (nivel === null) {
            return interaction.reply(t(cfg, `🔊 Volumen actual: **${player.volume}%**`, `🔊 Current volume: **${player.volume}%**`));
        }

        // Cambiar el volumen requiere voz + música activa + rol DJ.
        const voz = await gateMusica(interaction);
        if (!voz.ok) return interaction.reply({ content: voz.error, flags: 64 });

        // Respetar el tope de volumen configurado.
        if (nivel > voz.cfg.volumenMax) {
            return interaction.reply({ content: t(cfg, `🔊 El máximo permitido aquí es **${voz.cfg.volumenMax}%**.`, `🔊 The maximum allowed here is **${voz.cfg.volumenMax}%**.`), flags: 64 });
        }
        await player.setVolume(nivel);
        const icono = nivel === 0 ? '🔇' : nivel < 50 ? '🔉' : '🔊';
        return interaction.reply(t(cfg, `${icono} Volumen fijado a **${nivel}%**.`, `${icono} Volume set to **${nivel}%**.`));
    },
};
