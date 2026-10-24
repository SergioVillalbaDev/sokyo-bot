// ============================================================================
// directos — Crecimiento: avisos de directos de Twitch y vídeos de YouTube.
//
// Twitch: con TWITCH_CLIENT_ID y TWITCH_CLIENT_SECRET en el .env se usa la API
// oficial (Helix). Sin ellas, el bot mira la página pública del canal (modo
// básico): funciona igual, pero sin el juego que se está jugando.
// YouTube: el feed RSS público de cada canal (sin clave). Con YOUTUBE_API_KEY,
// además distingue los directos (aviso de "en directo") de los vídeos, y espera a
// que empiece un directo programado en vez de avisar al programarlo.
// Los Shorts se ignoran salvo que el servidor los active.
// ============================================================================
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const FuenteDirecto = require('../models/FuenteDirecto.js');
const { getConfigCached } = require('./config.js');
const { t } = require('./i18n.js');

const NAVEGADOR = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
// Cookie de consentimiento: en la UE YouTube redirige a su aviso de cookies sin ella.
const COOKIE_YT = 'SOCS=CAI; CONSENT=YES+';
const MAX_FUENTES = 10;
const COLOR = { twitch: 0x9146ff, youtube: 0xff0000 };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function pedir(url, opciones = {}) {
    return fetch(url, { ...opciones, signal: AbortSignal.timeout(12000) });
}

// ------------------------------- TWITCH -------------------------------------

const modoTwitch = () => (process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET ? 'api' : 'basico');
const RESERVADOS_TWITCH = new Set(['videos', 'directory', 'downloads', 'jobs', 'p', 'settings', 'subscriptions', 'inventory', 'wallet', 'search']);

