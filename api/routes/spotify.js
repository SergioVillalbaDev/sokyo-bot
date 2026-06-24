// ============================================================================
// Spotify OAuth — conectar la cuenta de Spotify de un usuario al bot.
//   • /portal/spotify/*  → protegidas con portalAuth (usuario autenticado).
//   • /spotify/callback  → pública (redirect de Spotify, verificada por state).
//
// El flujo es:
//   1. Frontend llama a GET /portal/spotify/auth-url → recibe la URL de Spotify.
//   2. Frontend abre esa URL en un popup.
//   3. Usuario autoriza. Spotify redirige a /api/spotify/callback.
//   4. El callback intercambia el code, guarda el token, cierra el popup.
//   5. Frontend detecta que el popup cerró y actualiza el estado.
// ============================================================================
const express = require('express');
const crypto = require('crypto');
const SpotifyToken = require('../../models/SpotifyToken.js');
const Playlist = require('../../models/Playlist.js');

module.exports = ({ portalAuth }) => {
    const router = express.Router();

    const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
    const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
    const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3000/api/spotify/callback';
    const SCOPES = 'playlist-read-private playlist-read-collaborative user-library-read';

    // Estado temporal de autorización: state → { userId, expires }
    const pendingStates = new Map();
    setInterval(() => {
        const ahora = Date.now();
        for (const [k, v] of pendingStates) if (v.expires < ahora) pendingStates.delete(k);
    }, 5 * 60 * 1000);

    const activo = () => !!(CLIENT_ID && CLIENT_SECRET);

    // Devuelve el accessToken, refrescándolo si está a punto de caducar.
    async function tokenFresco(st) {
        if (new Date(st.expiresAt) > new Date(Date.now() + 60_000)) return st.accessToken;
        const params = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: st.refreshToken,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
        });
        const r = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });
        if (!r.ok) throw new Error('spotify-refresh-failed');
        const data = await r.json();
        st.accessToken = data.access_token;
        st.expiresAt = new Date(Date.now() + data.expires_in * 1000);
        if (data.refresh_token) st.refreshToken = data.refresh_token;
        await st.save();
        return st.accessToken;
    }

    // Página HTML que cierra el popup y notifica al padre.
    function paginaResultado(ok, msg) {
        const color = ok ? '#1db954' : '#e74c3c';
        const evento = ok ? 'connected' : 'error';
        return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>Spotify</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#111827;color:${color};font-family:-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:1rem;text-align:center;padding:2rem}</style>
</head><body>
<p style="font-size:2rem">${ok ? '✅' : '❌'}</p>
<p style="font-size:1.1rem;font-weight:600">${msg}</p>
<p style="font-size:.85rem;opacity:.6">Esta ventana se cerrará automáticamente…</p>
<script>setTimeout(()=>{try{window.opener?.postMessage({spotify:'${evento}'},'*')}catch(e){}window.close()},1500);</script>
</body></html>`;
    }

    // --- Estado de conexión ---
    router.get('/portal/spotify/status', portalAuth, async (req, res) => {
        if (!activo()) return res.json({ disponible: false });
        try {
            const st = await SpotifyToken.findOne({ userId: req.usuario.id });
            if (!st) return res.json({ disponible: true, conectado: false });
            res.json({
                disponible: true,
                conectado: true,
                spotifyUsername: st.spotifyUsername,
                spotifyAvatar: st.spotifyAvatar,
            });
        } catch (e) {
            console.error('spotify/status:', e.message);
            res.status(500).json({ error: 'No se pudo comprobar el estado.' });
        }
    });

    // --- URL de autorización (devuelve la URL del popup a Spotify) ---
    router.get('/portal/spotify/auth-url', portalAuth, (req, res) => {
        if (!activo()) {
            return res.status(501).json({
                error: 'Spotify no está configurado. Añade SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET al .env del bot.',
            });
        }
        const state = crypto.randomBytes(16).toString('hex');
        pendingStates.set(state, { userId: req.usuario.id, expires: Date.now() + 10 * 60 * 1000 });
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: CLIENT_ID,
            scope: SCOPES,
            redirect_uri: REDIRECT_URI,
            state,
        });
        res.json({ url: `https://accounts.spotify.com/authorize?${params}` });
    });

    // --- Callback de Spotify (redirect desde Spotify, sin auth JWT) ---
    router.get('/spotify/callback', async (req, res) => {
        const { code, state, error } = req.query;

        if (error || !code || !state) {
            return res.send(paginaResultado(false, 'Autorización cancelada.'));
        }

        const pending = pendingStates.get(String(state));
        if (!pending || pending.expires < Date.now()) {
            return res.send(paginaResultado(false, 'Enlace expirado. Inténtalo de nuevo.'));
        }
        pendingStates.delete(String(state));

        try {
            // Intercambiar código por tokens
            const tokenParams = new URLSearchParams({
                grant_type: 'authorization_code',
                code: String(code),
                redirect_uri: REDIRECT_URI,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
            });
            const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: tokenParams.toString(),
            });
            if (!tokenRes.ok) throw new Error(`token-exchange-${tokenRes.status}`);
            const tokens = await tokenRes.json();

            // Info del perfil de Spotify
            const profileRes = await fetch('https://api.spotify.com/v1/me', {
                headers: { Authorization: `Bearer ${tokens.access_token}` },
            });
            const profile = await profileRes.json();

            await SpotifyToken.findOneAndUpdate(
                { userId: pending.userId },
                {
                    accessToken: tokens.access_token,
                    refreshToken: tokens.refresh_token,
                    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
                    spotifyUserId: profile.id,
                    spotifyUsername: profile.display_name || profile.id,
                    spotifyAvatar: profile.images?.[0]?.url || null,
                },
                { upsert: true, new: true },
            );

            res.send(paginaResultado(true, '¡Spotify conectado correctamente!'));
        } catch (e) {
            console.error('spotify/callback:', e.message);
            res.send(paginaResultado(false, 'Error al conectar con Spotify. Inténtalo de nuevo.'));
        }
    });

    // --- Desconectar Spotify ---
    router.delete('/portal/spotify/disconnect', portalAuth, async (req, res) => {
        try {
            await SpotifyToken.deleteOne({ userId: req.usuario.id });
            res.json({ ok: true });
        } catch (e) {
            res.status(500).json({ error: 'No se pudo desconectar.' });
        }
    });

    // --- Mis playlists de Spotify ---
    router.get('/portal/spotify/playlists', portalAuth, async (req, res) => {
        try {
            const st = await SpotifyToken.findOne({ userId: req.usuario.id });
            if (!st) return res.status(401).json({ error: 'Conecta tu Spotify primero.' });
            const token = await tokenFresco(st);

            const r = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!r.ok) throw new Error(`spotify-playlists-${r.status}`);
            const data = await r.json();

            res.json((data.items || []).filter(Boolean).map((p) => ({
                id: p.id,
                nombre: p.name,
                uri: p.external_urls?.spotify || `https://open.spotify.com/playlist/${p.id}`,
                total: p.tracks.total,
                imagen: p.images?.[0]?.url || null,
                owner: p.owner?.display_name || p.owner?.id || '',
            })));
        } catch (e) {
            console.error('spotify/playlists:', e.message);
            res.status(500).json({ error: 'No se pudieron cargar las playlists de Spotify.' });
        }
    });

    // --- Mis canciones que me gustan (Liked Songs) ---
    router.get('/portal/spotify/liked', portalAuth, async (req, res) => {
        try {
            const st = await SpotifyToken.findOne({ userId: req.usuario.id });
            if (!st) return res.status(401).json({ error: 'Conecta tu Spotify primero.' });
            const token = await tokenFresco(st);

            const r = await fetch('https://api.spotify.com/v1/me/tracks?limit=50', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!r.ok) throw new Error(`spotify-liked-${r.status}`);
            const data = await r.json();

            res.json({
                total: data.total || 0,
                canciones: (data.items || []).filter((it) => it.track).map((it) => ({
                    title: it.track.name,
                    author: (it.track.artists || []).map((a) => a.name).join(', '),
                    uri: it.track.external_urls?.spotify || it.track.uri,
                    artwork: it.track.album?.images?.[0]?.url || null,
                    duration: it.track.duration_ms || 0,
                })),
            });
        } catch (e) {
            console.error('spotify/liked:', e.message);
            res.status(500).json({ error: 'No se pudieron cargar tus canciones que te gustan.' });
        }
    });

    // --- Importar mis canciones que me gustan como playlist del bot ---
    router.post('/portal/spotify/liked/importar', portalAuth, async (req, res) => {
        try {
            const st = await SpotifyToken.findOne({ userId: req.usuario.id });
            if (!st) return res.status(401).json({ error: 'Conecta tu Spotify primero.' });
            const token = await tokenFresco(st);

            // Paginación de tracks (50 por petición, hasta 200)
            const canciones = [];
            let offset = 0;
            while (canciones.length < 200) {
                const r = await fetch(`https://api.spotify.com/v1/me/tracks?limit=50&offset=${offset}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!r.ok) break;
                const data = await r.json();
                if (!data.items?.length) break;
                canciones.push(...data.items.filter((it) => it.track).map((it) => ({
                    title: it.track.name,
                    author: (it.track.artists || []).map((a) => a.name).join(', '),
                    uri: it.track.external_urls?.spotify || it.track.uri,
                    artwork: it.track.album?.images?.[0]?.url || null,
                    duration: it.track.duration_ms || 0,
                    sourceName: 'spotify',
                })));
                offset += 50;
                if (offset >= data.total) break;
            }

            if (!canciones.length) return res.status(400).json({ error: 'No tienes canciones que te gusten en Spotify.' });

            const nombre = String(req.body.nombre || 'Mis me gusta de Spotify').trim().slice(0, 100);
            const p = await Playlist.create({ userId: req.usuario.id, nombre, canciones });
            res.status(201).json({ ok: true, _id: p._id, nombre: p.nombre, total: canciones.length });
        } catch (e) {
            console.error('spotify/liked/importar:', e.message);
            res.status(500).json({ error: 'No se pudieron importar tus canciones.' });
        }
    });

    // --- Importar playlist de Spotify al bot (la guarda en MongoDB) ---
    router.post('/portal/spotify/playlists/:spotifyId/importar', portalAuth, async (req, res) => {
        try {
            const st = await SpotifyToken.findOne({ userId: req.usuario.id });
            if (!st) return res.status(401).json({ error: 'Conecta tu Spotify primero.' });
            const token = await tokenFresco(st);

            // Información básica de la playlist
            const plInfoRes = await fetch(
                `https://api.spotify.com/v1/playlists/${req.params.spotifyId}?fields=name,tracks.total`,
                { headers: { Authorization: `Bearer ${token}` } },
            );
            if (!plInfoRes.ok) throw new Error(`playlist-info-${plInfoRes.status}`);
            const plInfo = await plInfoRes.json();

            // Paginación de tracks (máx. 50 por petición de Spotify, cogemos hasta 200)
            const tracks = [];
            let offset = 0;
            const limite = Math.min(plInfo.tracks.total, 200);
            while (tracks.length < limite) {
                const r = await fetch(
                    `https://api.spotify.com/v1/playlists/${req.params.spotifyId}/tracks?limit=50&offset=${offset}&fields=items(track(name,artists,duration_ms,album.images,external_urls,uri))`,
                    { headers: { Authorization: `Bearer ${token}` } },
                );
                const data = await r.json();
                if (!data.items?.length) break;
                tracks.push(...data.items.filter((it) => it.track).map((it) => it.track));
                offset += 50;
            }

            const nombre = String(req.body.nombre || plInfo.name || 'Playlist de Spotify').trim().slice(0, 100);
            const canciones = tracks.map((t) => ({
                title: t.name,
                author: (t.artists || []).map((a) => a.name).join(', '),
                uri: t.external_urls?.spotify || t.uri,
                artwork: t.album?.images?.[0]?.url || null,
                duration: t.duration_ms || 0,
                sourceName: 'spotify',
            }));

            const p = await Playlist.create({ userId: req.usuario.id, nombre, canciones });
            res.status(201).json({ ok: true, _id: p._id, nombre: p.nombre, total: canciones.length });
        } catch (e) {
            console.error('spotify/importar:', e.message);
            res.status(500).json({ error: 'No se pudo importar la playlist.' });
        }
    });

    return router;
};
