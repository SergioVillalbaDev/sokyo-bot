const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Ticket = require('../models/Ticket.js');
const Mensaje = require('../models/Mensaje.js');
const { registrarActividad } = require('../utils/ticketManager.js');
const { firmarToken, verificarToken } = require('../utils/auth.js');
const montarRutasStaff = require('./staff.js');

module.exports = (client) => {
    const app = express();
    const port = process.env.PORT || 3000;

    // --- Configuración del login con Discord (portal de clientes y panel de staff) ---
    const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
    const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
    const OAUTH_REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || `http://localhost:${port}/api/auth/discord/callback`;
    const OAUTH_STAFF_REDIRECT_URI = process.env.OAUTH_STAFF_REDIRECT_URI || `http://localhost:${port}/api/auth/staff/callback`;
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

    // El secreto de sesión es obligatorio de verdad: sin él cualquiera podría falsificar sesiones.
    // Si no se define, se genera uno aleatorio (las sesiones se pierden al reiniciar el bot).
    let JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET || JWT_SECRET === 'cambia-este-secreto-de-sesion') {
        JWT_SECRET = crypto.randomBytes(32).toString('hex');
        console.warn('⚠️  JWT_SECRET no está definido (o es el de ejemplo): se usa uno aleatorio. Las sesiones se cerrarán al reiniciar. Defínelo en el .env.');
    }

    app.use(cors());
    app.use(express.json({ limit: '200kb' }));

    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
        console.warn('⚠️  DISCORD_CLIENT_ID/SECRET no definidos: el login con Discord (portal y panel de staff) estará desactivado.');
    }

    // --- Middleware de sesión del Portal: valida el token de Discord del usuario ---
    const portalAuth = (req, res, next) => {
        const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        const usuario = verificarToken(token, JWT_SECRET);
        if (!usuario || usuario.tipo === 'staff') return res.status(401).json({ error: 'Sesión no válida o caducada' });
        req.usuario = usuario;
        next();
    };

    // Intercambia el "code" de OAuth por los datos del usuario de Discord.
    async function usuarioDesdeCode(code, redirectUri) {
        const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ client_id: DISCORD_CLIENT_ID, client_secret: DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: redirectUri })
        });
        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) throw new Error('No se recibió access_token de Discord');
        const userRes = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
        const user = await userRes.json();
        if (!user.id) throw new Error('Discord no devolvió un usuario');
        const avatar = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : null;
        return { id: user.id, username: user.global_name || user.username, avatar };
    }

    // ===================== LOGIN DEL PANEL DE STAFF (OAuth Discord) =====================
    // El panel ya NO usa una clave compartida: cada persona entra con su cuenta de Discord y sus
    // permisos salen de sus roles reales en el servidor.

    const leerCookie = (req, nombre) => (req.headers.cookie || '').split(';').map(c => c.trim().split('=')).find(([k]) => k === nombre)?.[1];

    app.get('/api/auth/staff', (req, res) => {
        if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) return res.status(500).send('El login con Discord no está configurado en el servidor.');
        const state = crypto.randomBytes(16).toString('hex');
        res.setHeader('Set-Cookie', `sokyo_state=${state}; HttpOnly; SameSite=Lax; Path=/api/auth; Max-Age=600${OAUTH_STAFF_REDIRECT_URI.startsWith('https') ? '; Secure' : ''}`);
        const params = new URLSearchParams({ client_id: DISCORD_CLIENT_ID, redirect_uri: OAUTH_STAFF_REDIRECT_URI, response_type: 'code', scope: 'identify', state });
        res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
    });

    app.get('/api/auth/staff/callback', async (req, res) => {
        const { code, state } = req.query;
        if (!code) return res.redirect(`${FRONTEND_URL}/?error=denegado`);
        // Protección CSRF: el "state" debe coincidir con la cookie puesta al iniciar el login.
        if (!state || state !== leerCookie(req, 'sokyo_state')) return res.redirect(`${FRONTEND_URL}/?error=estado`);
        try {
            const usuario = await usuarioDesdeCode(code, OAUTH_STAFF_REDIRECT_URI);
            const sesion = firmarToken({ ...usuario, tipo: 'staff' }, JWT_SECRET, 60 * 60 * 12);
            res.redirect(`${FRONTEND_URL}/?staffToken=${sesion}`);
        } catch (error) {
            console.error('Error en el callback de OAuth (staff):', error);
            res.redirect(`${FRONTEND_URL}/?error=oauth`);
        }
    });

    // ===================== PORTAL DEL CLIENTE (OAuth Discord) =====================

    // 1. Inicio del login: redirige a Discord
    app.get('/api/auth/discord', (req, res) => {
        if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
            return res.status(500).send('El login con Discord no está configurado en el servidor.');
        }
        const params = new URLSearchParams({ client_id: DISCORD_CLIENT_ID, redirect_uri: OAUTH_REDIRECT_URI, response_type: 'code', scope: 'identify' });
        res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
    });

    // 2. Callback: intercambia el code, obtiene el usuario y emite la sesión
    app.get('/api/auth/discord/callback', async (req, res) => {
        const { code } = req.query;
        if (!code) return res.redirect(`${FRONTEND_URL}/?portal=1&error=denegado`);
        try {
            const usuario = await usuarioDesdeCode(code, OAUTH_REDIRECT_URI);
            const sesion = firmarToken({ ...usuario, tipo: 'portal' }, JWT_SECRET);
            res.redirect(`${FRONTEND_URL}/?portal=1&token=${sesion}`);
        } catch (error) {
            console.error('Error en el callback de OAuth:', error);
            res.redirect(`${FRONTEND_URL}/?portal=1&error=oauth`);
        }
    });

    // 3. Datos de la sesión actual
    app.get('/api/portal/yo', portalAuth, (req, res) => {
        res.json({ id: req.usuario.id, username: req.usuario.username, avatar: req.usuario.avatar });
    });

    // 4. MIS tickets
    app.get('/api/portal/tickets', portalAuth, async (req, res) => {
        try {
            const tickets = await Ticket.find({ creadorId: req.usuario.id }).sort({ fechaCreacion: -1 });
            res.json(tickets);
        } catch (error) {
            console.error('Error al obtener tickets del portal:', error);
            res.status(500).json({ error: 'Fallo interno' });
        }
    });

    // 5. Mensajes de UN ticket mío (verifica propiedad)
    app.get('/api/portal/tickets/:canalId/mensajes', portalAuth, async (req, res) => {
        try {
            const ticket = await Ticket.findOne({ canalId: req.params.canalId });
            if (!ticket || ticket.creadorId !== req.usuario.id) return res.status(403).json({ error: 'No autorizado' });
            const mensajes = await Mensaje.find({ ticketId: req.params.canalId }).sort({ fecha: 1 });
            res.json(mensajes);
        } catch (error) {
            console.error('Error al obtener mensajes del portal:', error);
            res.status(500).json({ error: 'Fallo interno' });
        }
    });

    // 6. Responder a MI ticket desde el portal (verifica propiedad y que esté abierto)
    app.post('/api/portal/tickets/:canalId/mensajes', portalAuth, async (req, res) => {
        try {
            const ticket = await Ticket.findOne({ canalId: req.params.canalId });
            if (!ticket || ticket.creadorId !== req.usuario.id) return res.status(403).json({ error: 'No autorizado' });
            if (ticket.estado === 'Cerrado') return res.status(400).json({ error: 'Este ticket está cerrado' });

            const { contenido } = req.body;
            if (!contenido || !contenido.trim()) return res.status(400).json({ error: 'Mensaje vacío' });

            const nuevoMsg = await Mensaje.create({
                ticketId: req.params.canalId,
                usuarioId: req.usuario.id,
                usuario: req.usuario.username,
                contenido: contenido.slice(0, 2000)
            });

            const canal = client.channels.cache.get(req.params.canalId);
            if (canal) await canal.send({ content: `**[${req.usuario.username}]** ${contenido.slice(0, 1900)}`, allowedMentions: { parse: [] } }).catch(() => {});
            await registrarActividad(req.params.canalId, req.usuario.id);

            res.json({ success: true, mensaje: nuevoMsg });
        } catch (error) {
            console.error('Error al enviar mensaje desde el portal:', error);
            res.status(500).json({ error: 'Fallo interno al enviar' });
        }
    });

    // =============================================================================

    // Rutas del panel de staff (login de Discord + permisos por rol)
    montarRutasStaff(app, client, { JWT_SECRET });

    app.get('/api/estado', (req, res) => res.json({ message: 'Sokyo Bot está operativo' }));

    app.listen(port, () => console.log(`🌐 API corriendo en puerto ${port}`));
};
