// Comodidades de la música: sugerencias mientras escribes en /play, votar para
// saltar cuando hay más gente escuchando, la letra de la canción, guardarla en
// tu playlist «Favoritas» y la cola por páginas.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { t } = require('./i18n.js');

// ---------------------------------------------------------------------------
// Sugerencias de /play (autocompletado). Discord da 3 s para responder: se corta
// a los 2,2 s y se guarda lo buscado 10 minutos.
// ---------------------------------------------------------------------------
const cacheBusquedas = new Map(); // texto -> { t, opciones }
const CACHE_MS = 10 * 60 * 1000;

function nodoConectado(client) {
    const nodos = client.lavalink?.nodeManager?.nodes;
    if (!nodos) return null;
    for (const [, n] of nodos) if (n.connected) return n;
    return null;
}

const recortar = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

async function sugerenciasCanciones(client, escrito, idioma) {
    const q = String(escrito || '').trim();
    if (q.length < 2) return [];
    // Un enlace se respeta tal cual: no hay nada que sugerir.
    if (/^https?:\/\//i.test(q) || q.startsWith('spotify:')) return [{ name: recortar(`🔗 ${q}`, 100), value: q.slice(0, 100) }];
    const clave = q.toLowerCase();
    const c = cacheBusquedas.get(clave);
    if (c && Date.now() - c.t < CACHE_MS) return c.opciones;

    const propio = { name: recortar(t(idioma, `🔍 Buscar «${q}»`, `🔍 Search “${q}”`), 100), value: q.slice(0, 100) };
    const nodo = nodoConectado(client);
    if (!nodo) return [propio];
    const { formatDuration } = require('./musica.js');
    let res = null;
    try {
        res = await Promise.race([
            nodo.search({ query: q, source: 'ytmsearch' }, client.user),
            new Promise((resolve) => setTimeout(() => resolve(null), 2200)),
        ]);
    } catch { res = null; }
    const opciones = [propio];
    for (const tr of (res?.tracks || []).slice(0, 8)) {
        const info = tr.info || {};
        if (!info.uri || info.uri.length > 100) continue;
        const nombre = `${info.title || '?'}${info.author ? ` — ${info.author.replace(/ - Topic$/, '')}` : ''}`;
        opciones.push({ name: recortar(`${nombre} (${formatDuration(info.duration, idioma)})`, 100), value: info.uri });
    }
    if (res) {
        if (cacheBusquedas.size > 500) cacheBusquedas.clear();
        cacheBusquedas.set(clave, { t: Date.now(), opciones });
    }
    return opciones;
}

// ---------------------------------------------------------------------------
// Votar para saltar. Salta al momento quien pidió la canción, quien tiene el rol
// DJ o «Gestionar servidor», o si solo hay 1-2 personas escuchando. Si no, hace
// falta la mitad de los que escuchan (sin contar bots).
// ---------------------------------------------------------------------------
const votos = new Map(); // guildId -> { clave, ids: Set }

function votarSaltar(player, member, cfgMusica = {}) {
    const actual = player.queue.current;
    const canal = member.guild.channels.cache.get(player.voiceChannelId);
    const oyentes = canal ? canal.members.filter((m) => !m.user.bot) : null;
    const total = oyentes ? oyentes.size : 1;
    const privilegiado = !!(member.permissions?.has?.('ManageGuild')
        || (cfgMusica.djRolId && member.roles?.cache?.has?.(cfgMusica.djRolId))
        || (actual?.requester?.id && actual.requester.id === member.id));
    if (privilegiado || total <= 2) { votos.delete(player.guildId); return { saltar: true }; }
    const clave = actual?.encoded || actual?.info?.identifier || actual?.info?.title || '';
    let v = votos.get(player.guildId);
    if (!v || v.clave !== clave) { v = { clave, ids: new Set() }; votos.set(player.guildId, v); }
    v.ids.add(member.id);
    const presentes = [...v.ids].filter((id) => oyentes?.has(id)).length;
    const necesarios = Math.ceil(total / 2);
    if (presentes >= necesarios) { votos.delete(player.guildId); return { saltar: true, votos: presentes, necesarios }; }
    return { saltar: false, votos: presentes, necesarios };
}

const textoVoto = (r, idioma) => t(idioma,
    `🗳️ Has votado para saltar: **${r.votos}/${r.necesarios}**. Cuando vote la mitad de los que escuchan, se salta.`,
    `🗳️ You voted to skip: **${r.votos}/${r.necesarios}**. Once half of the listeners vote, it skips.`);

// ---------------------------------------------------------------------------
// Letra (LRCLIB: gratis y sin clave). Se limpia el título de los añadidos de
// YouTube («(Official Video)», «[Lyrics]», «ft. …»).
// ---------------------------------------------------------------------------
const cacheLetras = new Map();

function limpiarTitulo(titulo) {
    return String(titulo || '')
        .replace(/\s*[([][^)\]]*(official|video|audio|lyric|letra|visuali[sz]er|remaster|hd|4k|mv)[^)\]]*[)\]]/gi, '')
        .replace(/\s*\(?\b(ft\.?|feat\.?|featuring)\s[^()\-–]*\)?/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

async function pedirLrclib(ruta) {
    const res = await fetch(`https://lrclib.net/api/${ruta}`, {
        headers: { 'User-Agent': 'Sokyo bot (https://sokyo.studio)' },
        signal: AbortSignal.timeout(7000),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`LRCLIB ${res.status}`);
    return res.json();
}

// Devuelve { titulo, artista, letra } o null si no se encuentra.
async function buscarLetra(titulo, artista = '', duracionMs = 0) {
    const limpio = limpiarTitulo(titulo);
    const autor = String(artista || '').replace(/ - Topic$/, '').replace(/VEVO$/i, '').trim();
    const clave = `${limpio}|${autor}`.toLowerCase();
    if (cacheLetras.has(clave)) return cacheLetras.get(clave);
    let encontrada = null;
    // 1) Exacta (título + artista + duración), 2) búsqueda libre.
    if (autor) {
        const p = new URLSearchParams({ track_name: limpio, artist_name: autor });
        if (duracionMs > 0) p.set('duration', String(Math.round(duracionMs / 1000)));
        const r = await pedirLrclib(`get?${p}`).catch(() => null);
        if (r?.plainLyrics) encontrada = { titulo: r.trackName, artista: r.artistName, letra: r.plainLyrics };
    }
    if (!encontrada) {
        const lista = await pedirLrclib(`search?${new URLSearchParams({ q: `${autor} ${limpio}`.trim() })}`);
        const r = (lista || []).find((x) => x.plainLyrics);
        if (r) encontrada = { titulo: r.trackName, artista: r.artistName, letra: r.plainLyrics };
    }
    if (cacheLetras.size > 300) cacheLetras.clear();
    cacheLetras.set(clave, encontrada);
    return encontrada;
}

function embedLetra(l, idioma) {
    const texto = l.letra.length > 3900 ? `${l.letra.slice(0, 3900)}\n…` : l.letra;
    return new EmbedBuilder()
        .setColor('#1db954')
        .setTitle(`📝 ${recortar(l.titulo || '', 200)}`)
        .setAuthor({ name: recortar(l.artista || '', 200) || '—' })
        .setDescription(texto)
        .setFooter({ text: t(idioma, 'Letra de LRCLIB', 'Lyrics from LRCLIB') });
}

// Respuesta completa para /letra y el botón 📝 (siempre solo para quien la pide).
async function respuestaLetra(titulo, artista, duracion, idioma) {
    try {
        const l = await buscarLetra(titulo, artista, duracion);
        if (!l) return { content: t(idioma, `🔎 No he encontrado la letra de **${titulo}**. Prueba con \`/letra\` escribiendo el nombre de la canción y del artista.`, `🔎 I couldn’t find the lyrics for **${titulo}**. Try \`/lyrics\` typing the song and artist name.`) };
        return { embeds: [embedLetra(l, idioma)] };
    } catch {
        return { content: t(idioma, '⏳ El servicio de letras no responde ahora mismo. Prueba en un rato.', '⏳ The lyrics service isn’t responding right now. Try again later.') };
    }
}

// ---------------------------------------------------------------------------
// ❤️ Guardar la canción en tu playlist «Favoritas» (la de Mi cuenta → Música).
// ---------------------------------------------------------------------------
const NOMBRES_FAVORITAS = ['❤️ Favoritas', '❤️ Favorites'];

async function guardarEnFavoritas(userId, track, idioma) {
    const Playlist = require('../models/Playlist.js');
    const info = track?.info || {};
    if (!info.uri) return { ok: false, texto: t(idioma, '❌ Esta canción no se puede guardar (no tiene enlace).', '❌ This song can’t be saved (it has no link).') };
    let p = await Playlist.findOne({ userId, nombre: { $in: NOMBRES_FAVORITAS } });
    if (!p) {
        if (await Playlist.countDocuments({ userId }) >= 50) return { ok: false, texto: t(idioma, '❌ Ya tienes 50 playlists. Borra alguna en Mi cuenta → Música.', '❌ You already have 50 playlists. Delete one in My account → Music.') };
        p = new Playlist({ userId, nombre: t(idioma, NOMBRES_FAVORITAS[0], NOMBRES_FAVORITAS[1]), canciones: [] });
    }
    if (p.canciones.some((c) => c.uri === info.uri)) return { ok: true, texto: t(idioma, `❤️ Ya la tenías en **${p.nombre}**.`, `❤️ You already had it in **${p.nombre}**.`) };
    if (p.canciones.length >= 500) return { ok: false, texto: t(idioma, `❌ **${p.nombre}** ya tiene 500 canciones.`, `❌ **${p.nombre}** already has 500 songs.`) };
    p.canciones.push({ title: info.title || '?', author: info.author || '', uri: info.uri, artwork: info.artworkUrl || null, duration: info.duration || 0, sourceName: info.sourceName || '' });
    await p.save();
    return { ok: true, texto: t(idioma, `❤️ Guardada en tu playlist **${p.nombre}**. La tienes en Mi cuenta → Música para ponerla cuando quieras.`, `❤️ Saved to your playlist **${p.nombre}**. It’s in My account → Music to play whenever you like.`) };
}

// ---------------------------------------------------------------------------
// Cola por páginas (/queue y sus botones ◀ ▶).
// ---------------------------------------------------------------------------
const POR_PAGINA = 10;

function mensajeCola(player, pagina, idioma) {
    const { formatDuration, COLOR_MUSICA } = require('./musica.js');
    const actual = player.queue.current;
    const pistas = player.queue.tracks;
    const paginas = Math.max(1, Math.ceil(pistas.length / POR_PAGINA));
    const p = Math.min(Math.max(0, Number(pagina) || 0), paginas - 1);
    const trozo = pistas.slice(p * POR_PAGINA, (p + 1) * POR_PAGINA);
    const lista = trozo.length
        ? trozo.map((tr, i) => `**${p * POR_PAGINA + i + 1}.** ${recortar(tr.info.title, 80)} \`${formatDuration(tr.info.duration, idioma)}\`${tr.requester?.username ? ` · ${tr.requester.username}` : ''}`).join('\n')
        : t(idioma, '_No hay más canciones en la cola. Añade más con `/play`._', '_No more songs in the queue. Add more with `/play`._');
    const totalMs = pistas.reduce((s, tr) => s + (tr.info.duration || 0), 0);
    const embed = new EmbedBuilder()
        .setColor(COLOR_MUSICA)
        .setTitle(t(idioma, '🎶 Cola de música', '🎶 Music queue'))
        .addFields(
            { name: t(idioma, '▶️ Sonando ahora', '▶️ Now playing'), value: actual ? `${recortar(actual.info.title, 200)} \`${formatDuration(actual.info.duration, idioma)}\`` : '—' },
            { name: t(idioma, `⏭️ A continuación (${pistas.length})`, `⏭️ Up next (${pistas.length})`), value: lista },
        )
        .setFooter({ text: t(idioma, `Página ${p + 1} de ${paginas}`, `Page ${p + 1} of ${paginas}`) + (totalMs ? t(idioma, ` · ${formatDuration(totalMs, idioma)} en total`, ` · ${formatDuration(totalMs, idioma)} in total`) : '') });
    const components = paginas > 1 ? [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`cola:${p - 1}`).setEmoji('◀️').setLabel(t(idioma, 'Anterior', 'Previous')).setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
        new ButtonBuilder().setCustomId(`cola:${p + 1}`).setEmoji('▶️').setLabel(t(idioma, 'Siguiente', 'Next')).setStyle(ButtonStyle.Secondary).setDisabled(p >= paginas - 1),
    )] : [];
    return { embeds: [embed], components };
}

module.exports = {
    sugerenciasCanciones, votarSaltar, textoVoto, buscarLetra, limpiarTitulo, respuestaLetra,
    guardarEnFavoritas, mensajeCola, nodoConectado, _votos: votos,
};
