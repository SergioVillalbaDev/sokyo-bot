const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { gateMusica, formatDuration, COLOR_MUSICA } = require('../utils/musica.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Reproduce música (pega una URL de YouTube/Spotify o busca por nombre)')
        .addStringOption((opt) =>
            opt.setName('busqueda')
                .setDescription('URL de YouTube/Spotify, o el nombre de la canción')
                .setRequired(true)),

    async execute(interaction, client) {
        // 1. Validar voz + música activa + rol DJ.
        const voz = await gateMusica(interaction);
        if (!voz.ok) return interaction.reply({ content: voz.error, ephemeral: true });

        const query = interaction.options.getString('busqueda');
        await interaction.deferReply();

        // 2. Crear (o recuperar) el reproductor de este servidor.
        const player = client.lavalink.getPlayer(interaction.guildId)
            || client.lavalink.createPlayer({
                guildId: interaction.guildId,
                voiceChannelId: voz.channel.id,
                textChannelId: voz.cfg.canalMusicaId || interaction.channelId,
                selfDeaf: true,
                volume: Math.min(voz.cfg.volumenDefecto, voz.cfg.volumenMax),
            });

        if (!player.connected) await player.connect();

        // 3. Buscar lo que pidió el usuario (URL o texto).
        let res;
        try {
            res = await player.search({ query }, interaction.user);
        } catch (e) {
            return interaction.editReply(`❌ No pude buscar eso: ${e.message}`);
        }

        if (!res || !res.tracks?.length || res.loadType === 'error' || res.loadType === 'empty') {
            return interaction.editReply('🔍 No encontré nada con esa búsqueda.');
        }

        // 4. ¿Ya había algo sonando? (para saber si esto empieza ya o va a la cola).
        const yaSonaba = !!(player.playing || player.paused || player.queue.current);

        // ¿Es una playlist o una sola canción?
        const esPlaylist = res.loadType === 'playlist';
        if (esPlaylist) {
            await player.queue.add(res.tracks);
        } else {
            await player.queue.add(res.tracks[0]);
        }
        // Posición en cola ANTES de empezar a reproducir (al sonar, la actual sale de la cola).
        const posicion = player.queue.tracks.length;

        // 5. Si no está sonando nada, empezar a reproducir.
        if (!yaSonaba) await player.play();

        // 6. Responder con un embed.
        const embed = new EmbedBuilder().setColor(COLOR_MUSICA);
        if (esPlaylist) {
            embed.setAuthor({ name: '➕ Playlist añadida a la cola' })
                .setTitle(res.playlist?.name || 'Playlist')
                .setDescription(`**${res.tracks.length}** canciones añadidas.${yaSonaba ? '' : ' Empezando ahora.'}`);
        } else {
            const t = res.tracks[0];
            embed.setAuthor({ name: yaSonaba ? '➕ Añadida a la cola' : '▶️ Reproduciendo ahora' })
                .setTitle(t.info.title)
                .setURL(t.info.uri || null)
                .addFields(
                    { name: 'Artista', value: t.info.author || 'Desconocido', inline: true },
                    { name: 'Duración', value: formatDuration(t.info.duration), inline: true },
                    // Solo mostramos posición si de verdad va a esperar en la cola.
                    ...(yaSonaba ? [{ name: 'Posición en cola', value: `#${posicion}`, inline: true }] : []),
                );
            if (t.info.artworkUrl) embed.setThumbnail(t.info.artworkUrl);
        }

        return interaction.editReply({ embeds: [embed] });
    },
};
