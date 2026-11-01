// Motor de música del bot (lado Node).
// Crea el LavalinkManager, lo engancha al cliente de Discord y registra los
// eventos necesarios. Lo usa index.js con initMusica(client).
//
// El audio NO lo procesa este proceso: solo manda órdenes al servidor Lavalink
// (npm run lavalink) que es quien reproduce en los canales de voz.

const { LavalinkManager } = require('lavalink-client');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { esPro } = require('./billing.js');
const { getConfigCached } = require('./config.js');
const { t } = require('./i18n.js');

const COLOR_MUSICA = '#1db954'; // verde "música"

// Valores por defecto de la configuración de música (espejo del modelo).
const MUSICA_DEFAULTS = {
    activo: true, canalMusicaId: null, djRolId: null, soloMismoCanal: true,
    volumenDefecto: 60, volumenMax: 150, maxCola: 100,
    permitirPlaylists: true, anunciarAhora: true, autoSalir: true, modo247: false, autoplay: 'off',
    fuentes: { youtube: true, spotify: true, soundcloud: true },
};

// ¿Este servidor tiene el modo 24/7 activo Y plan Pro? (la música base es gratis;
// el 24/7 es un extra de Pro). Hace una consulta porque getMusicaConfig no trae
// los campos de plan.
async function es247(guildId) {
    try {
        const cfg = await ServidorConfig.findOne({ guildId });
        return !!(cfg && esPro(cfg) && cfg.musica && cfg.musica.modo247);
    } catch { return false; }
}

// Modo de autoplay EFECTIVO del servidor: 'off' si no es Pro o no está activado;
// si no, 'aleatorio' o 'repetir'. (El autoplay es un extra de Pro, como el 24/7.)
async function modoAutoplay(guildId) {
    try {
        const cfg = await ServidorConfig.findOne({ guildId });
        if (!cfg || !esPro(cfg)) return 'off';
        const a = cfg.musica && cfg.musica.autoplay;
        return (a === 'aleatorio' || a === 'repetir') ? a : 'off';
    } catch { return 'off'; }
}

// Busca pistas "similares" a la última para el autoplay aleatorio: busca por el
// artista/título en YouTube Music, descarta la misma y baraja. Devuelve hasta n.
async function pistasAleatorias(player, lastTrack, n = 5) {
    if (!lastTrack) return [];
    const q = lastTrack.info?.author || lastTrack.info?.title;
    if (!q) return [];
    let res;
    try { res = await player.search({ query: q, source: 'ytmsearch' }, lastTrack.requester); }
    catch { return []; }
    const id = lastTrack.info?.identifier;
    const tracks = (res?.tracks || []).filter((t) => t.info?.identifier && t.info.identifier !== id);
    for (let i = tracks.length - 1; i > 0; i--) {           // baraja (Fisher-Yates)
        const j = Math.floor(Math.random() * (i + 1));
        [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
    }
    return tracks.slice(0, n);
}

// Último mensaje-panel de música por servidor, para editarlo/reemplazarlo.
const panelMsgs = new Map(); // guildId -> { channelId, messageId }

// Estado del servidor de música (Lavalink) para el panel. Desde marzo de 2026
// Discord solo deja sonar el audio cifrado (DAVE): con Lavalink anterior a 4.2
// el bot entra al canal y «reproduce», pero Discord cierra la voz (código 4017)
// y no se oye nada. Se guarda para avisar en el panel y en el canal.
const LAVALINK_MINIMO = [4, 2, 0];
// youtubeBloqueado: última vez que YouTube pidió iniciar sesión para dejar sonar una
// canción. youtubeSinSalida: última vez que ni otra versión de la canción sirvió.
const estadoServidor = { conectado: false, version: null, desactualizado: false, vozRechazada: null, youtubeBloqueado: null, youtubeSinSalida: null };
const versionVieja = (v) => {
    if (!v) return false;
    const x = [v.major, v.minor, v.patch].map((n) => Number(n) || 0);
    for (let i = 0; i < 3; i++) if (x[i] !== LAVALINK_MINIMO[i]) return x[i] < LAVALINK_MINIMO[i];
    return false;
};
// vozRechazada / youtubeBloqueado: si ha pasado en la última media hora.
const MEDIA_HORA = 30 * 60 * 1000;
const reciente = (momento, ms = MEDIA_HORA) => !!momento && Date.now() - momento < ms;
const estadoServidorMusica = () => {
    let cuenta = 'sin-cuenta';
    try { cuenta = require('./cuentaYoutube.js').estadoCuenta().estado; } catch { /* sin archivo */ }
    return {
        conectado: estadoServidor.conectado,
        version: estadoServidor.version,
        desactualizado: estadoServidor.desactualizado,
        vozRechazada: reciente(estadoServidor.vozRechazada),
        youtubeBloqueado: reciente(estadoServidor.youtubeBloqueado),
        cuentaYoutube: cuenta,
    };
};

// Por qué no ha sonado una canción, a partir del error de Lavalink (que junta el
// de cada cliente de YouTube: «Client [ANDROID_VR] failed: This video requires login…»).
//   'edad'          → restricción de edad (YouTube pide iniciar sesión para confirmarla)
//   'login'         → YouTube pide iniciar sesión / cree que somos un bot
//   'no-disponible' → vídeo privado, borrado o bloqueado en este país
//   'otro'          → cualquier otra cosa
function motivoFallo(mensaje) {
    const m = String(mensaje || '');
    if (/confirm your age|age[- ]restricted|inappropriate for some users/i.test(m)) return 'edad';
    if (/requires? (login|sign[- ]?in)|sign in to confirm|not a bot|login_required|please sign in/i.test(m)) return 'login';
    if (/not available|unavailable|private video|has been removed|blocked it|copyright|no longer available|terminated/i.test(m)) return 'no-disponible';
    return 'otro';
}

// Quita del título lo que estorba para buscar la misma canción en otro vídeo:
// «(Official Video)», «[Lyrics]», «(Audio)», «| 4K»…
function tituloParaBuscar(info = {}) {
    let titulo = String(info.title || '')
        .replace(/[([{][^)\]}]*(official|oficial|video|vídeo|lyric|letra|audio|visuali[sz]er|clip|mv|hd|4k|remaster)[^)\]}]*[)\]}]/gi, ' ')
        .replace(/\s+[|•·]\s+.*$/, '')
        .replace(/\s+/g, ' ').trim();
    const autor = String(info.author || '').replace(/\s*-\s*topic$/i, '').replace(/vevo$/i, '').trim();
    if (autor && !titulo.toLowerCase().includes(autor.toLowerCase())) titulo = `${autor} ${titulo}`;
    return titulo;
}

