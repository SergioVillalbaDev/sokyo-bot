const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const ServidorConfig = require('../models/ServidorConfig.js');
const Ticket = require('../models/Ticket.js');
const Mensaje = require('../models/Mensaje.js');
const Log = require('../models/Log.js');
const { cerrarTicket, reabrirTicket } = require('../utils/ticketManager.js');
const { firmarToken, verificarToken } = require('../utils/auth.js');
const { compararSeguro, crearLimitador } = require('../utils/seguridad.js');
const {
    SNOWFLAKE, validarMensaje, validarNombreAutor, validarMotivos, validarUrgencias, validarTextos
} = require('../utils/validacion.js');

// Mensajes que la API envía a Discord: jamás deben poder mencionar a nadie (@everyone, roles, usuarios).
const SIN_MENCIONES = { parse: [] };
const SESION_STAFF_SEG = 60 * 60 * 12; // 12 h

// Crea la app Express sin arrancarla (así se puede probar). `env` permite inyectar configuración en los tests.
function crearApp(client, env = process.env) {
    const app = express();
    const API_KEY = env.API_KEY;
    const JWT_SECRET = env.JWT_SECRET;
    const port = env.PORT || 3000;

    // --- Portal del Cliente (login con Discord) ---
    const DISCORD_CLIENT_ID = env.DISCORD_CLIENT_ID;
    const DISCORD_CLIENT_SECRET = env.DISCORD_CLIENT_SECRET;
    const OAUTH_REDIRECT_URI = env.OAUTH_REDIRECT_URI || `http://localhost:${port}/api/auth/discord/callback`;
    const FRONTEND_URL = (env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
    const cookieSegura = OAUTH_REDIRECT_URI.startsWith('https://');

    // Orígenes que pueden llamar a la API desde un navegador: el panel + los extra de CORS_ORIGINS.
    const origenesPermitidos = [FRONTEND_URL, ...(env.CORS_ORIGINS || '').split(',').map(o => o.trim().replace(/\/+$/, '')).filter(Boolean)];

    if (env.TRUST_PROXY) app.set('trust proxy', /^\d+$/.test(env.TRUST_PROXY) ? Number(env.TRUST_PROXY) : env.TRUST_PROXY);
    app.disable('x-powered-by');
    app.use(cors({ origin: (origen, cb) => cb(null, !origen || origenesPermitidos.includes(origen)) }));
    app.use(express.json({ limit: '100kb' }));
    app.use('/api', crearLimitador({ ventanaMs: 60_000, max: 300 }));

    // ===================== AUTENTICACIÓN DEL PANEL DE STAFF =====================
    // Login: el panel envía la clave UNA vez y recibe un token de sesión de 12 h.
    // La clave ya no viaja ni se guarda en el navegador (antes iba compilada dentro del JavaScript del panel).
    const limiteLogin = crearLimitador({ ventanaMs: 15 * 60_000, max: 10, mensaje: 'Demasiados intentos de acceso. Espera unos minutos.' });
    app.post('/api/staff/login', limiteLogin, (req, res) => {
        const clave = req.body?.clave;
        if (!compararSeguro(clave, API_KEY || '')) return res.status(401).json({ error: 'Clave incorrecta' });
        const token = firmarToken({ tipo: 'staff' }, JWT_SECRET, SESION_STAFF_SEG);
        res.json({ token, expiraEnSeg: SESION_STAFF_SEG });
    });

    // Todo /api exige credenciales de staff salvo: estado, login, flujo OAuth y portal (que usa su propio token).
    app.use('/api', (req, res, next) => {
        if (req.path === '/estado' || req.path === '/staff/login') return next();
        if (req.path.startsWith('/auth') || req.path.startsWith('/portal')) return next();

        const cabeceraClave = req.headers['x-api-key'];
        if (typeof cabeceraClave === 'string' && compararSeguro(cabeceraClave, API_KEY || '')) return next();

        const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        if (bearer && (verificarToken(bearer, JWT_SECRET, 'staff') || compararSeguro(bearer, API_KEY || ''))) return next();

        res.status(401).json({ error: 'No autorizado' });
    });

    // Sesión del Portal del Cliente
    const portalAuth = (req, res, next) => {
        const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        const usuario = verificarToken(token, JWT_SECRET, 'portal');
        if (!usuario) return res.status(401).json({ error: 'Sesión no válida o caducada' });
        req.usuario = usuario;
        next();
    };

    // ===================== UTILIDADES =====================

    // Qué servidor se está consultando: ?guildId=... (o el único donde esté el bot).
    const resolverGuild = (req, res) => {
        const q = req.query.guildId;
        if (q !== undefined) {
            if (typeof q !== 'string' || !client.guilds.cache.has(q)) {
                res.status(404).json({ error: 'Servidor no válido o el bot no está en él' });
                return null;
            }
            return q;
        }
        if (client.guilds.cache.size === 1) return client.guilds.cache.first().id;
        if (client.guilds.cache.size === 0) { res.status(503).json({ error: 'El bot aún no está listo' }); return null; }
        res.status(400).json({ error: 'Indica el servidor con ?guildId=' });
        return null;
    };

    // Valida el :guildId de la URL (debe ser un servidor donde está el bot)
    const guildDeRuta = (req, res) => {
        const { guildId } = req.params;
        if (!SNOWFLAKE.test(guildId) || !client.guilds.cache.has(guildId)) {
            res.status(404).json({ error: 'Servidor no válido o el bot no está en él' });
            return null;
        }
        return guildId;
    };

    const buscarTicket = async (canalId, guildId) => {
        if (typeof canalId !== 'string' || !SNOWFLAKE.test(canalId)) return null;
        return Ticket.findOne({ canalId, guildId });
    };

    // Envía a Discord un mensaje sin menciones. Devuelve true/false.
    const enviarACanal = async (canalId, texto) => {
        const canal = client.channels.cache.get(canalId);
        if (!canal || typeof canal.send !== 'function') return false;
        try { await canal.send({ content: texto, allowedMentions: SIN_MENCIONES }); return true; } catch { return false; }
    };

    // ===================== PORTAL DEL CLIENTE (OAuth Discord) =====================

    const leerCookie = (req, nombre) => {
        const m = (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith(`${nombre}=`));
        return m ? decodeURIComponent(m.slice(nombre.length + 1)) : '';
    };
    const cookieEstado = (valor, maxAge) =>
        `oauth_state=${valor}; HttpOnly; SameSite=Lax; Path=/api/auth; Max-Age=${maxAge}${cookieSegura ? '; Secure' : ''}`;

    // 1. Inicio del login: redirige a Discord con un `state` anti-CSRF ligado a este navegador
    app.get('/api/auth/discord', (req, res) => {
        if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
            return res.status(500).send('El login con Discord no está configurado en el servidor.');
        }
        const state = crypto.randomBytes(24).toString('hex');
        res.setHeader('Set-Cookie', cookieEstado(state, 600));
        const params = new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            redirect_uri: OAUTH_REDIRECT_URI,
            response_type: 'code',
            scope: 'identify',
            state
        });
        res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
    });

    // 2. Callback: valida el state, intercambia el code y emite la sesión (en el fragmento #, no en la query)
    app.get('/api/auth/discord/callback', async (req, res) => {
        const { code, state } = req.query;
        const guardado = leerCookie(req, 'oauth_state');
        res.setHeader('Set-Cookie', cookieEstado('', 0)); // el state es de un solo uso

        if (!code || typeof code !== 'string') return res.redirect(`${FRONTEND_URL}/?portal=1&error=denegado`);
        if (!guardado || typeof state !== 'string' || !compararSeguro(state, guardado)) {
            return res.redirect(`${FRONTEND_URL}/?portal=1&error=estado`);
        }
        try {
            const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: DISCORD_CLIENT_ID,
                    client_secret: DISCORD_CLIENT_SECRET,
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: OAUTH_REDIRECT_URI
                })
            });
            const tokenData = await tokenRes.json();
            if (!tokenRes.ok || !tokenData.access_token) throw new Error('No se recibió access_token de Discord');

            const userRes = await fetch('https://discord.com/api/users/@me', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` }
            });
            const user = await userRes.json();
            if (!userRes.ok || !user.id) throw new Error('Respuesta de usuario no válida');
            const avatar = user.avatar
                ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
                : null;

            const sesion = firmarToken({ tipo: 'portal', id: user.id, username: user.username, avatar }, JWT_SECRET);
            res.redirect(`${FRONTEND_URL}/?portal=1#token=${sesion}`);
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
        const tickets = await Ticket.find({ creadorId: req.usuario.id }).sort({ fechaCreacion: -1 });
        res.json(tickets);
    });

    // 5. Mensajes de UN ticket mío (verifica propiedad)
    app.get('/api/portal/tickets/:canalId/mensajes', portalAuth, async (req, res) => {
        const ticket = await Ticket.findOne({ canalId: req.params.canalId });
        if (!ticket || ticket.creadorId !== req.usuario.id) return res.status(403).json({ error: 'No autorizado' });
        res.json(await Mensaje.find({ ticketId: req.params.canalId }).sort({ fecha: 1 }));
    });

    // 6. Responder a MI ticket desde el portal (propiedad + abierto + sin menciones)
    app.post('/api/portal/tickets/:canalId/mensajes', portalAuth, async (req, res) => {
        const ticket = await Ticket.findOne({ canalId: req.params.canalId });
        if (!ticket || ticket.creadorId !== req.usuario.id) return res.status(403).json({ error: 'No autorizado' });
        if (ticket.estado === 'Cerrado') return res.status(400).json({ error: 'Este ticket está cerrado' });

        const v = validarMensaje(req.body?.contenido);
        if (!v.ok) return res.status(400).json({ error: v.error });

        const enviado = await enviarACanal(req.params.canalId, `**[${req.usuario.username}]** ${v.valor}`);
        if (!enviado) return res.status(502).json({ error: 'No se pudo enviar el mensaje al canal de Discord' });

        const nuevoMsg = await Mensaje.create({
            ticketId: req.params.canalId,
            usuarioId: req.usuario.id,
            usuario: req.usuario.username,
            contenido: v.valor
        });
        res.json({ success: true, mensaje: nuevoMsg });
    });

    // ===================== API DEL PANEL (staff) =====================
    app.get('/api/estado', (req, res) => res.json({ message: 'Sokyo Bot está operativo' }));

    app.get('/api/servidores', async (req, res) => res.json(await ServidorConfig.find()));

    // Tickets visibles del servidor
    app.get('/api/tickets', async (req, res) => {
        const guildId = resolverGuild(req, res); if (!guildId) return;
        res.json(await Ticket.find({ guildId, visibleWeb: true }).sort({ fechaCreacion: -1 }));
    });

    // Tickets asignados a un miembro del staff
    app.get('/api/tickets/asignados/:staffId', async (req, res) => {
        const guildId = resolverGuild(req, res); if (!guildId) return;
        res.json(await Ticket.find({ guildId, asignadoA: String(req.params.staffId), visibleWeb: true }).sort({ fechaCreacion: -1 }));
    });

    app.get('/api/mensajes/:ticketId', async (req, res) => {
        const guildId = resolverGuild(req, res); if (!guildId) return;
        if (!(await buscarTicket(req.params.ticketId, guildId))) return res.status(404).json({ error: 'Ticket no encontrado' });
        res.json(await Mensaje.find({ ticketId: req.params.ticketId }).sort({ fecha: 1 }));
    });

    // Estadísticas de usuarios (solo del servidor consultado)
    app.get('/api/usuarios/stats', async (req, res) => {
        const guildId = resolverGuild(req, res); if (!guildId) return;
        const stats = await Ticket.aggregate([
            { $match: { guildId } },
            { $sort: { fechaCreacion: -1 } },
            {
                $group: {
                    _id: '$creadorId',
                    nombre: { $first: '$creadorNombre' },
                    avatar: { $first: '$creadorAvatar' },
                    totalTickets: { $sum: 1 },
                    ticketsAbiertos: { $sum: { $cond: [{ $eq: ['$estado', 'Abierto'] }, 1, 0] } },
                    ratingTotal: { $sum: '$valoracionCSAT' },
                    ratingCount: { $sum: { $cond: [{ $gt: ['$valoracionCSAT', 0] }, 1, 0] } },
                    ultimoTicket: { $first: '$fechaCreacion' }
                }
            },
            {
                $project: {
                    nombre: 1, avatar: 1, totalTickets: 1, ticketsAbiertos: 1,
                    ratingMedio: { $cond: [{ $eq: ['$ratingCount', 0] }, null, { $divide: ['$ratingTotal', '$ratingCount'] }] },
                    ultimoTicket: 1
                }
            },
            { $sort: { totalTickets: -1 } }
        ]);
        res.json(stats);
    });

    // Logs del servidor consultado (límite según plan FREE/PREMIUM de ESE servidor)
    app.get('/api/logs', async (req, res) => {
        const guildId = resolverGuild(req, res); if (!guildId) return;
        const config = await ServidorConfig.findOne({ guildId });
        const esPremium = !!(config && config.esPremium === true);
        const limite = esPremium ? 150 : 50;
        const logs = await Log.find({ guildId }).sort({ fecha: -1 }).limit(limite);
        res.json({ logs, limite, esPremium });
    });

    // Responder desde el panel
    app.post('/api/mensajes/:ticketId', async (req, res) => {
        const guildId = resolverGuild(req, res); if (!guildId) return;
        const ticket = await buscarTicket(req.params.ticketId, guildId);
        if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

        const v = validarMensaje(req.body?.contenido);
        if (!v.ok) return res.status(400).json({ error: v.error });
        const usuario = validarNombreAutor(req.body?.usuario);

        const enviado = await enviarACanal(req.params.ticketId, `**[${usuario}]** ${v.valor}`);
        if (!enviado) return res.status(502).json({ error: 'No se pudo enviar el mensaje: el canal de Discord no existe o el bot no puede escribir' });

        const nuevoMsg = await Mensaje.create({ ticketId: req.params.ticketId, usuarioId: 'sokyo-web', usuario, contenido: v.valor });
        res.json({ success: true, mensaje: nuevoMsg });
    });

    // Nota interna
    app.post('/api/tickets/:canalId/notas', async (req, res) => {
        const guildId = resolverGuild(req, res); if (!guildId) return;
        const contenido = typeof req.body?.contenido === 'string' ? req.body.contenido.trim() : '';
        if (!contenido || contenido.length > 2000) return res.status(400).json({ error: 'La nota debe tener entre 1 y 2000 caracteres.' });
        const autor = validarNombreAutor(req.body?.autor, 'Admin');

        const ticket = await Ticket.findOneAndUpdate(
            { canalId: req.params.canalId, guildId },
            { $push: { notasInternas: { contenido, autor } } },
            { returnDocument: 'after' }
        );
        if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
        res.json({ success: true, ticket });
    });

    const errorCicloVida = (res, r) =>
        res.status(r.codigo === 'NO_ENCONTRADO' ? 404 : 409).json({ error: r.error });

    app.put('/api/tickets/:canalId/cerrar', async (req, res) => {
        const guildId = resolverGuild(req, res); if (!guildId) return;
        if (!(await buscarTicket(req.params.canalId, guildId))) return res.status(404).json({ error: 'Ticket no encontrado' });
        const r = await cerrarTicket(client, req.params.canalId, { autor: validarNombreAutor(req.body?.autor, 'Panel Web'), avisarCanal: true });
        if (!r.ok) return errorCicloVida(res, r);
        res.json({ success: true, ticket: r.ticket });
    });

    app.put('/api/tickets/:canalId/reabrir', async (req, res) => {
        const guildId = resolverGuild(req, res); if (!guildId) return;
        if (!(await buscarTicket(req.params.canalId, guildId))) return res.status(404).json({ error: 'Ticket no encontrado' });
        const r = await reabrirTicket(client, req.params.canalId, { autor: validarNombreAutor(req.body?.autor, 'Panel Web') });
        if (!r.ok) return errorCicloVida(res, r);
        res.json({ success: true, ticket: r.ticket });
    });

    app.put('/api/tickets/:canalId/ocultar', async (req, res) => {
        const guildId = resolverGuild(req, res); if (!guildId) return;
        const ticket = await Ticket.findOneAndUpdate({ canalId: req.params.canalId, guildId }, { visibleWeb: false }, { returnDocument: 'after' });
        if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
        res.json({ success: true, ticket });
    });

    // --- Configuración (validada; crea la config si el servidor aún no la tenía) ---
    const guardarConfig = (guildId, cambios) =>
        ServidorConfig.findOneAndUpdate({ guildId }, { $set: cambios }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });

    app.put('/api/config/:guildId/motivos', async (req, res) => {
        const guildId = guildDeRuta(req, res); if (!guildId) return;
        const v = validarMotivos(req.body?.motivos);
        if (!v.ok) return res.status(400).json({ error: v.error });
        res.json({ success: true, config: await guardarConfig(guildId, { motivos: v.valor }) });
    });

    app.put('/api/config/:guildId/urgencias', async (req, res) => {
        const guildId = guildDeRuta(req, res); if (!guildId) return;
        const v = validarUrgencias(req.body?.urgencias);
        if (!v.ok) return res.status(400).json({ error: v.error });
        res.json({ success: true, config: await guardarConfig(guildId, { urgencias: v.valor }) });
    });

    app.put('/api/config/:guildId/textos', async (req, res) => {
        const guildId = guildDeRuta(req, res); if (!guildId) return;
        const v = validarTextos(req.body || {});
        if (!v.ok) return res.status(400).json({ error: v.error });
        const { titulo, descripcion, footer } = v.valor;
        res.json({
            success: true,
            config: await guardarConfig(guildId, { mensajeSoporteTitulo: titulo, mensajeSoporteDescripcion: descripcion, footerPersonalizado: footer || 'Sistema de Gestión Sokyo' })
        });
    });

    // --- Errores: JSON inválido -> 400; cualquier otro -> 500 sin filtrar detalles internos ---
    app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
        if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) return res.status(400).json({ error: 'JSON no válido' });
        if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Petición demasiado grande' });
        console.error(`Error en ${req.method} ${req.path}:`, err);
        res.status(500).json({ error: 'Fallo interno del servidor' });
    });

    return app;
}

module.exports = (client) => {
    const app = crearApp(client);
    const port = process.env.PORT || 3000;
    if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
        console.warn('⚠️  DISCORD_CLIENT_ID/SECRET no definidos: el Portal del Cliente (login con Discord) estará desactivado.');
    }
    const servidor = app.listen(port, () => console.log(`🌐 API corriendo en puerto ${port}`));
    servidor.on('error', (e) => { console.error('🔴 No se pudo iniciar la API:', e.message); process.exit(1); });
    return servidor;
};
module.exports.crearApp = crearApp;
