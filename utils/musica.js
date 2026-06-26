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
function formatDuration(ms) {
    if (!ms || ms <= 0) return 'EN DIRECTO';
    const totalSeg = Math.floor(ms / 1000);
    const h = Math.floor(totalSeg / 3600);
    const m = Math.floor((totalSeg % 3600) / 60);
    const s = totalSeg % 60;
    const dosDigitos = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${dosDigitos(m)}:${dosDigitos(s)}` : `${m}:${dosDigitos(s)}`;
}

// Comprueba que el usuario está en un canal de voz y que el bot puede entrar.
// Devuelve { ok, channel, error } para usar en los comandos.
function ensureVoice(interaction) {
    const channel = interaction.member?.voice?.channel;
    if (!channel) {
        return { ok: false, error: '🔇 Tienes que estar en un canal de voz para usar la música.' };
    }
    const me = interaction.guild.members.me;
    const permisos = channel.permissionsFor(me);
    if (!permisos?.has('Connect') || !permisos?.has('Speak')) {
        return { ok: false, error: '🚫 No tengo permiso para **entrar o hablar** en tu canal de voz.' };
    }
    if (me.voice.channelId && me.voice.channelId !== channel.id) {
        return { ok: false, error: '🎧 Ya estoy reproduciendo en otro canal de voz.' };
    }
    return { ok: true, channel };
}

// Barra de progreso de texto para el embed (▬▬🔘▬▬).
function progresoBarra(pos, total, len = 16) {
    if (!total) return '🔴 EN DIRECTO';
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
function construirPanel(player, cfg) {
    const t = player.queue.current;
    if (!t) return null;
    const enCola = player.queue.tracks.length;
    const modo = typeof player.getData === 'function' ? player.getData('sokyoAutoplay') : null;

    // Color dinámico: pausa → naranja, autoplay aleatorio → morado, repetir → azul, normal → verde.
    const color = player.paused ? '#f0a500'
        : modo === 'aleatorio' ? '#9b59b6'
        : modo === 'repetir'   ? '#3498db'
        : COLOR_MUSICA;

    // Línea de estado en el autor.
    const estadoIcon = player.paused ? '⏸️' : '▶️';
    const modoSufijo = modo === 'repetir' ? '  ·  🔁 Repetir cola'
        : modo === 'aleatorio' ? '  ·  🎲 Autoplay'
        : '';
    const autorTxt = `${estadoIcon} Reproduciendo ahora${modoSufijo}`;

    // Fuente con icono.
    const FUENTE_ICONO = { youtube: '▶️ YouTube', spotify: '🎵 Spotify', soundcloud: '🔶 SoundCloud' };
    const fuente = FUENTE_ICONO[t.info.sourceName?.toLowerCase()] || capitalizar(t.info.sourceName);

    const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: autorTxt })
        .setTitle(t.info.title)
        .setURL(t.info.uri || null)
        .setDescription(
            `**${t.info.author || 'Desconocido'}**\n\n` +
            `\`${formatDuration(player.position)}\`  ${progresoBarra(player.position, t.info.duration)}  \`${formatDuration(t.info.duration)}\``
        )
        .addFields(
            { name: '🔊 Volumen', value: `${player.volume}%`, inline: true },
            { name: '📋 En cola', value: `${enCola} ${enCola === 1 ? 'canción' : 'canciones'}`, inline: true },
            { name: '🎚️ Fuente', value: fuente, inline: true },
        );

    if (t.info.artworkUrl) embed.setThumbnail(t.info.artworkUrl);
    if (t.requester?.username) {
        embed.setFooter({ text: `Pedida por ${t.requester.username}`, iconURL: avatarUrl(t.requester) });
    }

    // Botón de autoplay: muestra el estado actual y cicla al hacer clic.
    const autoplayLabel = modo === 'aleatorio' ? '🎲 Autoplay: ON'
        : modo === 'repetir' ? '🔁 Repetir: ON'
        : '🎲 Autoplay';
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
    );
    return { embeds: [embed], components: [fila1, fila2] };
}