// Otra subida de la misma canción (otro vídeo de YouTube con una duración parecida).
// Primero en YouTube Music (suele ser el audio oficial), luego en YouTube normal.
async function otraVersion(player, track) {
    const info = track?.info || {};
    const q = tituloParaBuscar(info);
    if (!q) return null;
    const dur = Number(info.duration) || 0;
    const parecida = (p) => p?.info?.identifier && p.info.identifier !== info.identifier && !p.info.isStream
        && (!dur || Math.abs((Number(p.info.duration) || 0) - dur) <= Math.max(15000, dur * 0.15));
    for (const source of ['ytmsearch', 'ytsearch']) {
        try {
            const r = await player.search({ query: q, source }, track.requester);
            const alt = (r?.tracks || []).find(parecida);
            if (alt) return alt;
        } catch { /* se prueba la siguiente búsqueda */ }
    }
    return null;
}

// Fuentes que en realidad suenan desde YouTube (Spotify, Apple Music… van en modo espejo).
const DESDE_YOUTUBE = new Set(['youtube', 'spotify', 'applemusic', 'deezer', 'youtubemusic']);

// Lee la configuración de música de un servidor, con los defaults aplicados.
async function getMusicaConfig(guildId) {
    try {
        const doc = await ServidorConfig.findOne({ guildId }).lean();
        const m = doc?.musica || {};
        return { ...MUSICA_DEFAULTS, ...m, fuentes: { ...MUSICA_DEFAULTS.fuentes, ...(m.fuentes || {}) } };
    } catch {
        return { ...MUSICA_DEFAULTS };
    }
}

// Busca en qué servidor y canal de voz está conectado un usuario ahora mismo.
// Devuelve { guild, voiceChannel, member } o null si no está en ninguno.
function encontrarContextoVoz(client, userId) {
    for (const [, guild] of client.guilds.cache) {
        const vs = guild.voiceStates.cache.get(userId);
        if (vs?.channelId) {
            const voiceChannel = guild.channels.cache.get(vs.channelId);
            if (voiceChannel) return { guild, voiceChannel, member: vs.member };
        }
    }
    return null;
}

// ¿Puede este miembro controlar la música? (rol DJ si está configurado).
function puedeControlar(member, cfg) {
    if (!cfg?.djRolId) return true;                       // sin rol DJ: cualquiera
    if (member?.permissions?.has?.('ManageGuild')) return true; // admins siempre
    return !!member?.roles?.cache?.has?.(cfg.djRolId);
}

// Convierte una pista de Lavalink en un objeto simple para enviar al frontend.
function trackJSON(t) {
    if (!t) return null;
    return {
        title: t.info?.title || 'Desconocido',
        author: t.info?.author || '',
        uri: t.info?.uri || null,
        duration: t.info?.duration || 0,
        artwork: t.info?.artworkUrl || null,
        isStream: !!t.info?.isStream,
        requester: t.requester?.username || null,
    };
}

// Estado completo del reproductor de un servidor, listo para el frontend.
function serializarEstado(player) {
    if (!player) return { conectado: false };
    return {
        conectado: true,
        reproduciendo: !!player.playing,
        pausado: !!player.paused,
        volumen: player.volume,
        posicion: player.position || 0,
        canalVozId: player.voiceChannelId,
        actual: trackJSON(player.queue.current),
        cola: player.queue.tracks.map(trackJSON),
    };
}

