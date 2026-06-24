// ============================================================================
// Playlists de usuario — guardadas en MongoDB, reproducibles en el bot.
// Todas las rutas van bajo /portal/playlists/* y usan portalAuth.
// ============================================================================
const express = require('express');
const Playlist = require('../../models/Playlist.js');
const {
    getMusicaConfig, encontrarContextoVoz, puedeControlar, buscarMusica,
} = require('../../utils/musica.js');

module.exports = ({ portalAuth, client }) => {
    const router = express.Router();

    function nodoConectado() {
        for (const [, n] of client.lavalink.nodeManager.nodes) if (n.connected) return n;
        return null;
    }

    // Listar playlists del usuario autenticado.
    router.get('/portal/playlists', portalAuth, async (req, res) => {
        try {
            const lista = await Playlist.find({ userId: req.usuario.id })
                .select('nombre canciones createdAt')
                .sort('-createdAt');
            res.json(lista.map((p) => ({
                _id: p._id,
                nombre: p.nombre,
                total: p.canciones.length,
                createdAt: p.createdAt,
            })));
        } catch (e) {
            console.error('playlists GET:', e.message);
            res.status(500).json({ error: 'No se pudieron cargar las playlists.' });
        }
    });

    // Crear playlist.
    router.post('/portal/playlists', portalAuth, async (req, res) => {
        try {
            const nombre = String(req.body.nombre || '').trim().slice(0, 100);
            if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio.' });
            const total = await Playlist.countDocuments({ userId: req.usuario.id });
            if (total >= 50) return res.status(400).json({ error: 'Máximo 50 playlists por usuario.' });
            const p = await Playlist.create({ userId: req.usuario.id, nombre });
            res.status(201).json({ _id: p._id, nombre: p.nombre, total: 0 });
        } catch (e) {
            console.error('playlists POST:', e.message);
            res.status(500).json({ error: 'No se pudo crear la playlist.' });
        }
    });

    // Ver detalles con canciones completas.
    router.get('/portal/playlists/:id', portalAuth, async (req, res) => {
        try {
            const p = await Playlist.findOne({ _id: req.params.id, userId: req.usuario.id });
            if (!p) return res.status(404).json({ error: 'Playlist no encontrada.' });
            res.json(p);
        } catch (e) {
            res.status(500).json({ error: 'No se pudo cargar la playlist.' });
        }
    });

    // Renombrar playlist.
    router.put('/portal/playlists/:id', portalAuth, async (req, res) => {
        try {
            const nombre = String(req.body.nombre || '').trim().slice(0, 100);
            if (!nombre) return res.status(400).json({ error: 'El nombre no puede estar vacío.' });
            const p = await Playlist.findOneAndUpdate(
                { _id: req.params.id, userId: req.usuario.id },
                { nombre },
                { new: true },
            );
            if (!p) return res.status(404).json({ error: 'Playlist no encontrada.' });
            res.json({ ok: true });
        } catch (e) {
            res.status(500).json({ error: 'No se pudo renombrar.' });
        }
    });

    // Borrar playlist.
    router.delete('/portal/playlists/:id', portalAuth, async (req, res) => {
        try {
            const r = await Playlist.deleteOne({ _id: req.params.id, userId: req.usuario.id });
            if (!r.deletedCount) return res.status(404).json({ error: 'Playlist no encontrada.' });
            res.json({ ok: true });
        } catch (e) {
            res.status(500).json({ error: 'No se pudo borrar.' });
        }
    });

    // Añadir canción a la playlist.
    router.post('/portal/playlists/:id/canciones', portalAuth, async (req, res) => {
        try {
            const { title, author, uri, artwork, duration, sourceName } = req.body;
            if (!title || !uri) return res.status(400).json({ error: 'Faltan datos de la canción.' });
            const p = await Playlist.findOne({ _id: req.params.id, userId: req.usuario.id });
            if (!p) return res.status(404).json({ error: 'Playlist no encontrada.' });
            if (p.canciones.length >= 500) return res.status(400).json({ error: 'Máximo 500 canciones por playlist.' });
            p.canciones.push({
                title,
                author: author || '',
                uri,
                artwork: artwork || null,
                duration: duration || 0,
                sourceName: sourceName || null,
            });
            await p.save();
            res.json({ ok: true, total: p.canciones.length });
        } catch (e) {
            res.status(500).json({ error: 'No se pudo añadir la canción.' });
        }
    });

    // Quitar canción por índice.
    router.delete('/portal/playlists/:id/canciones/:idx', portalAuth, async (req, res) => {
        try {
            const idx = parseInt(req.params.idx, 10);
            const p = await Playlist.findOne({ _id: req.params.id, userId: req.usuario.id });
            if (!p) return res.status(404).json({ error: 'Playlist no encontrada.' });
            if (!Number.isInteger(idx) || idx < 0 || idx >= p.canciones.length) {
                return res.status(400).json({ error: 'Índice no válido.' });
            }
            p.canciones.splice(idx, 1);
            await p.save();
            res.json({ ok: true, total: p.canciones.length });
        } catch (e) {
            res.status(500).json({ error: 'No se pudo quitar la canción.' });
        }
    });

    // Reproducir playlist en el bot (requiere que el usuario esté en un canal de voz).
    router.post('/portal/playlists/:id/reproducir', portalAuth, async (req, res) => {
        try {
            const p = await Playlist.findOne({ _id: req.params.id, userId: req.usuario.id });
            if (!p) return res.status(404).json({ error: 'Playlist no encontrada.' });
            if (!p.canciones.length) return res.status(400).json({ error: 'La playlist está vacía.' });

            const ctx = encontrarContextoVoz(client, req.usuario.id);
            if (!ctx) return res.status(409).json({ error: 'Entra a un canal de voz en Discord primero.' });

            const cfg = await getMusicaConfig(ctx.guild.id);
            if (!cfg.activo) return res.status(403).json({ error: 'La música está desactivada en este servidor.' });
            if (!puedeControlar(ctx.member, cfg)) return res.status(403).json({ error: 'No tienes el rol DJ para controlar la música.' });

            const node = nodoConectado();
            if (!node) return res.status(503).json({ error: 'El servidor de música está apagado.' });

            const existente = client.lavalink.getPlayer(ctx.guild.id);
            const player = existente || client.lavalink.createPlayer({
                guildId: ctx.guild.id,
                voiceChannelId: ctx.voiceChannel.id,
                textChannelId: cfg.canalMusicaId || null,
                selfDeaf: true,
                volume: Math.min(cfg.volumenDefecto, cfg.volumenMax),
            });
            if (!player.connected) await player.connect();

            const requester = { id: req.usuario.id, username: req.usuario.username };
            let anadidas = 0;

            for (const cancion of p.canciones) {
                if (cfg.maxCola > 0 && player.queue.tracks.length >= cfg.maxCola) break;
                try {
                    const r = await buscarMusica(node, cancion.uri, requester);
                    if (r?.tracks?.length) {
                        await player.queue.add([r.tracks[0]]);
                        anadidas++;
                    }
                } catch { /* saltar esta canción si no se puede cargar */ }
            }

            if (!player.playing && !player.paused) await player.play();
            res.json({ ok: true, anadidas, total: p.canciones.length, nombre: p.nombre });
        } catch (e) {
            console.error('playlists/reproducir:', e.message);
            res.status(500).json({ error: 'No se pudo reproducir la playlist.' });
        }
    });

    return router;
};