// Publica el panel en el canal de música (borra el anterior para repostear abajo).
// Todo va dentro de try/catch: un fallo del panel nunca debe tumbar el bot.
async function enviarPanel(client, player, cfg) {
    try {
        const panel = construirPanel(player, cfg);
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
    const player = client.lavalink.getPlayer(interaction.guildId);
    if (!player || !player.queue.current) {
        return interaction.reply({ content: '⏹️ No hay nada sonando ahora mismo.', ephemeral: true });
    }
    const cfg = await getMusicaConfig(interaction.guildId);
    const canalUsuario = interaction.member?.voice?.channel;
    if (!canalUsuario) {
        return interaction.reply({ content: '🔇 Entra a un canal de voz para controlar la música.', ephemeral: true });
    }
    if (cfg.soloMismoCanal && player.voiceChannelId && canalUsuario.id !== player.voiceChannelId) {
        return interaction.reply({ content: '🎧 Tienes que estar en el mismo canal de voz que el bot.', ephemeral: true });
    }
    if (!puedeControlar(interaction.member, cfg)) {
        return interaction.reply({ content: '🎚️ Necesitas el rol **DJ** para controlar la música.', ephemeral: true });
    }

    let parar = false;
    switch (interaction.customId) {
        case 'music_toggle': player.paused ? await player.resume() : await player.pause(); break;
        case 'music_skip':
            if (!player.queue.tracks.length) {
                // Última canción: en 24/7 paramos pero seguimos en el canal; si no, salimos.
                if (await es247(interaction.guildId)) { await player.stopPlaying().catch(() => {}); }
                else { await player.destroy(); parar = true; }
            } else await player.skip();
            break;
        case 'music_stop': await player.destroy(); parar = true; break;
        case 'music_shuffle': if (typeof player.queue.shuffle === 'function') await player.queue.shuffle(); break;
        case 'music_voldown': await player.setVolume(Math.max(0, player.volume - 10)); break;
        case 'music_volup': await player.setVolume(Math.min(cfg.volumenMax, player.volume + 10)); break;
        case 'music_autoplay': {
            const cfgDoc = await ServidorConfig.findOne({ guildId: interaction.guildId });
            if (!cfgDoc || !esPro(cfgDoc)) {
                return interaction.reply({ content: '⭐ El **Autoplay** es una función **Pro**. Actívala desde el panel web.', ephemeral: true });
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
            .setAuthor({ name: '⏹️ Música detenida' })
            .setDescription('La reproducción ha terminado. ¡Hasta la próxima!');
        return interaction.update({ embeds: [fin], components: [] }).catch(() => {});
    }
    // Skip: el nuevo trackStart repostea el panel; aquí solo confirmamos.
    if (interaction.customId === 'music_skip') return interaction.deferUpdate().catch(() => {});
    // Resto: actualizamos el panel en el sitio.
    return interaction.update(construirPanel(player, cfg)).catch(() => {});
}

// Puerta de entrada para los comandos: está en voz + música activa + rol DJ.
// Devuelve { ok, channel, cfg } o { ok:false, error }.
async function gateMusica(interaction) {
    const voz = ensureVoice(interaction);
    if (!voz.ok) return voz;
    const cfg = await getMusicaConfig(interaction.guildId);
    if (!cfg.activo) return { ok: false, error: '🚫 La música está desactivada en este servidor.' };
    if (!puedeControlar(interaction.member, cfg)) {
        return { ok: false, error: '🎧 Necesitas el rol **DJ** para controlar la música.' };
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
        .on('connect', (node) => console.log(`🎵 Lavalink conectado (nodo: ${node.id})`))
        .on('disconnect', (node) => console.warn(`🎵 Lavalink desconectado (nodo: ${node.id})`))
        .on('error', (node, error) =>
            console.error(`🎵 Error de Lavalink (nodo: ${node.id}):`, error?.message || error));

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
        const prev = panelMsgs.get(player.guildId);
        if (prev) {
            const c = client.channels.cache.get(prev.channelId);
            c?.messages?.delete(prev.messageId).catch(() => {});
            panelMsgs.delete(player.guildId);
        }
        const cfg = await getMusicaConfig(player.guildId);
        const canal = client.channels.cache.get(cfg.canalMusicaId || player.textChannelId);
        if (canal?.isTextBased()) {
            const seQueda = await es247(player.guildId);
            canal.send(seQueda
                ? '🎵 Se acabó la cola. Sigo en el canal (modo 24/7). Añade más música cuando quieras.'
                : '🎵 Se acabó la cola. Saldré del canal si no añades más música.').catch(() => {});
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

    const enMusic = await buscador.search({ query, source: 'ytmsearch' }, requester);
    if (hayResultados(enMusic)) return enMusic;

    return buscador.search({ query, source: 'ytsearch' }, requester); // respaldo
}

module.exports = {
    initMusica, formatDuration, ensureVoice, gateMusica, COLOR_MUSICA,
    getMusicaConfig, encontrarContextoVoz, puedeControlar, serializarEstado, trackJSON,
    manejarBotonMusica, MUSICA_DEFAULTS, buscarMusica, es247,
};
