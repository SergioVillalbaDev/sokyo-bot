const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { gateMusica, formatDuration, COLOR_MUSICA, buscarMusica } = require('../utils/musica.js');
const { t } = require('../utils/i18n.js');
const { sugerenciasCanciones } = require('../utils/musicaExtra.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play music (type the song name and pick it from the list)')
        .setDescriptionLocalizations(ES('Poner música (escribe el nombre de la canción y elígela de la lista)'))
        .addStringOption((opt) =>
            opt.setName('search')
                .setNameLocalizations(ES('cancion'))
                .setDescription('Song name, or a YouTube/Spotify link')
                .setDescriptionLocalizations(ES('Nombre de la canción, o un enlace de YouTube/Spotify'))
                .setRequired(true)
                .setAutocomplete(true)),

    // Mientras escribes, salen canciones de YouTube Music para elegir.
    async autocomplete(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        await interaction.respond(await sugerenciasCanciones(client, interaction.options.getFocused(), idioma));
    },

    async execute(interaction, client, cfg) {
        // 1. Validar voz + música activa + rol DJ.
        const voz = await gateMusica(interaction);
        if (!voz.ok) return interaction.reply({ content: voz.error, flags: 64 });

        const query = interaction.options.getString('search');
        if (!query || !query.trim()) {
            // Discord no debería permitir esto (la opción es obligatoria), pero si
            // el comando registrado en Discord está desactualizado respecto al
            // código (falta re-ejecutar deploy-commands.js), esta opción llega null.
            return interaction.reply({ content: t(cfg, '❌ No he recibido nada que buscar. Escribe el nombre de la canción en **cancion** (o elige una de la lista que sale al escribir).', '❌ I didn’t receive anything to search for. Type the song name in **search** (or pick one from the list that appears as you type).'), flags: 64 });
        }
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

        // 3. Buscar lo que pidió el usuario (URL o texto). Prioriza YouTube Music.
        let res;
        try {
            res = await buscarMusica(player, query, interaction.user);
        } catch (e) {
            console.error('Error buscando música (/play):', e);
            return interaction.editReply(t(cfg, `❌ No he podido buscar eso: ${e.message}`, `❌ I couldn't search for that: ${e.message}`));
        }

        if (!res || !res.tracks?.length || res.loadType === 'error' || res.loadType === 'empty') {
            return interaction.editReply(t(cfg, '🔍 No he encontrado nada para esa búsqueda.', '🔍 I couldn’t find anything for that search.'));
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
            embed.setAuthor({ name: t(cfg, '➕ Playlist añadida a la cola', '➕ Playlist added to the queue') })
                .setTitle(res.playlist?.name || t(cfg, 'Playlist', 'Playlist'))
                .setDescription(t(cfg,
                    `**${res.tracks.length}** canciones añadidas.${yaSonaba ? '' : ' Empezando ahora.'}`,
                    `**${res.tracks.length}** songs added.${yaSonaba ? '' : ' Starting now.'}`));
        } else {
            const track = res.tracks[0];
            embed.setAuthor({ name: yaSonaba ? t(cfg, '➕ Añadida a la cola', '➕ Added to the queue') : t(cfg, '▶️ Sonando ahora', '▶️ Now playing') })
                .setTitle(track.info.title)
                .setURL(track.info.uri || null)
                .addFields(
                    { name: t(cfg, 'Artista', 'Artist'), value: track.info.author || t(cfg, 'Desconocido', 'Unknown'), inline: true },
                    { name: t(cfg, 'Duración', 'Duration'), value: formatDuration(track.info.duration), inline: true },
                    // Solo mostramos posición si de verdad va a esperar en la cola.
                    ...(yaSonaba ? [{ name: t(cfg, 'Posición en la cola', 'Queue position'), value: `#${posicion}`, inline: true }] : []),
                );
            if (track.info.artworkUrl) embed.setThumbnail(track.info.artworkUrl);
        }

        return interaction.editReply({ embeds: [embed] });
    },
};
