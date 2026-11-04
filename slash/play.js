const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { gateMusica, formatDuration, COLOR_MUSICA, buscarMusica, fuenteDe, nodoMusica, limitarEncolado } = require('../utils/musica.js');
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

        // Las mismas reglas que el panel web: fuentes permitidas del servidor.
        const fuente = fuenteDe(query);
        if (voz.cfg.fuentes && voz.cfg.fuentes[fuente] === false) {
            const nombre = { youtube: 'YouTube', spotify: 'Spotify', soundcloud: 'SoundCloud' }[fuente];
            return interaction.reply({ content: t(cfg, `🚫 En este servidor no se puede poner música de **${nombre}**.`, `🚫 Music from **${nombre}** is turned off on this server.`), flags: 64 });
        }

        // Sin servidor de música (Lavalink) no se puede buscar ni sonar: se dice claro.
        const nodo = nodoMusica(client);
        if (!nodo) {
            return interaction.reply({ content: t(cfg, '🔌 El servidor de música está apagado o reiniciándose. Prueba otra vez en un minuto; si sigue igual, avisa al dueño del bot.', '🔌 The music server is off or restarting. Try again in a minute; if it keeps happening, let the bot owner know.'), flags: 64 });
        }

        // El bot ya suena en otro canal de voz de este servidor.
        const existente = client.lavalink.getPlayer(interaction.guildId);
        if (voz.cfg.soloMismoCanal && existente?.voiceChannelId && existente.voiceChannelId !== voz.channel.id) {
            return interaction.reply({ content: t(cfg, '🎧 Ya estoy sonando en otro canal de voz. Únete a ese canal para añadir canciones.', '🎧 I’m already playing in another voice channel. Join that one to add songs.'), flags: 64 });
        }
        await interaction.deferReply();

        // 2. Buscar lo que pidió el usuario (URL o texto; prioriza YouTube Music) ANTES de
        //    entrar al canal: si no hay nada que añadir, el bot no se queda en la voz callado.
        let res;
        try {
            res = await buscarMusica(existente || nodo, query, interaction.user);
        } catch (e) {
            console.error('Error buscando música (/play):', e.message);
            return interaction.editReply(t(cfg, '❌ No he podido buscar eso ahora mismo. Prueba otra vez o con otro nombre o enlace.', '❌ I couldn’t search for that right now. Try again or with another name or link.'));
        }

        if (!res || !res.tracks?.length || res.loadType === 'error' || res.loadType === 'empty') {
            return interaction.editReply(t(cfg, '🔍 No he encontrado nada para esa búsqueda.', '🔍 I couldn’t find anything for that search.'));
        }

        // 3. Playlists permitidas y tope de la cola (ajustes del panel → Música).
        const { tracks, recortadas, error, esPlaylist } = limitarEncolado(res, voz.cfg, existente?.queue.tracks.length || 0);
        if (error === 'sin-playlists') {
            return interaction.editReply(t(cfg, '📃 En este servidor no se pueden añadir playlists enteras. Pon las canciones de una en una.', '📃 Whole playlists are turned off on this server. Add songs one by one.'));
        }
        if (error === 'cola-llena') {
            return interaction.editReply(t(cfg, `📋 La cola está llena (máximo ${voz.cfg.maxCola} canciones). Espera a que avance para añadir más.`, `📋 The queue is full (max ${voz.cfg.maxCola} songs). Wait for it to move on to add more.`));
        }

        // 4. Crear (o recuperar) el reproductor de este servidor y entrar al canal.
        let player = existente;
        try {
            player = player || client.lavalink.createPlayer({
                guildId: interaction.guildId,
                voiceChannelId: voz.channel.id,
                textChannelId: voz.cfg.canalMusicaId || interaction.channelId,
                selfDeaf: true,
                volume: Math.min(voz.cfg.volumenDefecto, voz.cfg.volumenMax),
            });
            if (!player.connected) await player.connect();
        } catch (e) {
            console.error('No se pudo entrar al canal de voz (/play):', e.message);
            return interaction.editReply(t(cfg, '🔌 No he podido entrar al canal de voz. Prueba otra vez en un momento.', '🔌 I couldn’t join the voice channel. Try again in a moment.'));
        }

        // ¿Ya había algo sonando? (para saber si esto empieza ya o va a la cola).
        const yaSonaba = !!(player.playing || player.paused || player.queue.current);
        await player.queue.add(tracks);
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
                    `**${tracks.length}** canciones añadidas.${yaSonaba ? '' : ' Empezando ahora.'}${recortadas ? ` (${recortadas} no caben: la cola admite ${voz.cfg.maxCola}.)` : ''}`,
                    `**${tracks.length}** songs added.${yaSonaba ? '' : ' Starting now.'}${recortadas ? ` (${recortadas} didn’t fit: the queue holds ${voz.cfg.maxCola}.)` : ''}`));
        } else {
            const track = tracks[0];
            embed.setAuthor({ name: yaSonaba ? t(cfg, '➕ Añadida a la cola', '➕ Added to the queue') : t(cfg, '▶️ Sonando ahora', '▶️ Now playing') })
                .setTitle(track.info.title)
                .setURL(track.info.uri || null)
                .addFields(
                    { name: t(cfg, 'Artista', 'Artist'), value: track.info.author || t(cfg, 'Desconocido', 'Unknown'), inline: true },
                    { name: t(cfg, 'Duración', 'Duration'), value: formatDuration(track.info.duration, cfg), inline: true },
                    // Solo mostramos posición si de verdad va a esperar en la cola.
                    ...(yaSonaba ? [{ name: t(cfg, 'Posición en la cola', 'Queue position'), value: `#${posicion}`, inline: true }] : []),
                );
            if (track.info.artworkUrl) embed.setThumbnail(track.info.artworkUrl);
        }

        return interaction.editReply({ embeds: [embed] });
    },
};