// Convierte milisegundos a un texto tipo "3:45" o "1:02:30".
function formatDuration(ms, idioma) {
    if (!ms || ms <= 0) return t(idioma, 'EN DIRECTO', 'LIVE');
    const totalSeg = Math.floor(ms / 1000);
    const h = Math.floor(totalSeg / 3600);
    const m = Math.floor((totalSeg % 3600) / 60);
    const s = totalSeg % 60;
    const dosDigitos = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${dosDigitos(m)}:${dosDigitos(s)}` : `${m}:${dosDigitos(s)}`;
}

// Comprueba que el usuario está en un canal de voz y que el bot puede entrar.
// Devuelve { ok, channel, error } para usar en los comandos.
async function ensureVoice(interaction) {
    const cfg = await getConfigCached(interaction.guildId).catch(() => null);
    const channel = interaction.member?.voice?.channel;
    if (!channel) {
        return { ok: false, error: t(cfg, '🔇 Tienes que estar en un canal de voz para usar la música.', '🔇 You need to be in a voice channel to use music.') };
    }
    const me = interaction.guild.members.me;
    const permisos = channel.permissionsFor(me);
    if (!permisos?.has('Connect') || !permisos?.has('Speak')) {
        return { ok: false, error: t(cfg, '🚫 No tengo permiso para **unirme o hablar** en tu canal de voz.', '🚫 I don’t have permission to **join or speak** in your voice channel.') };
    }
    if (me.voice.channelId && me.voice.channelId !== channel.id) {
        return { ok: false, error: t(cfg, '🎧 Ya estoy reproduciendo en otro canal de voz.', '🎧 I’m already playing in another voice channel.') };
    }
    return { ok: true, channel };
}

// Barra de progreso de texto para el embed (▬▬🔘▬▬).
function progresoBarra(pos, total, len = 16, idioma) {
    if (!total) return t(idioma, '🔴 EN DIRECTO', '🔴 LIVE');
    const llenos = Math.min(len, Math.round((pos / total) * len));
    return '▬'.repeat(llenos) + '🔘' + '▬'.repeat(Math.max(0, len - llenos));
}
const capitalizar = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '—');

// Saca una URL de avatar válida del que pidió la canción (o undefined).
// Discord exige URL completa: interaction.user da displayAvatarURL(); desde la
// web puede llegar solo el hash (no sirve) → en ese caso, sin icono.
function avatarUrl(req) {
    if (!req) return undefined;
    if (typeof req.displayAvatarURL === 'function') return req.displayAvatarURL();
    const url = req.avatarURL || req.avatar;
    return typeof url === 'string' && url.startsWith('http') ? url : undefined;
}
const btnMusica = (id, emoji, style, disabled = false) =>
    new ButtonBuilder().setCustomId(id).setEmoji(emoji).setStyle(style).setDisabled(!!disabled);

// Construye el PANEL visual (embed + 2 filas de botones) del reproductor.
function construirPanel(player, cfg, idioma) {
    const t2 = player.queue.current;
    if (!t2) return null;
    const enCola = player.queue.tracks.length;
    const modo = typeof player.getData === 'function' ? player.getData('sokyoAutoplay') : null;

    // Color dinámico: pausa → naranja, autoplay aleatorio → morado, repetir → azul, normal → verde.
    const color = player.paused ? '#f0a500'
        : modo === 'aleatorio' ? '#9b59b6'
        : modo === 'repetir'   ? '#3498db'
        : COLOR_MUSICA;

    // Línea de estado en el autor.
    const estadoIcon = player.paused ? '⏸️' : '▶️';
    const modoSufijo = modo === 'repetir' ? t(idioma, '  ·  🔁 Cola en bucle', '  ·  🔁 Loop queue')
        : modo === 'aleatorio' ? t(idioma, '  ·  🎲 Autoplay', '  ·  🎲 Autoplay')
        : '';
    const autorTxt = `${estadoIcon} ${t(idioma, 'Sonando ahora', 'Now playing')}${modoSufijo}`;

    // Fuente con icono.
    const FUENTE_ICONO = { youtube: '▶️ YouTube', spotify: '🎵 Spotify', soundcloud: '🔶 SoundCloud' };
    const fuente = FUENTE_ICONO[t2.info.sourceName?.toLowerCase()] || capitalizar(t2.info.sourceName);

    const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: autorTxt })
        .setTitle(t2.info.title)
        .setURL(t2.info.uri || null)
        .setDescription(
            `**${t2.info.author || t(idioma, 'Desconocido', 'Unknown')}**\n\n` +
            `\`${formatDuration(player.position, idioma)}\`  ${progresoBarra(player.position, t2.info.duration, 16, idioma)}  \`${formatDuration(t2.info.duration, idioma)}\``
        )
        .addFields(
            { name: t(idioma, '🔊 Volumen', '🔊 Volume'), value: `${player.volume}%`, inline: true },
            { name: t(idioma, '📋 En cola', '📋 In queue'), value: t(idioma, `${enCola} ${enCola === 1 ? 'canción' : 'canciones'}`, `${enCola} ${enCola === 1 ? 'song' : 'songs'}`), inline: true },
            { name: t(idioma, '🎚️ Fuente', '🎚️ Source'), value: fuente, inline: true },
        );

    if (t2.info.artworkUrl) embed.setThumbnail(t2.info.artworkUrl);
    if (t2.requester?.username) {
        embed.setFooter({ text: t(idioma, `Pedido por ${t2.requester.username}`, `Requested by ${t2.requester.username}`), iconURL: avatarUrl(t2.requester) });
    }

    // Botón de autoplay: muestra el estado actual y cicla al hacer clic.
    const autoplayLabel = modo === 'aleatorio' ? t(idioma, '🎲 Autoplay: ON', '🎲 Autoplay: ON')
        : modo === 'repetir' ? t(idioma, '🔁 Bucle: ON', '🔁 Loop: ON')
        : t(idioma, '🎲 Autoplay', '🎲 Autoplay');
    const autoplayStyle = modo && modo !== 'off' ? ButtonStyle.Primary : ButtonStyle.Secondary;

    const fila1 = new ActionRowBuilder().addComponents(
        btnMusica('music_toggle', player.paused ? '▶️' : '⏸️', ButtonStyle.Success),
        btnMusica('music_skip', '⏭️', ButtonStyle.Secondary),
        btnMusica('music_stop', '⏹️', ButtonStyle.Danger),
        btnMusica('music_shuffle', '🔀', ButtonStyle.Secondary, enCola < 2),
    );
    const fila2 = new ActionRowBuilder().addComponents(
        btnMusica('music_voldown', '🔉', ButtonStyle.Secondary, player.volume <= 0),
        btnMusica('music_volup', '🔊', ButtonStyle.Secondary, player.volume >= (cfg?.volumenMax ?? 150)),
        new ButtonBuilder().setCustomId('music_autoplay').setLabel(autoplayLabel).setStyle(autoplayStyle),
        // Cualquiera puede ver la letra o guardarse la canción (no hace falta ser DJ).
        new ButtonBuilder().setCustomId('music_letra').setEmoji('📝').setLabel(t(idioma, 'Letra', 'Lyrics')).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_guardar').setEmoji('❤️').setLabel(t(idioma, 'Guardar', 'Save')).setStyle(ButtonStyle.Secondary),
    );
    return { embeds: [embed], components: [fila1, fila2] };
}

