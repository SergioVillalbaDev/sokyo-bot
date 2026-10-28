const { SlashCommandBuilder } = require('discord.js');
const { respuestaLetra } = require('../utils/musicaExtra.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');
const { t } = require('../utils/i18n.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

// /letra: la letra de lo que suena (o de la canción que escribas). Solo la ve quien la pide.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('lyrics')
        .setNameLocalizations(ES('letra'))
        .setDescription('The lyrics of the song that’s playing (or of another one)')
        .setDescriptionLocalizations(ES('La letra de la canción que suena (o de otra)'))
        .addStringOption((o) => o.setName('song').setNameLocalizations(ES('cancion'))
            .setDescription('Another song: name and artist (empty = the one playing)')
            .setDescriptionLocalizations(ES('Otra canción: nombre y artista (vacío = la que suena)'))
            .setMaxLength(150)),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        const pedida = interaction.options.getString('song');
        const actual = interaction.guildId ? client.lavalink?.getPlayer(interaction.guildId)?.queue?.current : null;
        if (!pedida && !actual) {
            return interaction.reply({ content: t(idioma, '🎵 Ahora no suena nada. Escribe el nombre de la canción en la opción **canción**.', '🎵 Nothing is playing. Type the song name in the **song** option.'), flags: 64 });
        }
        await interaction.deferReply({ flags: 64 });
        const r = pedida
            ? await respuestaLetra(pedida, '', 0, idioma)
            : await respuestaLetra(actual.info.title, actual.info.author, actual.info.duration, idioma);
        return interaction.editReply(r);
    },
};
