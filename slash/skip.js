const { SlashCommandBuilder } = require('discord.js');
const { gateMusica } = require('../utils/musica.js');
const { votarSaltar, textoVoto } = require('../utils/musicaExtra.js');
const { t } = require('../utils/i18n.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setNameLocalizations(ES('saltar'))
        .setDescription('Skip to the next song (with more people listening, it’s a vote)')
        .setDescriptionLocalizations(ES('Pasar a la siguiente canción (si escucha más gente, se vota)')),

    async execute(interaction, client, cfg) {
        const voz = await gateMusica(interaction);
        if (!voz.ok) return interaction.reply({ content: voz.error, flags: 64 });

        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player || !player.queue.current) {
            return interaction.reply({ content: t(cfg, '⏹️ Ahora mismo no hay nada sonando.', '⏹️ Nothing is playing right now.'), flags: 64 });
        }
        if (!player.queue.tracks.length) {
            return interaction.reply({ content: t(cfg, '🚫 No hay más canciones en la cola. Usa `/stop` para detener la música.', '🚫 No more songs in the queue. Use `/stop` to stop.'), flags: 64 });
        }

        // Con más gente escuchando, saltar la canción de otro se vota.
        const voto = votarSaltar(player, interaction.member, voz.cfg);
        if (!voto.saltar) return interaction.reply(textoVoto(voto, cfg));

        const saltada = player.queue.current;
        await player.skip();
        const porVotos = voto.necesarios ? t(cfg, ` (por votos: ${voto.votos}/${voto.necesarios})`, ` (by vote: ${voto.votos}/${voto.necesarios})`) : '';
        return interaction.reply(t(cfg, `⏭️ Saltada: **${saltada.info.title}**${porVotos}`, `⏭️ Skipped: **${saltada.info.title}**${porVotos}`));
    },
};