// Publica el panel en el canal de música (borra el anterior para repostear abajo).
// Todo va dentro de try/catch: un fallo del panel nunca debe tumbar el bot.
async function enviarPanel(client, player, cfg) {
    try {
        const idioma = await getConfigCached(player.guildId).catch(() => null);
        const panel = construirPanel(player, cfg, idioma);
        if (!panel) return;
        const channelId = cfg.canalMusicaId || player.textChannelId;
        const canal = client.channels.cache.get(channelId);
        if (!canal?.isTextBased()) return;
        const prev = panelMsgs.get(player.guildId);
        if (prev) {
            const c = client.channels.cache.get(prev.channelId);
            c?.messages?.delete(prev.messageId).catch(() => {});
        }
        const msg = await canal.send(panel).catch(() => null);
        if (msg) panelMsgs.set(player.guildId, { channelId: canal.id, messageId: msg.id });
    } catch (e) {
        console.error('🎵 Error al enviar el panel de música:', e.message);
    }
}

// Maneja los botones del panel (⏯️ ⏭️ ⏹️ 🔀 🔉 🔊).
async function manejarBotonMusica(interaction, client) {
    const idioma = await getConfigCached(interaction.guildId).catch(() => null);
    const player = client.lavalink.getPlayer(interaction.guildId);
    if (!player || !player.queue.current) {
        return interaction.reply({ content: t(idioma, '⏹️ Ahora mismo no suena nada.', '⏹️ Nothing is playing right now.'), flags: 64 });
    }
    // 📝 Letra y ❤️ Guardar: para cualquiera, aunque no esté en el canal de voz.
    if (interaction.customId === 'music_letra' || interaction.customId === 'music_guardar') {
        const extra = require('./musicaExtra.js');
        const { idiomaInteraccion } = require('./preferencias.js');
        const suIdioma = await idiomaInteraccion(interaction, idioma);
        const pista = player.queue.current;
        if (interaction.customId === 'music_guardar') {
            const r = await extra.guardarEnFavoritas(interaction.user.id, pista, suIdioma).catch(() => ({ texto: t(suIdioma, '❌ No he podido guardarla. Prueba otra vez.', '❌ I couldn’t save it. Try again.') }));
            return interaction.reply({ content: r.texto, flags: 64 });
        }
        await interaction.deferReply({ flags: 64 });
        return interaction.editReply(await extra.respuestaLetra(pista.info.title, pista.info.author, pista.info.duration, suIdioma));
    }
    const cfg = await getMusicaConfig(interaction.guildId);
    const canalUsuario = interaction.member?.voice?.channel;
    if (!canalUsuario) {
        return interaction.reply({ content: t(idioma, '🔇 Únete a un canal de voz para controlar la música.', '🔇 Join a voice channel to control the music.'), flags: 64 });
    }
    if (cfg.soloMismoCanal && player.voiceChannelId && canalUsuario.id !== player.voiceChannelId) {
        return interaction.reply({ content: t(idioma, '🎧 Tienes que estar en el mismo canal de voz que el bot.', '🎧 You need to be in the same voice channel as the bot.'), flags: 64 });
    }
    if (!puedeControlar(interaction.member, cfg)) {
        return interaction.reply({ content: t(idioma, '🎚️ Necesitas el rol de **DJ** para controlar la música.', '🎚️ You need the **DJ** role to control the music.'), flags: 64 });
    }

    let parar = false;
    switch (interaction.customId) {
        case 'music_toggle': player.paused ? await player.resume() : await player.pause(); break;
        case 'music_skip': {
            // Con más gente escuchando, saltar la canción de otro se vota.
            const { votarSaltar, textoVoto } = require('./musicaExtra.js');
            const voto = votarSaltar(player, interaction.member, cfg);
            if (!voto.saltar) return interaction.reply({ content: textoVoto(voto, idioma), flags: 64 });
            if (!player.queue.tracks.length) {
                // Última canción: en 24/7 paramos pero seguimos en el canal; si no, salimos.
                if (await es247(interaction.guildId)) { await player.stopPlaying().catch(() => {}); }
                else { await player.destroy(); parar = true; }
            } else await player.skip();
            break;
        }
        case 'music_stop': await player.destroy(); parar = true; break;
        case 'music_shuffle': if (typeof player.queue.shuffle === 'function') await player.queue.shuffle(); break;
        case 'music_voldown': await player.setVolume(Math.max(0, player.volume - 10)); break;
        case 'music_volup': await player.setVolume(Math.min(cfg.volumenMax, player.volume + 10)); break;
        case 'music_autoplay': {
            const cfgDoc = await ServidorConfig.findOne({ guildId: interaction.guildId });
            if (!cfgDoc || !esPro(cfgDoc)) {
                return interaction.reply({ content: t(idioma, '⭐ **Autoplay** es una función **Pro**. Actívala desde el panel web.', '⭐ **Autoplay** is a **Pro** feature. Enable it from the web panel.'), flags: 64 });
            }
            // Ciclo: off → aleatorio → repetir → off
            const modoActual = cfgDoc.musica?.autoplay || 'off';
            const siguienteModo = modoActual === 'off' ? 'aleatorio' : modoActual === 'aleatorio' ? 'repetir' : 'off';
            if (!cfgDoc.musica) cfgDoc.musica = {};
            cfgDoc.musica.autoplay = siguienteModo;
            cfgDoc.markModified('musica');
            await cfgDoc.save().catch(() => {});
            // Sincronizar en el player en caliente.
            player.setData('sokyoAutoplay', siguienteModo);
            await player.setRepeatMode(siguienteModo === 'repetir' ? 'queue' : 'off').catch(() => {});
            break;
        }
        default: return interaction.deferUpdate().catch(() => {});
    }

    if (parar) {
        panelMsgs.delete(interaction.guildId);
        const fin = new EmbedBuilder().setColor(COLOR_MUSICA)
            .setAuthor({ name: t(idioma, '⏹️ Música detenida', '⏹️ Music stopped') })
            .setDescription(t(idioma, '¡La reproducción ha terminado. Hasta la próxima!', 'Playback has ended. See you next time!'));
        return interaction.update({ embeds: [fin], components: [] }).catch(() => {});
    }
    // Skip: el nuevo trackStart repostea el panel; aquí solo confirmamos.
    if (interaction.customId === 'music_skip') return interaction.deferUpdate().catch(() => {});
    // Resto: actualizamos el panel en el sitio.
    return interaction.update(construirPanel(player, cfg, idioma)).catch(() => {});
}

