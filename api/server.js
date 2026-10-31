// API REST del bot: login con Discord (panel de staff y portal de clientes),
// rutas por servidor (/api/g/:guildId/...) y, si existe la build, el panel web.
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ServidorConfig = require('../models/ServidorConfig.js');
const Ticket = require('../models/Ticket.js');
const Mensaje = require('../models/Mensaje.js');
const SesionPanel = require('../models/SesionPanel.js');
const { firmarToken, verificarToken } = require('../utils/auth.js');
const { urlInvitacion } = require('../utils/marca.js');
const { conImagenesVigentes } = require('../utils/adjuntos.js');
const rutasServidor = require('./rutasServidor.js');

const DISCORD_API = 'https://discord.com/api/v10';
const PERMISO_ADMIN = 0x8n;
const PERMISO_GESTIONAR_SERVIDOR = 0x20n;

module.exports = (client) => {
    const app = express();
    const port = process.env.PORT || 3000;

    const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
    const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
    const OAUTH_REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || `http://localhost:${port}/api/auth/discord/callback`;
    const FRONTEND_URL = (process.env.FRONTEND_URL || `http://localhost:${port}`).replace(/\/$/, '');
    let JWT_SECRET = process.env.JWT_SECRET || process.env.API_KEY;
    if (!JWT_SECRET) {
        JWT_SECRET = crypto.randomBytes(32).toString('hex');
        console.warn('⚠️  JWT_SECRET no está definido: las sesiones del panel se cerrarán cada vez que reinicies el bot.');
    }
    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
        console.warn('⚠️  DISCORD_CLIENT_ID/SECRET no definidos: el login con Discord (panel y portal) estará desactivado.');
    }

    app.use(cors());
    app.use(express.json({ limit: '200kb' }));

    // --- Sesión: token firmado que se emite tras el login con Discord ---
    const sesion = (req, res, next) => {
        const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        const usuario = verificarToken(token, JWT_SECRET);
        if (!usuario) return res.status(401).json({ error: 'Sesión no válida o caducada' });
        req.usuario = usuario;
        next();
    };

    // ===================== PÚBLICO =====================

    app.get('/api/estado', (req, res) => res.json({ message: 'Sokyo Bot está operativo' }));

    // Datos para la web pública (landing)
    app.get('/api/publico/info', async (req, res) => {
        const ticketsGestionados = await Ticket.estimatedDocumentCount().catch(() => 0);
        res.json({
            nombre: client.user?.username || 'Sokyo',
            avatar: client.user?.displayAvatarURL({ extension: 'png', size: 256 }) || null,
            invitarUrl: urlInvitacion(client.application?.id || DISCORD_CLIENT_ID),
            servidores: client.guilds.cache.size,
            ticketsGestionados,
            loginDisponible: Boolean(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET)
        });
    });

    // ===================== LOGIN CON DISCORD =====================
    // modo=panel → staff (pide también la lista de servidores) · modo=portal → clientes

    app.get('/api/auth/discord', (req, res) => {
        if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
            return res.status(500).send('El login con Discord no está configurado en el servidor.');
        }
        const modo = req.query.modo === 'portal' ? 'portal' : 'panel';
        const state = firmarToken({ modo, n: crypto.randomBytes(8).toString('hex') }, JWT_SECRET, 600);
        const params = new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            redirect_uri: OAUTH_REDIRECT_URI,
            response_type: 'code',
            scope: modo === 'panel' ? 'identify guilds' : 'identify',
            state
        });
        res.redirect(`https://discord.com/oauth2/authorize?${params.toString().replace(/\+/g, '%20')}`);
    });

    app.get('/api/auth/discord/callback', async (req, res) => {
        const estado = verificarToken(req.query.state, JWT_SECRET);
        const modo = estado?.modo === 'portal' ? 'portal' : 'panel';
        const destino = (extra) => `${FRONTEND_URL}/?${modo === 'portal' ? 'portal=1&' : ''}${extra}`;
        if (!estado) return res.redirect(destino('error=estado'));
        if (!req.query.code) return res.redirect(destino('error=denegado'));

        try {
            const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: DISCORD_CLIENT_ID,
                    client_secret: DISCORD_CLIENT_SECRET,
                    grant_type: 'authorization_code',
                    code: String(req.query.code),
                    redirect_uri: OAUTH_REDIRECT_URI
                })
            });
            const tokenData = await tokenRes.json();
            if (!tokenData.access_token) throw new Error('No se recibió access_token de Discord');

            const auth = { headers: { Authorization: `Bearer ${tokenData.access_token}` } };
            const user = await (await fetch(`${DISCORD_API}/users/@me`, auth)).json();
            if (!user.id) throw new Error('No se pudo leer el usuario de Discord');
            const avatar = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : null;

            if (modo === 'panel') {
                const guilds = await (await fetch(`${DISCORD_API}/users/@me/guilds`, auth)).json();
                await SesionPanel.findOneAndUpdate(
                    { userId: user.id },
                    {
                        accessToken: tokenData.access_token,
                        tokenExpira: new Date(Date.now() + (tokenData.expires_in || 604800) * 1000),
                        guilds: Array.isArray(guilds) ? guilds.map(simplificarGuild) : [],
                        guildsActualizado: new Date()
                    },
                    { upsert: true }
                );
            }

            const token = firmarToken({ id: user.id, username: user.username, avatar }, JWT_SECRET);
            res.redirect(destino(`token=${token}`));
        } catch (error) {
            console.error('Error en el callback de OAuth:', error);
            res.redirect(destino('error=oauth'));
        }
    });

    const simplificarGuild = (g) => ({ id: g.id, name: g.name, icon: g.icon, owner: Boolean(g.owner), permissions: String(g.permissions || '0') });

    // Lista de servidores del usuario (se refresca con Discord cada 5 minutos como mucho).
    async function guildsDeSesion(userId) {
        const s = await SesionPanel.findOne({ userId });
        if (!s) return null;
        const antiguo = !s.guildsActualizado || Date.now() - s.guildsActualizado.getTime() > 5 * 60 * 1000;
        if (antiguo && s.accessToken && (!s.tokenExpira || s.tokenExpira > new Date())) {
            try {
                const r = await fetch(`${DISCORD_API}/users/@me/guilds`, { headers: { Authorization: `Bearer ${s.accessToken}` } });
                if (r.ok) {
                    s.guilds = (await r.json()).map(simplificarGuild);
                    s.guildsActualizado = new Date();
                    await s.save();
                }
            } catch { /* se usa la lista guardada */ }
        }
        return s.guilds;
    }

    // ===================== PANEL: SELECTOR DE SERVIDORES =====================

    app.get('/api/panel/yo', sesion, async (req, res) => {
        const guilds = await guildsDeSesion(req.usuario.id);
        if (!guilds) return res.status(401).json({ error: 'Vuelve a iniciar sesión en el panel', relogin: true });

        const servidores = [];
        for (const g of guilds) {
            const permisos = BigInt(g.permissions || '0');
            const gestiona = g.owner || (permisos & (PERMISO_ADMIN | PERMISO_GESTIONAR_SERVIDOR)) !== 0n;
            const icono = g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=96` : null;
            const guild = client.guilds.cache.get(g.id);

            if (guild) {
                let acceso = gestiona ? 'admin' : null;
                if (!acceso) {
                    const config = await ServidorConfig.findOne({ guildId: g.id }).select('rolesStaff motivos.rolesStaff').lean();
                    const roles = new Set([...(config?.rolesStaff || []), ...(config?.motivos || []).flatMap(m => m.rolesStaff || [])]);
                    if (roles.size > 0) {
                        const member = await guild.members.fetch(req.usuario.id).catch(() => null);
                        if (member && member.roles.cache.some(r => roles.has(r.id))) acceso = 'staff';
                    }
                }
                if (acceso) servidores.push({ id: g.id, nombre: g.name, icono, botPresente: true, acceso, miembros: guild.memberCount });
            } else if (gestiona) {
                servidores.push({ id: g.id, nombre: g.name, icono, botPresente: false, acceso: null, invitarUrl: urlInvitacion(client.application?.id || DISCORD_CLIENT_ID, g.id) });
            }
        }
        servidores.sort((a, b) => (b.botPresente - a.botPresente) || a.nombre.localeCompare(b.nombre));
        res.json({ usuario: { id: req.usuario.id, username: req.usuario.username, avatar: req.usuario.avatar }, servidores });
    });

    // Todo lo de un servidor concreto (tickets, configuración, IA, FAQ, logs...)
    app.use('/api/g/:guildId', sesion, rutasServidor(client));

    // ===================== PORTAL DEL CLIENTE =====================

    app.get('/api/portal/yo', sesion, (req, res) => {
        res.json({ id: req.usuario.id, username: req.usuario.username, avatar: req.usuario.avatar });
    });

    app.get('/api/portal/tickets', sesion, async (req, res) => {
        const tickets = await Ticket.find({ creadorId: req.usuario.id }).sort({ fechaCreacion: -1 }).limit(200)
            .select('-notasInternas -ia').lean();
        res.json(tickets.map(t => ({ ...t, servidorNombre: client.guilds.cache.get(t.guildId)?.name || null })));
    });

    app.get('/api/portal/tickets/:canalId/mensajes', sesion, async (req, res) => {
        const ticket = await Ticket.findOne({ canalId: req.params.canalId });
        if (!ticket || ticket.creadorId !== req.usuario.id) return res.status(403).json({ error: 'No autorizado' });
        const mensajes = await Mensaje.find({ ticketId: req.params.canalId }).sort({ fecha: 1 });
        res.json(await conImagenesVigentes(client, mensajes));
    });

    app.post('/api/portal/tickets/:canalId/mensajes', sesion, async (req, res) => {
        const ticket = await Ticket.findOne({ canalId: req.params.canalId });
        if (!ticket || ticket.creadorId !== req.usuario.id) return res.status(403).json({ error: 'No autorizado' });
        if (ticket.estado === 'Cerrado') return res.status(400).json({ error: 'Este ticket está cerrado' });

        const contenido = String(req.body?.contenido || '').trim().slice(0, 1900);
        if (!contenido) return res.status(400).json({ error: 'Mensaje vacío' });

        const canal = client.channels.cache.get(req.params.canalId);
        if (!canal) return res.status(410).json({ error: 'El canal de este ticket ya no existe' });
        await canal.send({ content: `**[${req.usuario.username} · web]** ${contenido}`, allowedMentions: { parse: [] } });

        const nuevoMsg = await Mensaje.create({
            ticketId: req.params.canalId, usuarioId: req.usuario.id, usuario: req.usuario.username, contenido, desdeWeb: true
        });
        res.json({ success: true, mensaje: nuevoMsg });
    });

    app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

    // ===================== PANEL WEB (build de Vite) =====================
    // Si existe sokyo-panelFRONTEND/dist, la API también sirve la web: un solo proceso y un solo puerto.
    const dist = path.join(__dirname, '..', 'sokyo-panelFRONTEND', 'dist');
    if (fs.existsSync(path.join(dist, 'index.html'))) {
        app.use(express.static(dist));
        app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
        console.log('🖥️  Panel web servido desde sokyo-panelFRONTEND/dist');
    }

    // Errores: validaciones (status propio) o fallo interno
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
        if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
        console.error('Error en la API:', err);
        res.status(500).json({ error: 'Fallo interno' });
    });

    app.listen(port, () => console.log(`🌐 API corriendo en puerto ${port}`));
    return app;
};
