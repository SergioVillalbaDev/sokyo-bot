// 🎮 Actividad de Discord (1.34.0, preparada). Cuando se pulsa «Actividades» en una llamada o un canal, Discord abre
// dashboard.sokyo.studio/actividad dentro de su ventana (ver ACTIVIDAD.md para activarla en el portal de Discord).
// La página (src/Actividad.jsx) usa el SDK de Discord: pide un `code`, lo cambia aquí por un token de Discord y por
// una sesión nuestra (la misma que «Mi cuenta», así reutiliza portalAuth) y enseña el estado del jugador en ESE
// servidor (lo mismo que /menu: utils/menu.js → estadoJugador) con acciones rápidas que hacen lo mismo que en Discord.
//   GET  /api/auth/actividad/config   → { clientId, lista } (público: la página necesita el id de la aplicación)
//   POST /api/auth/actividad/token    → { access_token, sesion, usuario } (público: lo protege el `code` de Discord)
//   GET  /api/portal/actividad/estado?guildId=  → estado del jugador + funciones encendidas (portalAuth, miembro)
//   POST /api/portal/actividad/diario {guildId} → reclama el diario (como /diario)
//   POST /api/portal/actividad/granja {guildId} → recoge la granja (como /mascotas granja)
const express = require('express');
const C = require('../../utils/catalogo.js');

module.exports = function rutasActividad({ client, portalAuth, firmarToken, JWT_SECRET, DURACION_SESION, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET }) {
    const router = express.Router();
    const { esMiembro } = require('../../utils/servidorPortal.js');
    const idiomaDe = (req) => (String(req.get('x-sokyo-lang') || '').startsWith('en') ? 'en' : 'es');

    router.get('/auth/actividad/config', (req, res) => {
        res.json({ clientId: DISCORD_CLIENT_ID || null, lista: !!(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET) });
    });

    router.post('/auth/actividad/token', async (req, res) => {
        const code = String(req.body?.code || '');
        if (!code || code.length > 200) return res.status(400).json({ error: 'Falta el código de Discord' });
        if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) return res.status(503).json({ error: 'La actividad aún no está configurada' });
        try {
            // En las Actividades el code se cambia sin redirect_uri (lo da el SDK, no una redirección).
            const r = await fetch('https://discord.com/api/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ client_id: DISCORD_CLIENT_ID, client_secret: DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code }),
            });
            const tk = await r.json().catch(() => ({}));
            if (!tk.access_token) return res.status(401).json({ error: 'Discord no ha aceptado el inicio de sesión' });
            const u = await (await fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${tk.access_token}` } })).json();
            if (!u?.id) return res.status(401).json({ error: 'Discord no ha aceptado el inicio de sesión' });
            const avatar = u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128` : null;
            const sesion = firmarToken({ id: u.id, username: u.username, avatar }, JWT_SECRET, DURACION_SESION);
            res.json({ access_token: tk.access_token, sesion, usuario: { id: u.id, nombre: u.global_name || u.username } });
        } catch (e) {
            console.error('Actividad · token:', e.message);
            res.status(502).json({ error: 'No se pudo hablar con Discord' });
        }
    });

    // El servidor de la actividad tiene que tener el bot y la persona ser miembro.
    async function servidor(req, res) {
        const guildId = String(req.query.guildId || req.body?.guildId || '');
        const guild = await esMiembro(client, guildId, req.usuario.id);
        if (!guild) { res.status(404).json({ error: 'Sokyo no está en este servidor', codigo: 'sin-bot' }); return null; }
        return guild;
    }

    router.get('/portal/actividad/estado', portalAuth, async (req, res) => {
        try {
            const guild = await servidor(req, res); if (!guild) return;
            const idioma = idiomaDe(req);
            const cfg = await require('../../models/ServidorConfig.js').findOne({ guildId: guild.id }).lean() || {};
            const estado = await require('../../utils/menu.js').estadoJugador(guild.id, req.usuario.id, cfg);
            const A = require('../../utils/ayuda.js');
            const zonas = ['jugar', 'mascotas', 'comunidad', 'musica'].map((z) => ({
                id: z, emoji: C.ZONAS[z].emoji, nombre: idioma === 'es' ? C.ZONAS[z].es : C.ZONAS[z].en,
                modulos: C.MODULOS.filter((m) => m.zona === z && m.activo(cfg)).map((m) => ({
                    id: m.id, emoji: m.emoji, nombre: idioma === 'es' ? m.es : m.en, frase: idioma === 'es' ? m.frase.es : m.frase.en,
                    comandos: A.comandosDe(m, idioma).map((x) => x.replace(/`/g, '')).slice(0, 4),
                })),
            })).filter((z) => z.modulos.length);
            res.json({ servidor: { id: guild.id, nombre: guild.name }, estado, zonas });
        } catch (e) { console.error('Actividad · estado:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    router.post('/portal/actividad/diario', portalAuth, async (req, res) => {
        try {
            const guild = await servidor(req, res); if (!guild) return;
            const r = await require('../../utils/economia.js').en(guild.id).reclamarDaily(req.usuario.id);
            if (!r.ok) return res.json({ ok: false, esperaHoras: Math.ceil(r.esperaHoras) });
            res.json({ ok: true, total: r.total, racha: r.racha, saldo: r.balance });
        } catch (e) { console.error('Actividad · diario:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    router.post('/portal/actividad/granja', portalAuth, async (req, res) => {
        try {
            const guild = await servidor(req, res); if (!guild) return;
            const cfg = await require('../../models/ServidorConfig.js').findOne({ guildId: guild.id }).lean() || {};
            if (!C.modulo('mascotas').activo(cfg)) return res.status(403).json({ error: 'Esta función está apagada en este servidor' });
            const r = await require('../../utils/granja.js').recoger(guild.id, req.usuario.id, idiomaDe(req));
            res.json({ ok: !r.fallo, fallo: r.fallo || null, oro: r.oro || 0, nueva: !!r.nueva });
        } catch (e) { console.error('Actividad · granja:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    return router;
};