// Puerta de entrada para los comandos: está en voz + música activa + rol DJ.
// Devuelve { ok, channel, cfg } o { ok:false, error }.
async function gateMusica(interaction) {
    const idioma = await getConfigCached(interaction.guildId).catch(() => null);
    const voz = await ensureVoice(interaction);
    if (!voz.ok) return voz;
    const cfg = await getMusicaConfig(interaction.guildId);
    if (!cfg.activo) return { ok: false, error: t(idioma, '🚫 La música está desactivada en este servidor.', '🚫 Music is disabled on this server.') };
    if (!puedeControlar(interaction.member, cfg)) {
        return { ok: false, error: t(idioma, '🎧 Necesitas el rol de **DJ** para controlar la música.', '🎧 You need the **DJ** role to control the music.') };
    }
    return { ok: true, channel: voz.channel, cfg };
}

function initMusica(client) {
    // Autoplay ALEATORIO: lo llama la librería cuando se vacía la cola. Si el
    // servidor (Pro) tiene autoplay='aleatorio', añade música similar a la última
    // y avisa en el canal. Si no añade nada, sigue el flujo normal (auto-salida).
    const autoPlayFunction = async (player, lastTrack) => {
        try {
            if ((await modoAutoplay(player.guildId)) !== 'aleatorio') return;
            const tracks = await pistasAleatorias(player, lastTrack, 5);
            if (!tracks.length) return;
            await player.queue.add(tracks);
            // No enviamos mensaje suelto: el panel de trackStart ya muestra el badge 🎲.
        } catch (e) { console.error('Autoplay aleatorio:', e.message); }
    };

    client.lavalink = new LavalinkManager({
        nodes: [
            {
                id: 'sokyo-node',
                host: process.env.LAVALINK_HOST || 'localhost',
                port: Number(process.env.LAVALINK_PORT) || 2333,
                authorization: process.env.LAVALINK_PASSWORD || 'sokyolavalink',
                // Margen para resolver álbumes/playlists grandes de Spotify (defecto 10s).
                requestSignalTimeoutMS: 30000,
            },
        ],
        // El ID del bot debe estar disponible YA en el primer handshake con
        // Lavalink (es el del .env, igual que el user del bot). En 'ready' se
        // refina con el username real.
        client: {
            id: process.env.DISCORD_CLIENT_ID,
            username: 'Sokyo',
        },
        // Cómo enviar los paquetes de voz al gateway de Discord.
        sendToShard: (guildId, payload) =>
            client.guilds.cache.get(guildId)?.shard?.send(payload),
        autoSkip: true,
        playerOptions: {
            defaultSearchPlatform: 'ytmsearch', // YouTube Music: prioriza la versión oficial
            onEmptyQueue: { destroyAfterMs: 60_000, autoPlayFunction }, // sale 1 min tras vaciarse (salvo autoplay)
            onDisconnect: { autoReconnect: true, destroyPlayer: false },
        },
    });

    // Estado del nodo Lavalink (para ver en consola si conecta).
    client.lavalink.nodeManager
        .on('connect', async (node) => {
            estadoServidor.conectado = true;
            const info = node.info || await node.fetchInfo().catch(() => null);
            estadoServidor.version = info?.version?.semver || null;
            estadoServidor.desactualizado = versionVieja(info?.version);
            console.log(`🎵 Lavalink conectado (nodo: ${node.id}${estadoServidor.version ? `, versión ${estadoServidor.version}` : ''})`);
            if (estadoServidor.desactualizado) {
                console.error(`🎵 Lavalink ${estadoServidor.version} es demasiado viejo: Discord exige audio cifrado (DAVE) y eso necesita Lavalink 4.2 o más nuevo. Reinicia el servidor de música (pm2 restart lavalink) y se actualizará solo.`);
            }
            // Cuenta de YouTube guardada (panel → Música): se le pasa a Lavalink cada vez
            // que se conecta, también tras reiniciarse él.
            require('./cuentaYoutube.js').aplicarAlConectar().catch(() => {});
        })
        .on('disconnect', (node) => { estadoServidor.conectado = false; console.warn(`🎵 Lavalink desconectado (nodo: ${node.id})`); })
        .on('error', (node, error) =>
            console.error(`🎵 Error de Lavalink (nodo: ${node.id}):`, error?.message || error));

    // Discord ha cerrado la conexión de voz. 4017 = exige audio cifrado (DAVE) y
    // este Lavalink no lo hace (viejo, o un sistema sin glibc 2.35): no sonará.
    client.lavalink.on('playerSocketClosed', async (player, payload) => {
        if (payload?.code !== 4017) return;
        estadoServidor.vozRechazada = Date.now();
        console.error(`🎵 Discord ha rechazado la voz en ${player.guildId} (4017: exige audio cifrado DAVE). Lavalink ${estadoServidor.version || '?'}: hace falta 4.2 o más nuevo y glibc 2.35+ (Raspberry Pi OS Bookworm).`);
        if (player.getData('sokyoAvisoVoz')) return; // un aviso por reproductor
        player.setData('sokyoAvisoVoz', true);
        const idioma = await getConfigCached(player.guildId).catch(() => null);
        const canal = client.channels.cache.get(player.textChannelId);
        if (canal?.isTextBased()) {
            canal.send(t(idioma,
                '🔇 Discord no deja sonar el audio: el servidor de música necesita actualizarse (desde 2026 Discord exige audio cifrado). Avisa al dueño del bot; en cuanto se actualice volverá a sonar.',
                '🔇 Discord won’t let the audio play: the music server needs an update (since 2026 Discord requires encrypted audio). Let the bot owner know; it will play again once it’s updated.')).catch(() => {});
        }
    });

    // Una canción que no se puede reproducir (YouTube la bloquea, se cae el
    // directo…): se prueba UNA vez con otra versión de la misma canción y, si no
    // hay, se dice en el canal con palabras normales (antes salía el error de Java).
    // La librería ya ha pasado a la siguiente (o ha acabado la cola) mientras se busca:
    // por eso la otra versión va justo detrás de lo que suene, o suena ya si no hay nada.
    // `sokyoReintento` (la búsqueda en curso) lo mira queueEnd para no decir «cola vacía».
    client.lavalink.on('trackError', (player, track, payload) => {
        const mensaje = String(payload?.exception?.message || payload?.error || '');
        const motivo = motivoFallo(mensaje);
        console.warn(`🎵 No se pudo reproducir «${track?.info?.title || '?'}» en ${player.guildId}: ${mensaje.replace(/\s+at\s+[\w.$]+\([^)]*\)/g, '').replace(/\s+/g, ' ').slice(0, 500) || 'sin detalle'}`);
        // Solo «pide iniciar sesión» avisa de bloqueo en el panel: una canción con
        // restricción de edad no dice nada del resto.
        if (motivo === 'login') estadoServidor.youtubeBloqueado = Date.now();

        const esReintento = !!track?.userData?.sokyoReintentoDe;
        // Si hace poco ni otra versión sirvió porque YouTube pide iniciar sesión, buscar
        // otra vez solo retrasa el siguiente aviso.
        const youtubeCerrado = motivo === 'login' && reciente(estadoServidor.youtubeSinSalida, 10 * 60 * 1000);
        const probarOtra = !!track && !esReintento && !youtubeCerrado && !track.info?.isStream
            && DESDE_YOUTUBE.has(String(track.info?.sourceName || '').toLowerCase());

        const tarea = (async () => {
            const idioma = await getConfigCached(player.guildId).catch(() => null);
            const enviar = (texto) => {
                const canal = client.channels.cache.get(player.textChannelId);
                if (canal?.isTextBased()) canal.send({ content: texto, allowedMentions: { parse: [] } }).catch(() => {});
            };
            const titulo = track?.userData?.sokyoTituloOriginal || track?.info?.title || t(idioma, 'esta canción', 'this song');
            const sigue = () => client.lavalink.getPlayer(player.guildId) === player;

            if (probarOtra) {
                const alt = await otraVersion(player, track).catch(() => null);
                if (alt && sigue()) {
                    alt.userData = { ...(alt.userData || {}), sokyoReintentoDe: track.info.identifier, sokyoTituloOriginal: track.info.title };
                    const actual = player.queue.current;
                    // Lavalink solo da por acabada la que falla cuando la voz le pide audio:
                    // si aún no lo ha hecho (p. ej. falla antes de entrar al canal), se cambia ya.
                    const sigueLaFallida = !!actual && (actual === track || (!!actual.encoded && actual.encoded === track.encoded));
                    if (sigueLaFallida) await player.play({ clientTrack: alt, noReplace: false });
                    else if (actual) await player.queue.add(alt, 0);              // ya suena otra: va justo después
                    else { await player.queue.add(alt); await player.play(); }   // la cola se había acabado
                    enviar(t(idioma,
                        `🔁 **${titulo}** no se podía reproducir en ese vídeo de YouTube; pongo otra versión de la misma canción.`,
                        `🔁 **${titulo}** couldn’t play from that YouTube video; playing another version of the same song.`));
                    return true;
                }
            }

            if (esReintento && motivo === 'login') estadoServidor.youtubeSinSalida = Date.now();
            const tambien = esReintento ? t(idioma, ' (tampoco otra versión)', ' (nor another version)') : '';
            const causa = {
                login: t(idioma, 'YouTube pide iniciar sesión para dejarla sonar', 'YouTube is asking to sign in before it lets it play'),
                edad: t(idioma, 'tiene restricción de edad en YouTube', 'it’s age-restricted on YouTube'),
                'no-disponible': t(idioma, 'el vídeo no está disponible (privado, borrado o bloqueado en este país)', 'the video isn’t available (private, removed or blocked in this country)'),
            }[motivo];
            // «Paso a la siguiente» solo si hay otra: suena una distinta o queda cola.
            const actual = player.queue.current;
            const otraSuena = !!actual && actual !== track && !(actual.encoded && actual.encoded === track?.encoded);
            const siguiente = sigue() && (otraSuena || player.queue.tracks.length > 0) ? t(idioma, ' Paso a la siguiente.', ' Skipping to the next one.') : '';
            let texto = causa
                ? t(idioma, `⚠️ No he podido reproducir **${titulo}**${tambien}: ${causa}.${siguiente}`, `⚠️ I couldn’t play **${titulo}**${tambien}: ${causa}.${siguiente}`)
                : t(idioma, `⚠️ No he podido reproducir **${titulo}**${tambien}.${siguiente}`, `⚠️ I couldn’t play **${titulo}**${tambien}.${siguiente}`);
            // Cuando YouTube pide iniciar sesión, la solución es conectar una cuenta (la hace el dueño).
            if ((motivo === 'login' || motivo === 'edad') && require('./cuentaYoutube.js').estadoCuenta().estado !== 'conectada') {
                texto += '\n' + t(idioma,
                    '-# Si pasa con todas las canciones, el dueño del bot puede arreglarlo en el panel: Música → «Cuenta de YouTube».',
                    '-# If it happens with every song, the bot owner can fix it in the panel: Music → “YouTube account”.');
            }
            enviar(texto);
            return false;
        })().catch((e) => { console.error('🎵 Error al tratar una canción fallida:', e.message); return false; });

        player.setData('sokyoReintento', tarea);
        tarea.finally(() => { if (player.getData('sokyoReintento') === tarea) player.setData('sokyoReintento', undefined); });
    });

    // Panel visual "Reproduciendo ahora" (embed + botones) en cada canción.
    client.lavalink.on('trackStart', async (player) => {
        // Sincroniza el modo autoplay: 'repetir' usa el repeatMode NATIVO de la
        // cola; lo guardamos en el player para pintar el badge del panel.
        const modo = await modoAutoplay(player.guildId);
        player.setData('sokyoAutoplay', modo);
        const objetivo = modo === 'repetir' ? 'queue' : 'off';
        if (player.repeatMode !== objetivo) await player.setRepeatMode(objetivo).catch(() => {});

        const cfg = await getMusicaConfig(player.guildId);
        if (!cfg.anunciarAhora) return;
        await enviarPanel(client, player, cfg);
    });

    // Modo 24/7 (Pro): la librería programa la auto-salida al vaciarse la cola
    // (onEmptyQueue) guardando el temporizador en player.getData('internal_queueempty').
    // Para los servidores Pro con 24/7, lo cancelamos para que el bot se quede.
    // setImmediate: el timer se crea JUSTO DESPUÉS de emitirse este evento.
    client.lavalink.on('playerQueueEmptyStart', (player) => {
        setImmediate(async () => {
            try {
                if (!(await es247(player.guildId))) return;
                const id = player.getData('internal_queueempty');
                if (id) { clearTimeout(id); player.setData('internal_queueempty', undefined); }
            } catch (e) { console.error('24/7 (cancelar salida):', e.message); }
        });
    });

    // Al acabarse la cola: quitar el panel y avisar.
    client.lavalink.on('queueEnd', async (player) => {
        // La última canción ha fallado y se está buscando otra versión: si la hay, la
        // música sigue y no toca decir «la cola está vacía».
        const reintento = player.getData('sokyoReintento');
        if (reintento && await reintento) return;
        const prev = panelMsgs.get(player.guildId);
        if (prev) {
            const c = client.channels.cache.get(prev.channelId);
            c?.messages?.delete(prev.messageId).catch(() => {});
            panelMsgs.delete(player.guildId);
        }
        const cfg = await getMusicaConfig(player.guildId);
        const idioma = await getConfigCached(player.guildId).catch(() => null);
        const canal = client.channels.cache.get(cfg.canalMusicaId || player.textChannelId);
        if (canal?.isTextBased()) {
            const seQueda = await es247(player.guildId);
            canal.send(seQueda
                ? t(idioma, '🎵 La cola está vacía. Me quedo en el canal (modo 24/7). Añade más música cuando quieras.', '🎵 The queue is empty. I’m staying in the channel (24/7 mode). Add more music whenever you like.')
                : t(idioma, '🎵 La cola está vacía. Saldré del canal si no añades más música.', '🎵 The queue is empty. I’ll leave the channel if you don’t add more music.')).catch(() => {});
        }
    });

    // Reenviar los paquetes de voz crudos de Discord a Lavalink.
    client.on('raw', (d) => client.lavalink.sendRawData(d));

    // Inicializar el manager cuando el bot ya tenga sesión.
    client.once('ready', () => {
        client.lavalink.init({ id: client.user.id, username: client.user.username });
    });

    return client.lavalink;
}

