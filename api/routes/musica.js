// ============================================================================
// Rutas de la API de MÚSICA.
//   • /portal/musica/*  → las usa el usuario desde su panel (portalAuth).
//   • /config/:id/musica → configuración y control desde el panel de ADMIN
//     (el middleware global de server.js ya acota por servidor).
// Recibe portalAuth y el cliente de Discord desde server.js.
// ============================================================================
const express = require('express');
const ServidorConfig = require('../../models/ServidorConfig.js');
const {
    getMusicaConfig, encontrarContextoVoz, puedeControlar, serializarEstado, trackJSON, buscarMusica,
} = require('../../utils/musica.js');

module.exports = ({ portalAuth, client }) => {
    const router = express.Router();

    // --- Helpers internos ---------------------------------------------------

    // Primer nodo de Lavalink conectado (para buscar sin necesidad de un player).
    function nodoConectado() {
        for (const [, n] of client.lavalink.nodeManager.nodes) if (n.connected) return n;
        return null;
    }

    // Busca pistas priorizando YouTube Music (versión oficial); ver buscarMusica.
    async function buscar(query, requester) {
        const node = nodoConectado();
        if (!node) throw new Error('motor-apagado');
        return buscarMusica(node, query, requester);
    }

    // ¿De qué fuente es esta consulta? (para respetar las fuentes permitidas).
    function fuenteDe(query) {
        const q = String(query).toLowerCase();
        if (q.includes('spotify.com') || q.startsWith('spotify:')) return 'spotify';
        if (q.includes('soundcloud.com')) return 'soundcloud';
        return 'youtube';
    }

    // Canal de texto donde anunciar (la web no tiene canal, elegimos uno válido).
    function canalTextoFallback(guild) {
        const me = guild.members.me;
        const sys = guild.systemChannel;
        if (sys && sys.permissionsFor(me)?.has('SendMessages')) return sys.id;
        const otro = guild.channels.cache.find(
            (c) => c.isTextBased?.() && c.permissionsFor(me)?.has('SendMessages'));
        return otro?.id || null;
    }

    // Contexto del usuario del portal: dónde está en voz + su config + permisos.
    async function contextoUsuario(req) {
        const ctx = encontrarContextoVoz(client, req.usuario.id);
        if (!ctx) return { sinVoz: true };
        const cfg = await getMusicaConfig(ctx.guild.id);
        return { ...ctx, cfg, puede: puedeControlar(ctx.member, cfg) };
    }

    // =========================================================================
    // PORTAL (usuario)
    // =========================================================================

    // Estado actual de la música para el usuario (según dónde esté conectado).
    router.get('/portal/musica/estado', portalAuth, async (req, res) => {
        try {
            const ctx = await contextoUsuario(req);
            if (ctx.sinVoz) return res.json({ sinVoz: true });
            if (!ctx.cfg.activo) return res.json({ desactivado: true });

            const player = client.lavalink.getPlayer(ctx.guild.id);
            res.json({
                ...serializarEstado(player),
                guild: { id: ctx.guild.id, nombre: ctx.guild.name, icono: ctx.guild.iconURL({ size: 64 }) },
                canalVoz: { id: ctx.voiceChannel.id, nombre: ctx.voiceChannel.name },
                puedeControlar: ctx.puede,
                config: { volumenMax: ctx.cfg.volumenMax, permitirPlaylists: ctx.cfg.permitirPlaylists },
            });
        } catch (e) {
            console.error('musica/estado:', e.message);
            res.status(500).json({ error: 'No se pudo leer el estado.' });
        }
    });

    // Buscar canciones (devuelve resultados con carátula para elegir).
    router.get('/portal/musica/buscar', portalAuth, async (req, res) => {
        try {
            const q = String(req.query.q || '').trim();
            if (!q) return res.json({ resultados: [] });
            const r = await buscar(q, { id: req.usuario.id, username: req.usuario.username });
            if (!r || !r.tracks?.length) return res.json({ resultados: [], playlist: r?.playlist?.name || null });
            res.json({
                playlist: r.loadType === 'playlist' ? (r.playlist?.name || 'Playlist') : null,
                resultados: r.tracks.slice(0, 12).map(trackJSON),
            });
        } catch (e) {
            if (e.message === 'motor-apagado') return res.status(503).json({ error: 'El servidor de música está apagado.' });
            console.error('musica/buscar:', e.message);
            res.status(500).json({ error: 'No se pudo buscar.' });
        }
    });

    // Añadir y reproducir.
    router.post('/portal/musica/play', portalAuth, async (req, res) => {
        try {
            const query = String(req.body.query || '').trim();
            if (!query) return res.status(400).json({ error: 'Escribe algo que reproducir.' });

            const ctx = await contextoUsuario(req);
            if (ctx.sinVoz) return res.status(409).json({ error: 'Entra a un canal de voz en Discord primero.' });
            if (!ctx.cfg.activo) return res.status(403).json({ error: 'La música está desactivada en este servidor.' });
            if (!ctx.puede) return res.status(403).json({ error: 'No tienes el rol DJ para controlar la música.' });

            const fuente = fuenteDe(query);
            if (!ctx.cfg.fuentes[fuente]) {
                return res.status(403).json({ error: `La fuente "${fuente}" está desactivada en este servidor.` });
            }

            const existente = client.lavalink.getPlayer(ctx.guild.id);
            if (ctx.cfg.soloMismoCanal && existente?.voiceChannelId && existente.voiceChannelId !== ctx.voiceChannel.id) {
                return res.status(409).json({ error: 'Ya estoy sonando en otro canal de voz.' });
            }

            const player = existente || client.lavalink.createPlayer({
                guildId: ctx.guild.id,
                voiceChannelId: ctx.voiceChannel.id,
                textChannelId: ctx.cfg.canalMusicaId || canalTextoFallback(ctx.guild),
                selfDeaf: true,
                volume: Math.min(ctx.cfg.volumenDefecto, ctx.cfg.volumenMax),
            });
            if (!player.connected) await player.connect();

            const r = await buscar(query, { id: req.usuario.id, username: req.usuario.username });
            if (!r || !r.tracks?.length) return res.status(404).json({ error: 'No encontré nada con eso.' });

            const esPlaylist = r.loadType === 'playlist';
            if (esPlaylist && !ctx.cfg.permitirPlaylists) {
                return res.status(403).json({ error: 'Las playlists están desactivadas. Añade canciones de una en una.' });
            }

            // Respetar el tope de cola.
            const aAnadir = esPlaylist ? r.tracks : [r.tracks[0]];
            if (ctx.cfg.maxCola > 0) {
                const hueco = ctx.cfg.maxCola - player.queue.tracks.length;
                if (hueco <= 0) return res.status(409).json({ error: 'La cola está llena.' });
                if (aAnadir.length > hueco) aAnadir.length = hueco;
            }

            await player.queue.add(aAnadir);
            if (!player.playing && !player.paused) await player.play();

            res.json({
                ok: true,
                anadidas: aAnadir.length,
                playlist: esPlaylist ? (r.playlist?.name || 'Playlist') : null,
                track: trackJSON(aAnadir[0]),
                estado: serializarEstado(player),
            });
        } catch (e) {
            if (e.message === 'motor-apagado') return res.status(503).json({ error: 'El servidor de música está apagado.' });
            console.error('musica/play:', e.message);
            res.status(500).json({ error: 'No se pudo reproducir.' });
        }
    });

    // Control unificado: skip, pause, resume, stop, volume, remove, shuffle, clear.
    router.post('/portal/musica/control', portalAuth, async (req, res) => {
        try {
            const { accion, valor } = req.body;
            const ctx = await contextoUsuario(req);
            if (ctx.sinVoz) return res.status(409).json({ error: 'Entra a un canal de voz primero.' });
            if (!ctx.puede) return res.status(403).json({ error: 'No tienes el rol DJ para controlar la música.' });

            const player = client.lavalink.getPlayer(ctx.guild.id);
            if (!player) return res.status(409).json({ error: 'No hay nada sonando.' });

            const resultado = await aplicarControl(player, accion, valor, ctx.cfg);
            if (resultado.error) return res.status(400).json(resultado);
            res.json({ ok: true, mensaje: resultado.mensaje, estado: serializarEstado(client.lavalink.getPlayer(ctx.guild.id)) });
        } catch (e) {
            console.error('musica/control:', e.message);
            res.status(500).json({ error: 'No se pudo ejecutar la acción.' });
        }
    });

    // =========================================================================
    // ADMIN (panel) — bajo /config/:guildId, ya acotado por el middleware global
    // =========================================================================

    // Leer configuración de música del servidor.
    router.get('/config/:guildId/musica', async (req, res) => {
        try {
            const cfg = await getMusicaConfig(req.params.guildId);
            res.json(cfg);
        } catch (e) {
            console.error('config/musica GET:', e.message);
            res.status(500).json({ error: 'No se pudo leer la configuración.' });
        }
    });

    // Guardar configuración de música. Devuelve el documento de config completo.
    router.put('/config/:guildId/musica', async (req, res) => {
        try {
            const b = req.body || {};
            const clamp = (n, min, max, def) => {
                const v = Number(n);
                return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
            };
            const musica = {
                activo: !!b.activo,
                canalMusicaId: b.canalMusicaId ? String(b.canalMusicaId) : null,
                djRolId: b.djRolId ? String(b.djRolId) : null,
                soloMismoCanal: !!b.soloMismoCanal,
                volumenMax: clamp(b.volumenMax, 0, 300, 150),
                volumenDefecto: clamp(b.volumenDefecto, 0, 300, 60),
                maxCola: clamp(b.maxCola, 0, 1000, 100),
                permitirPlaylists: !!b.permitirPlaylists,
                anunciarAhora: !!b.anunciarAhora,
                autoSalir: !!b.autoSalir,
                fuentes: {
                    youtube: !!b.fuentes?.youtube,
                    spotify: !!b.fuentes?.spotify,
                    soundcloud: !!b.fuentes?.soundcloud,
                },
            };
            // El volumen por defecto no puede superar el máximo.
            musica.volumenDefecto = Math.min(musica.volumenDefecto, musica.volumenMax);

            const config = await ServidorConfig.findOneAndUpdate(
                { guildId: req.params.guildId },
                { $set: { musica } },
                { new: true, upsert: true },
            );
            res.json({ success: true, config });
        } catch (e) {
            console.error('config/musica PUT:', e.message);
            res.status(500).json({ error: 'No se pudo guardar la configuración.' });
        }
    });

    // Estado en vivo del reproductor de ese servidor (vista admin).
    router.get('/config/:guildId/musica/estado', async (req, res) => {
        try {
            const guild = client.guilds.cache.get(req.params.guildId);
            const player = client.lavalink.getPlayer(req.params.guildId);
            const canalVoz = player?.voiceChannelId
                ? guild?.channels.cache.get(player.voiceChannelId)
                : null;
            res.json({
                ...serializarEstado(player),
                canalVoz: canalVoz ? { id: canalVoz.id, nombre: canalVoz.name } : null,
            });
        } catch (e) {
            console.error('config/musica/estado:', e.message);
            res.status(500).json({ error: 'No se pudo leer el estado.' });
        }
    });

    // Control desde el panel admin (sin necesidad de estar en el canal de voz).
    router.post('/config/:guildId/musica/control', async (req, res) => {
        try {
            const player = client.lavalink.getPlayer(req.params.guildId);
            if (!player) return res.status(409).json({ error: 'No hay nada sonando.' });
            const cfg = await getMusicaConfig(req.params.guildId);
            const resultado = await aplicarControl(player, req.body.accion, req.body.valor, cfg);
            if (resultado.error) return res.status(400).json(resultado);
            res.json({ ok: true, mensaje: resultado.mensaje, estado: serializarEstado(client.lavalink.getPlayer(req.params.guildId)) });
        } catch (e) {
            console.error('config/musica/control:', e.message);
            res.status(500).json({ error: 'No se pudo ejecutar la acción.' });
        }
    });

    // --- Lógica de control compartida (usuario y admin) ---------------------
    async function aplicarControl(player, accion, valor, cfg) {
        switch (accion) {
            case 'skip':
                if (!player.queue.tracks.length) { await player.destroy(); return { mensaje: 'Cola terminada, salí del canal.' }; }
                await player.skip();
                return { mensaje: 'Saltada.' };
            case 'pause':
                await player.pause();
                return { mensaje: 'En pausa.' };
            case 'resume':
                await player.resume();
                return { mensaje: 'Reanudada.' };
            case 'stop':
                await player.destroy();
                return { mensaje: 'Música detenida.' };
            case 'volume': {
                const max = cfg?.volumenMax ?? 150;
                const v = Math.min(max, Math.max(0, parseInt(valor, 10) || 0));
                await player.setVolume(v);
                return { mensaje: `Volumen al ${v}%.` };
            }
            case 'remove': {
                const i = parseInt(valor, 10);
                if (!Number.isInteger(i) || i < 0 || i >= player.queue.tracks.length) return { error: 'Posición no válida.' };
                await player.queue.splice(i, 1);
                return { mensaje: 'Quitada de la cola.' };
            }
            case 'shuffle':
                if (typeof player.queue.shuffle === 'function') await player.queue.shuffle();
                return { mensaje: 'Cola mezclada.' };
            case 'clear':
                if (player.queue.tracks.length) await player.queue.splice(0, player.queue.tracks.length);
                return { mensaje: 'Cola vaciada.' };
            default:
                return { error: 'Acción desconocida.' };
        }
    }

    return router;
};