// "ibai", "@ibai" o "https://www.twitch.tv/ibai" -> "ibai".
function loginTwitch(entrada) {
    const s = String(entrada || '').trim();
    const m = s.match(/twitch\.tv\/([A-Za-z0-9_]{3,25})(?:[/?#]|$)/i) || s.match(/^@?([A-Za-z0-9_]{3,25})$/);
    const login = m ? m[1].toLowerCase() : null;
    return login && !RESERVADOS_TWITCH.has(login) ? login : null;
}

let tokenTwitch = null;
let caducaTwitch = 0;
async function helix(ruta) {
    if (!tokenTwitch || Date.now() > caducaTwitch - 60000) {
        const params = new URLSearchParams({ client_id: process.env.TWITCH_CLIENT_ID, client_secret: process.env.TWITCH_CLIENT_SECRET, grant_type: 'client_credentials' });
        const r = await pedir(`https://id.twitch.tv/oauth2/token?${params}`, { method: 'POST' });
        const j = await r.json().catch(() => ({}));
        if (!j.access_token) throw new Error('Twitch: TWITCH_CLIENT_ID o TWITCH_CLIENT_SECRET no son válidos');
        tokenTwitch = j.access_token;
        caducaTwitch = Date.now() + (j.expires_in || 3600) * 1000;
    }
    const r = await pedir(`https://api.twitch.tv/helix/${ruta}`, { headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID, Authorization: `Bearer ${tokenTwitch}` } });
    if (r.status === 401) tokenTwitch = null;
    if (!r.ok) throw new Error(`Twitch respondió ${r.status}`);
    return r.json();
}

const conCacheBuster = (url) => (url ? `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}` : null);

// Modo básico: lee el JSON-LD de la página del canal (perfil + directo, si lo hay).
// Devuelve null si el canal no existe.
function analizarPaginaTwitch(html, login) {
    const m = String(html || '').match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (!m) return null;
    let datos;
    try { datos = JSON.parse(m[1]); } catch { return null; }
    const grafo = Array.isArray(datos['@graph']) ? datos['@graph'] : [datos];
    const perfil = grafo.find((n) => n && n['@type'] === 'ProfilePage');
    const persona = perfil && perfil.mainEntity;
    if (!persona) return null;
    const vivo = grafo.find((n) => n && n['@type'] === 'VideoObject' && n.publication && n.publication.isLiveBroadcast === true);
    const miniaturas = vivo ? [].concat(vivo.thumbnailUrl || []) : [];
    return {
        login,
        nombre: persona.name || login,
        avatar: persona.image || null,
        directo: vivo ? {
            id: String(vivo.publication.startDate || vivo.uploadDate || ''),
            titulo: vivo.description || '',
            juego: null,
            miniatura: miniaturas[miniaturas.length - 1] || null,
            inicio: vivo.publication.startDate || null,
        } : null,
    };
}

async function paginaTwitch(login) {
    const r = await pedir(`https://www.twitch.tv/${login}`, { headers: { 'User-Agent': NAVEGADOR, 'Accept-Language': 'en-US,en;q=0.9' } });
    if (!r.ok) throw new Error(`Twitch respondió ${r.status}`);
    return analizarPaginaTwitch(await r.text(), login);
}

// Estado de varios canales a la vez: Map(login -> directo | null). Los que fallan no aparecen.
async function estadoTwitch(logins) {
    const estados = new Map();
    if (!logins.length) return estados;
    if (modoTwitch() === 'api') {
        for (let i = 0; i < logins.length; i += 100) {
            const lote = logins.slice(i, i + 100);
            const j = await helix(`streams?${lote.map((l) => `user_login=${encodeURIComponent(l)}`).join('&')}`);
            for (const l of lote) estados.set(l, null);
            for (const s of j.data || []) {
                estados.set(String(s.user_login).toLowerCase(), {
                    id: s.id, titulo: s.title || '', juego: s.game_name || null, inicio: s.started_at || null,
                    miniatura: s.thumbnail_url ? s.thumbnail_url.replace('{width}', '1280').replace('{height}', '720') : null,
                });
            }
        }
        return estados;
    }
    for (const login of logins.slice(0, 60)) {
        try {
            const p = await paginaTwitch(login);
            if (p) estados.set(login, p.directo);
        } catch (e) { /* se reintenta en la siguiente pasada */ }
        await esperar(800); // sin prisa: es la web pública de Twitch
    }
    return estados;
}

async function resolverTwitch(entrada) {
    const login = loginTwitch(entrada);
    if (!login) throw new Error('Escribe el nombre del canal de Twitch o su enlace (twitch.tv/…)');
    if (modoTwitch() === 'api') {
        const j = await helix(`users?login=${encodeURIComponent(login)}`);
        const u = (j.data || [])[0];
        if (!u) throw new Error('Ese canal de Twitch no existe');
        const estado = await estadoTwitch([login]);
        return { externoId: login, nombre: u.display_name || login, avatar: u.profile_image_url || null, url: `https://www.twitch.tv/${login}`, directo: estado.get(login) || null };
    }
    const p = await paginaTwitch(login);
    if (!p) throw new Error('Ese canal de Twitch no existe');
    return { externoId: login, nombre: p.nombre, avatar: p.avatar, url: `https://www.twitch.tv/${login}`, directo: p.directo };
}

// ------------------------------- YOUTUBE ------------------------------------

const decodificar = (s) => String(s || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// Feed RSS de un canal -> { autor, entradas: [{ id, titulo, url, publicado, miniatura, esShort }] } (más nuevo primero).
function analizarFeedYoutube(xml) {
    const texto = String(xml || '');
    if (!texto.includes('<feed')) return null;
    const autor = decodificar((texto.match(/<author>\s*<name>([\s\S]*?)<\/name>/) || [])[1] || '');
    const entradas = [];
    for (const m of texto.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
        const e = m[1];
        const id = (e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
        if (!id) continue;
        const url = (e.match(/<link rel="alternate" href="([^"]+)"/) || [])[1] || `https://www.youtube.com/watch?v=${id}`;
        entradas.push({
            id,
            titulo: decodificar((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ''),
            url,
            publicado: new Date((e.match(/<published>([^<]+)<\/published>/) || [])[1] || 0),
            miniatura: (e.match(/<media:thumbnail url="([^"]+)"/) || [])[1] || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            esShort: /\/shorts\//.test(url),
        });
    }
    entradas.sort((a, b) => b.publicado - a.publicado);
    return { autor, entradas };
}

async function feedYoutube(canalId) {
    const r = await pedir(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(canalId)}`, { headers: { 'User-Agent': NAVEGADOR } });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`YouTube respondió ${r.status}`);
    return analizarFeedYoutube(await r.text());
}

// Acepta el ID del canal (UC…), su enlace, @usuario o youtube.com/@usuario.
function entradaYoutube(entrada) {
    const s = String(entrada || '').trim();
    const id = (s.match(/(?:^|channel\/)(UC[\w-]{22})(?:[/?#]|$)/) || [])[1];
    if (id) return { id };
    const handle = (s.match(/youtube\.com\/(@[\w.-]{3,100})/i) || s.match(/^(@[\w.-]{3,100})$/) || [])[1];
    if (handle) return { url: `https://www.youtube.com/${handle}` };
    const custom = (s.match(/youtube\.com\/((?:c|user)\/[\w.-]{1,100})/i) || [])[1];
    if (custom) return { url: `https://www.youtube.com/${custom}` };
    return null;
}

// Datos de la página del canal (ID, nombre y avatar).
async function paginaYoutube(url) {
    const r = await pedir(url, { headers: { 'User-Agent': NAVEGADOR, Cookie: COOKIE_YT, 'Accept-Language': 'en-US,en;q=0.9' } });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`YouTube respondió ${r.status}`);
    const html = await r.text();
    const id = (html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/) || html.match(/"externalId":"(UC[\w-]{22})"/) || [])[1];
    if (!id) return null;
    return {
        id,
        nombre: decodificar((html.match(/<meta property="og:title" content="([^"]*)"/) || [])[1] || ''),
        avatar: decodificar((html.match(/<meta property="og:image" content="([^"]*)"/) || [])[1] || '') || null,
    };
}

async function resolverYoutube(entrada) {
    const e = entradaYoutube(entrada);
    if (!e) throw new Error('Escribe el enlace del canal de YouTube, su @usuario o su ID (UC…)');
    let id = e.id;
    let pagina = null;
    if (!id) {
        pagina = await paginaYoutube(e.url);
        if (!pagina) throw new Error('No encuentro ese canal de YouTube');
        id = pagina.id;
    } else {
        pagina = await paginaYoutube(`https://www.youtube.com/channel/${id}`).catch(() => null);
    }
    const feed = await feedYoutube(id);
    if (!feed) throw new Error('No encuentro ese canal de YouTube');
    return {
        externoId: id,
        nombre: feed.autor || (pagina && pagina.nombre) || id,
        avatar: (pagina && pagina.avatar) || null,
        url: `https://www.youtube.com/channel/${id}`,
        ultimo: feed.entradas[0] || null,
    };
}

// Con YOUTUBE_API_KEY: estado de varios vídeos -> Map(id -> 'live' | 'upcoming' | 'none').
async function estadoVideosYoutube(ids) {
    const estados = new Map();
    const clave = process.env.YOUTUBE_API_KEY;
    if (!clave || !ids.length) return estados;
    for (let i = 0; i < ids.length; i += 50) {
        const lote = ids.slice(i, i + 50);
        const r = await pedir(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${lote.join(',')}&key=${encodeURIComponent(clave)}`);
        if (!r.ok) throw new Error(`YouTube API respondió ${r.status}`);
        const j = await r.json();
        for (const v of j.items || []) estados.set(v.id, (v.snippet && v.snippet.liveBroadcastContent) || 'none');
    }
    return estados;
}

// ------------------------------- AVISOS -------------------------------------

function rellenar(texto, datos) {
    return String(texto || '')
        .replace(/{streamer}/g, datos.streamer || '')
        .replace(/{title}/g, datos.title || '')
        .replace(/{url}/g, datos.url || '')
        .replace(/{platform}/g, datos.platform || '');
}

// Publica el aviso. `item` = { tipo: 'directo' | 'video', titulo, url, miniatura, juego, inicio }.
async function anunciar(client, fuente, cfg, item) {
    const conf = cfg.crecimiento.directos;
    const guild = client.guilds.cache.get(fuente.guildId);
    const canal = guild && conf.canalId ? guild.channels.cache.get(conf.canalId) : null;
    if (!canal || !canal.isTextBased()) throw new Error(t(cfg, 'Elige un canal de texto para los avisos', 'Choose a text channel for the alerts'));
    const directo = item.tipo === 'directo';
    const plataforma = fuente.tipo === 'twitch' ? 'Twitch' : 'YouTube';
    const plantilla = directo
        ? (conf.mensaje || t(cfg, '🔴 ¡**{streamer}** está en directo!', '🔴 **{streamer}** is live!'))
        : (conf.mensajeVideo || t(cfg, '📺 ¡**{streamer}** acaba de publicar en YouTube!', '📺 **{streamer}** just posted on YouTube!'));
    const texto = rellenar(plantilla, { streamer: fuente.nombre, title: item.titulo, url: item.url, platform: plataforma });

    const embed = new EmbedBuilder()
        .setColor(COLOR[fuente.tipo])
        .setAuthor({ name: fuente.nombre.slice(0, 256), iconURL: fuente.avatar || undefined, url: fuente.url || undefined })
        .setTitle((item.titulo || (directo ? t(cfg, 'En directo', 'Live now') : t(cfg, 'Vídeo nuevo', 'New video'))).slice(0, 256))
        .setURL(item.url)
        .setFooter({ text: plataforma })
        .setTimestamp(item.inicio ? new Date(item.inicio) : new Date());
    if (item.miniatura) embed.setImage(item.miniatura);
    if (item.juego) embed.addFields({ name: t(cfg, '🎮 Jugando a', '🎮 Playing'), value: item.juego.slice(0, 1024), inline: true });
    const boton = new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setURL(item.url)
        .setLabel(directo ? t(cfg, 'Ver directo', 'Watch stream') : t(cfg, 'Ver vídeo', 'Watch video'));

    const rol = conf.rolId && guild.roles.cache.get(conf.rolId);
    await canal.send({
        content: `${rol ? `<@&${rol.id}> ` : ''}${texto}`.slice(0, 2000),
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(boton)],
        allowedMentions: { roles: rol ? [rol.id] : [] },
    });
    return true;
}

// Fuentes de los servidores con los avisos activos y canal elegido, con su config.
async function fuentesActivas(client, tipo) {
    const fuentes = await FuenteDirecto.find({ tipo });
    const cfgs = new Map();
    const out = [];
    for (const f of fuentes) {
        if (!client.guilds.cache.has(f.guildId)) continue;
        if (!cfgs.has(f.guildId)) cfgs.set(f.guildId, await getConfigCached(f.guildId).catch(() => null));
        const cfg = cfgs.get(f.guildId);
        if (cfg && cfg.crecimiento && cfg.crecimiento.directos && cfg.crecimiento.directos.activo && cfg.crecimiento.directos.canalId) out.push({ fuente: f, cfg });
    }
    return out;
}

// Twitch: avisa cuando un canal pasa de desconectado a en directo.
async function revisarTwitch(client) {
    const lista = await fuentesActivas(client, 'twitch');
    if (!lista.length) return;
    let estados;
    try { estados = await estadoTwitch([...new Set(lista.map((x) => x.fuente.externoId))]); } catch (e) {
        for (const { fuente } of lista) { fuente.ultimoError = e.message.slice(0, 200); await fuente.save().catch(() => {}); }
        return;
    }
    for (const { fuente, cfg } of lista) {
        if (!estados.has(fuente.externoId)) continue; // no se pudo mirar: siguiente pasada
        const d = estados.get(fuente.externoId);
        try {
            // Solo al empezar: si el bot se reinicia a mitad de directo, no se repite.
            if (d && !fuente.enDirecto && d.id !== fuente.ultimoId) {
                await anunciar(client, fuente, cfg, { tipo: 'directo', titulo: d.titulo, url: fuente.url, miniatura: conCacheBuster(d.miniatura), juego: d.juego, inicio: d.inicio });
                fuente.ultimoId = d.id;
                fuente.ultimoAviso = new Date();
            }
            fuente.enDirecto = !!d;
            fuente.ultimoError = '';
        } catch (e) { fuente.ultimoError = e.message.slice(0, 200); }
        await fuente.save().catch(() => {});
    }
}

// YouTube: avisa de los vídeos nuevos del feed (y, con clave de la API, de los directos).
async function revisarYoutube(client) {
    const lista = await fuentesActivas(client, 'youtube');
    if (!lista.length) return;
    const feeds = new Map();
    for (const id of new Set(lista.map((x) => x.fuente.externoId))) {
        try { feeds.set(id, await feedYoutube(id)); } catch (e) { feeds.set(id, e); }
        await esperar(300);
    }
    const conClave = !!process.env.YOUTUBE_API_KEY;

    for (const { fuente, cfg } of lista) {
        const feed = feeds.get(fuente.externoId);
        try {
            if (feed instanceof Error) throw feed;
            if (!feed) throw new Error('El canal de YouTube ya no existe');
            const conf = cfg.crecimiento.directos;
            const corte = fuente.ultimaFecha ? new Date(fuente.ultimaFecha) : null;
            const masNueva = feed.entradas[0];
            if (!corte) {
                // Primera pasada: solo marca por dónde va el canal (sin avisar de lo antiguo).
                fuente.ultimaFecha = masNueva ? masNueva.publicado : new Date();
                fuente.ultimoId = masNueva ? masNueva.id : null;
            } else {
                const nuevas = feed.entradas
                    .filter((e) => e.publicado > corte && e.id !== fuente.ultimoId && (conf.incluirShorts || !e.esShort))
                    .slice(0, 3)
                    .reverse(); // de la más antigua a la más nueva
                const revisar = [...new Set([...nuevas.map((e) => e.id), ...fuente.pendientes])];
                const estados = conClave && revisar.length ? await estadoVideosYoutube(revisar) : new Map();
                const porId = new Map(feed.entradas.map((e) => [e.id, e]));
                const pendientes = [];

                for (const id of revisar) {
                    const e = porId.get(id);
                    // Sin clave de la API todo es "publicación"; con ella, live / upcoming / none.
                    const estado = conClave ? estados.get(id) : 'none';
                    if (estado === 'upcoming') { pendientes.push(id); continue; } // aún no ha empezado
                    if (estado === undefined) continue; // borrado o privado
                    if (!e && estado !== 'live' && !fuente.pendientes.includes(id)) continue;
                    await anunciar(client, fuente, cfg, {
                        tipo: estado === 'live' ? 'directo' : 'video',
                        titulo: e ? e.titulo : '',
                        url: e ? e.url : `https://www.youtube.com/watch?v=${id}`,
                        miniatura: e ? e.miniatura : `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
                    });
                    fuente.ultimoAviso = new Date();
                }
                fuente.pendientes = pendientes.slice(0, 10);
                if (masNueva && masNueva.publicado > corte) {
                    fuente.ultimaFecha = masNueva.publicado;
                    fuente.ultimoId = masNueva.id;
                }
            }
            fuente.ultimoError = '';
        } catch (e) { fuente.ultimoError = e.message.slice(0, 200); }
        await fuente.save().catch(() => {});
    }
}

// Programador: Twitch cada pasada (2 min) y YouTube una de cada dos (4 min).
let pasada = 0;
async function revisarDirectos(client) {
    pasada++;
    try { await revisarTwitch(client); } catch (e) { console.error('Directos (Twitch):', e.message); }
    if (pasada % 2 === 1) {
        try { await revisarYoutube(client); } catch (e) { console.error('Directos (YouTube):', e.message); }
    }
}

// Alta de una fuente desde el panel.
async function anadirFuente(guildId, tipo, entrada, creadoPor = '') {
    if (!['twitch', 'youtube'].includes(tipo)) throw new Error('Elige Twitch o YouTube');
    if (await FuenteDirecto.countDocuments({ guildId }) >= MAX_FUENTES) throw new Error(`Como mucho ${MAX_FUENTES} canales por servidor`);
    const datos = tipo === 'twitch' ? await resolverTwitch(entrada) : await resolverYoutube(entrada);
    if (await FuenteDirecto.exists({ guildId, tipo, externoId: datos.externoId })) throw new Error('Ese canal ya está en la lista');
    return FuenteDirecto.create({
        guildId, tipo, creadoPor,
        externoId: datos.externoId, nombre: datos.nombre, avatar: datos.avatar, url: datos.url,
        // Lo que ya está publicado (o en directo) al añadirlo no se avisa.
        ...(tipo === 'twitch'
            ? { enDirecto: !!datos.directo, ultimoId: datos.directo ? datos.directo.id : null }
            : { ultimaFecha: datos.ultimo ? datos.ultimo.publicado : new Date(), ultimoId: datos.ultimo ? datos.ultimo.id : null }),
    });
}

// Aviso de prueba con los datos reales más recientes del canal.
async function probarFuente(client, fuente) {
    const cfg = await getConfigCached(fuente.guildId);
    if (fuente.tipo === 'twitch') {
        const d = (await estadoTwitch([fuente.externoId])).get(fuente.externoId);
        return anunciar(client, fuente, cfg, {
            tipo: 'directo',
            titulo: d ? d.titulo : t(cfg, 'Aviso de prueba de Sokyo', 'Sokyo test alert'),
            url: fuente.url, miniatura: d ? conCacheBuster(d.miniatura) : null, juego: d ? d.juego : null, inicio: d ? d.inicio : null,
        });
    }
    const feed = await feedYoutube(fuente.externoId);
    const e = feed && feed.entradas[0];
    if (!e) throw new Error(t(cfg, 'Ese canal aún no tiene vídeos', 'That channel has no videos yet'));
    return anunciar(client, fuente, cfg, { tipo: 'video', titulo: e.titulo, url: e.url, miniatura: e.miniatura });
}

module.exports = {
    MAX_FUENTES, modoTwitch, loginTwitch, analizarPaginaTwitch, analizarFeedYoutube, entradaYoutube,
    resolverTwitch, resolverYoutube, revisarDirectos, revisarTwitch, revisarYoutube, anadirFuente, probarFuente, rellenar,
};