// Busca pistas priorizando la versión OFICIAL de la canción:
//   1. Si es una URL (YouTube/Spotify/…), la resuelve tal cual.
//   2. Si es texto, busca primero en YouTube MUSIC (ytmsearch) -> devuelve la
//      canción/álbum oficial en vez de un vídeo random (lives, covers, loops…).
//   3. Si Music no encuentra nada (p. ej. algo que no es música), cae a
//      YouTube normal (ytsearch) para no quedarse sin resultados.
// `buscador` puede ser un player o un nodo de Lavalink (ambos tienen .search).
async function buscarMusica(buscador, query, requester) {
    const esUrl = /^https?:\/\//i.test(query) || query.startsWith('spotify:');
    if (esUrl) return buscador.search({ query }, requester);

    const hayResultados = (r) => r && r.tracks?.length && r.loadType !== 'empty' && r.loadType !== 'error';

    // Si YouTube Music falla (no solo "sin resultados", sino un error del nodo),
    // no abortamos: probamos igualmente el respaldo en YouTube normal.
    try {
        const enMusic = await buscador.search({ query, source: 'ytmsearch' }, requester);
        if (hayResultados(enMusic)) return enMusic;
    } catch (e) {
        console.warn('Búsqueda en YouTube Music falló, probando YouTube normal:', e.message);
    }

    return buscador.search({ query, source: 'ytsearch' }, requester); // respaldo
}

module.exports = {
    initMusica, formatDuration, ensureVoice, gateMusica, COLOR_MUSICA,
    getMusicaConfig, encontrarContextoVoz, puedeControlar, serializarEstado, trackJSON,
    manejarBotonMusica, MUSICA_DEFAULTS, buscarMusica, es247, estadoServidorMusica,
    motivoFallo, tituloParaBuscar,
};
