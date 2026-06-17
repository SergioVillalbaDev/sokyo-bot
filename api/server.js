const express = require('express');
const cors = require('cors');
const { ChannelType, PermissionsBitField } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const Ticket = require('../models/Ticket.js');
const Mensaje = require('../models/Mensaje.js');
const Log = require('../models/Log.js');
const { cerrarTicket, reabrirTicket } = require('../utils/ticketManager.js');
const { firmarToken, verificarToken } = require('../utils/auth.js');

module.exports = (client) => {
    const app = express();
    const port = process.env.PORT || 3000;
    const API_KEY = process.env.API_KEY;

    // --- Configuración del Portal del Cliente (login con Discord) ---
    const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
    const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
    const OAUTH_REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || `http://localhost:${port}/api/auth/discord/callback`;
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    const JWT_SECRET = process.env.JWT_SECRET || API_KEY || 'cambia-este-secreto-de-sesion';

    // IDs de Discord del/los PROPIETARIO(s): ven absolutamente TODO (todos los
    // servidores y tickets), sin el filtrado del staff. Separados por comas.
    const OWNER_IDS = new Set((process.env.OWNER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean));

    app.use(cors());
    app.use(express.json());

    if (!API_KEY) {
        console.warn('⚠️  API_KEY no está definida en el .env: la API queda SIN protección. Define API_KEY para protegerla.');
    }
    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
        console.warn('⚠️  DISCORD_CLIENT_ID/SECRET no definidos: el Portal del Cliente (login con Discord) estará desactivado.');
    }

    // Calcula en qué servidores (de los que tiene el bot) el usuario es staff:
    // tiene el rol de soporte configurado, o permiso de gestionar canales / admin.
    async function guildsDelStaff(userId) {
        const out = [];
        for (const [, g] of client.guilds.cache) {
            try {
                const member = await g.members.fetch(userId);
                const cfg = await ServidorConfig.findOne({ guildId: g.id });
                const tieneRol = cfg && cfg.rolStaffId && member.roles.cache.has(cfg.rolStaffId);
                const esAdmin = member.permissions.has(PermissionsBitField.Flags.ManageChannels)
                    || member.permissions.has(PermissionsBitField.Flags.Administrator);
                if (tieneRol || esAdmin) out.push({ id: g.id, nombre: g.name, icono: g.iconURL({ size: 128 }) || null });
            } catch { /* el usuario no es miembro de ese servidor */ }
        }
        return out;
    }

    // --- AUTENTICACIÓN del panel de staff ---
    // Acepta: (1) sesión de staff (JWT con staff:true) acotada a SUS servidores, o
    //         (2) la API key del propietario (acceso total), por retrocompatibilidad.
    app.use('/api', (req, res, next) => {
        if (req.path === '/estado') return next();          // health check público
        if (req.path.startsWith('/auth')) return next();    // flujo OAuth (público)
        if (req.path.startsWith('/portal')) return next();  // portal: su propio middleware

        // (1) ¿Sesión de staff por JWT?
        const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        const sesion = bearer ? verificarToken(bearer, JWT_SECRET) : null;
        if (sesion && sesion.staff) {
            req.staff = sesion;
            if (sesion.owner) return next(); // el PROPIETARIO lo ve todo, sin filtros
            // Acotamos por servidor: si la petición apunta a un guildId, debe ser de los suyos.
            const guildIds = sesion.guilds || [];
            const enQuery = req.query.guildId;
            const enRuta = (req.path.match(/^\/config\/([^/]+)/) || [])[1];
            const objetivo = enQuery || enRuta;
            if (objetivo && !guildIds.includes(objetivo)) {
                return res.status(403).json({ error: 'No tienes acceso a ese servidor' });
            }
            return next();
        }

        // (2) API key del propietario
        if (!API_KEY) return next(); // sin key configurada: API abierta (ver aviso de arranque)
        const enviada = req.headers['x-api-key'] || bearer;
        if (enviada !== API_KEY) return res.status(401).json({ error: 'No autorizado' });
        next();
    });

    // --- Middleware de sesión del Portal: valida el token de Discord del usuario ---
    const portalAuth = (req, res, next) => {
        const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        const usuario = verificarToken(token, JWT_SECRET);
        if (!usuario) return res.status(401).json({ error: 'Sesión no válida o caducada' });
        req.usuario = usuario;
        next();
    };

    // --- Endurecimiento: acota las acciones por ticket (por canalId) ---
    // Si la petición viene de un staff, el ticket debe pertenecer a uno de SUS
    // servidores. Con la API key del propietario no aplica (acceso total).
    const scopeTicket = async (req, res, next) => {
        if (!req.staff || req.staff.owner) return next();
        const canalId = req.params.canalId || req.params.ticketId;
        if (!canalId) return next();
        try {
            const ticket = await Ticket.findOne({ canalId }).select('guildId');
            if (!ticket || !(req.staff.guilds || []).includes(ticket.guildId)) {
                return res.status(403).json({ error: 'No tienes acceso a este ticket' });
            }
            next();
        } catch (e) {
            console.error('Error verificando acceso al ticket:', e);
            res.status(500).json({ error: 'Error de verificación' });
        }
    };

    // ===================== PORTAL DEL CLIENTE (OAuth Discord) =====================

    // 1. Inicio del login: redirige a Discord
    app.get('/api/auth/discord', (req, res) => {
        if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
            return res.status(500).send('El login con Discord no está configurado en el servidor.');
        }
        const params = new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            redirect_uri: OAUTH_REDIRECT_URI,
            response_type: 'code',
            scope: 'identify',
            state: req.query.state === 'staff' ? 'staff' : 'portal', // distingue login de staff vs portal
        });
        res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
    });

    // 2. Callback: intercambia el code, obtiene el usuario y emite la sesión
    app.get('/api/auth/discord/callback', async (req, res) => {
        const { code, state } = req.query;
        const esStaff = state === 'staff';
        const destinoError = esStaff ? `${FRONTEND_URL}/?staff=1&error=denegado` : `${FRONTEND_URL}/?portal=1&error=denegado`;
        if (!code) return res.redirect(destinoError);
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
            if (!tokenData.access_token) throw new Error('No se recibió access_token de Discord');

            const userRes = await fetch('https://discord.com/api/users/@me', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` }
            });
            const user = await userRes.json();
            const avatar = user.avatar
                ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
                : null;

            if (esStaff) {
                // Propietario: ve TODO. Staff normal: solo sus servidores.
                const esOwner = OWNER_IDS.has(user.id);
                const guilds = esOwner
                    ? client.guilds.cache.map((g) => g.id)
                    : (await guildsDelStaff(user.id)).map((g) => g.id);
                if (!esOwner && guilds.length === 0) {
                    return res.redirect(`${FRONTEND_URL}/?staff=1&error=nostaff`);
                }
                const sesion = firmarToken({ id: user.id, username: user.username, avatar, staff: true, owner: esOwner, guilds }, JWT_SECRET);
                return res.redirect(`${FRONTEND_URL}/?staff=1&token=${sesion}`);
            }

            // Login del PORTAL del cliente (comportamiento existente).
            const sesion = firmarToken({ id: user.id, username: user.username, avatar }, JWT_SECRET);
            res.redirect(`${FRONTEND_URL}/?portal=1&token=${sesion}`);
        } catch (error) {
            console.error('Error en el callback de OAuth:', error);
            res.redirect(esStaff ? `${FRONTEND_URL}/?staff=1&error=oauth` : `${FRONTEND_URL}/?portal=1&error=oauth`);
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
                contenido
            });

            const canal = client.channels.cache.get(req.params.canalId);
            if (canal) await canal.send(`**[${req.usuario.username}]** ${contenido}`).catch(() => {});

            res.json({ success: true, mensaje: nuevoMsg });
        } catch (error) {
            console.error('Error al enviar mensaje desde el portal:', error);
            res.status(500).json({ error: 'Fallo interno al enviar' });
        }
    });

    // =============================================================================

    // --- RUTAS API ---
    app.get('/api/estado', (req, res) => res.json({ message: 'Sokyo Bot está operativo' }));

    // Lista de servidores para el selector del panel.
    // Sesión de staff -> solo SUS servidores. API key (propietario) -> todos.
    app.get('/api/guilds', (req, res) => {
        try {
            const todos = client.guilds.cache.map((g) => ({ id: g.id, nombre: g.name, icono: g.iconURL({ size: 128 }) || null }));
            if (req.staff && !req.staff.owner) {
                const ids = new Set(req.staff.guilds || []);
                return res.json(todos.filter((g) => ids.has(g.id)));
            }
            res.json(todos); // propietario o API key: todos
        } catch (error) {
            console.error('Error al listar guilds:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    });

    // Config de servidores. Con ?guildId= devuelve solo ese (creándolo si no existe).
    app.get('/api/servidores', async (req, res) => {
        const { guildId } = req.query;
        if (guildId) {
            let cfg = await ServidorConfig.findOne({ guildId });
            if (!cfg) cfg = await ServidorConfig.create({ guildId });
            return res.json([cfg]);
        }
        res.json(await ServidorConfig.find());
    });

    // Tickets visibles (filtrados por servidor si se indica ?guildId=)
    app.get('/api/tickets', async (req, res) => {
        const { guildId } = req.query;
        const filtro = { visibleWeb: true };
        if (guildId) filtro.guildId = guildId;
        else if (req.staff && !req.staff.owner) filtro.guildId = { $in: req.staff.guilds || [] }; // staff: solo los suyos (el owner ve todo)
        res.json(await Ticket.find(filtro).sort({ fechaCreacion: -1 }));
    });

    // --- NUEVA RUTA: Tickets asignados a un miembro del Staff concreto ---
    app.get('/api/tickets/asignados/:staffId', async (req, res) => {
        try {
            const filtro = { asignadoA: req.params.staffId, visibleWeb: true };
            if (req.staff && !req.staff.owner) filtro.guildId = { $in: req.staff.guilds || [] };
            const ticketsStaff = await Ticket.find(filtro).sort({ fechaCreacion: -1 });
            res.json(ticketsStaff);
        } catch (error) {
            console.error('Error al obtener tickets asignados:', error);
            res.status(500).json({ error: 'Fallo interno' });
        }
    });
    
    app.get('/api/mensajes/:ticketId', scopeTicket, async (req, res) => {
        res.json(await Mensaje.find({ ticketId: req.params.ticketId }).sort({ fecha: 1 }));
    });


// --- RUTA PARA ESTADÍSTICAS DE USUARIOS ---
app.get('/api/usuarios/stats', async (req, res) => {
    try {
        const { guildId } = req.query;
        const pipeline = [];
        if (guildId) pipeline.push({ $match: { guildId } });
        else if (req.staff && !req.staff.owner) pipeline.push({ $match: { guildId: { $in: req.staff.guilds || [] } } });
        pipeline.push(
            // 1. PRIMERO ordenamos los tickets del más nuevo al más viejo
            { $sort: { fechaCreacion: -1 } },
            // 2. LUEGO agrupamos por usuario
            {
                $group: {
                    _id: "$creadorId",
                    nombre: { $first: "$creadorNombre" },
                    // Como está ordenado, $first coge la foto de tu ticket MÁS RECIENTE
                    avatar: { $first: "$creadorAvatar" }, 
                    totalTickets: { $sum: 1 },
                    ticketsAbiertos: {
                        $sum: { $cond: [{ $eq: ["$estado", "Abierto"] }, 1, 0] }
                    },
                    ratingTotal: { $sum: "$valoracionCSAT" },
                    ratingCount: {
                        $sum: { $cond: [{ $gt: ["$valoracionCSAT", 0] }, 1, 0] }
                    },
                    ultimoTicket: { $first: "$fechaCreacion" } 
                }
            },
            {
                $project: {
                    nombre: 1,
                    avatar: 1, 
                    totalTickets: 1,
                    ticketsAbiertos: 1,
                    ratingMedio: {
                        $cond: [{ $eq: ["$ratingCount", 0] }, null, { $divide: ["$ratingTotal", "$ratingCount"] }]
                    },
                    ultimoTicket: 1
                }
            },
            { $sort: { totalTickets: -1 } }
        );
        const stats = await Ticket.aggregate(pipeline);
        res.json(stats);
    } catch (error) {
        console.error('Error en stats:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});
// --- RUTA PARA OBTENER LOS LOGS (CON LÍMITES FREE/PREMIUM) ---
app.get('/api/logs', async (req, res) => {
    try {
        const { guildId } = req.query;
        // Servidor de referencia para el plan: el indicado, o el primero del staff (no owner).
        const staffScoped = req.staff && !req.staff.owner;
        const gidRef = guildId || (staffScoped && (req.staff.guilds || [])[0]) || null;
        const config = gidRef ? await ServidorConfig.findOne({ guildId: gidRef }) : await ServidorConfig.findOne();

        const esPremium = config && config.esPremium === true;
        const limiteLogs = esPremium ? 150 : 50;

        const filtroLogs = guildId ? { guildId } : (staffScoped ? { guildId: { $in: req.staff.guilds || [] } } : {});
        const logs = await Log.find(filtroLogs).sort({ fecha: -1 }).limit(limiteLogs);

        res.json({ logs: logs, limite: limiteLogs, esPremium: esPremium });
    } catch (error) {
        console.error('Error al obtener logs:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// --- RUTA: USO DE MEMORIA DEL PLAN + DATOS DEL SERVIDOR (para el dashboard) ---
app.get('/api/stats/uso', async (req, res) => {
    try {
        const { guildId } = req.query;
        let gid = guildId || (req.staff && (req.staff.guilds || [])[0]) || null;
        const config = gid ? await ServidorConfig.findOne({ guildId: gid }) : await ServidorConfig.findOne();
        if (!gid && config && config.guildId) gid = config.guildId; // retrocompat (un solo servidor)
        const esPremium = !!(config && config.esPremium === true);

        // Conteos (por servidor si se indica; si no, globales).
        let tickets, mensajes, logs;
        if (gid) {
            const ticketIds = await Ticket.find({ guildId: gid }).distinct('canalId');
            [tickets, mensajes, logs] = await Promise.all([
                Ticket.countDocuments({ guildId: gid }),
                ticketIds.length ? Mensaje.countDocuments({ ticketId: { $in: ticketIds } }) : 0,
                Log.countDocuments({ guildId: gid }),
            ]);
        } else {
            [tickets, mensajes, logs] = await Promise.all([
                Ticket.estimatedDocumentCount(),
                Mensaje.estimatedDocumentCount(),
                Log.estimatedDocumentCount(),
            ]);
        }

        // Memoria vs cuota del plan. Con servidor concreto, estimación por documentos
        // (no se puede medir el tamaño exacto por servidor). Sin servidor, tamaño real de la BD.
        const cuotaMB = esPremium ? 5120 : 512; // 5 GB premium · 512 MB free
        let dataSizeMB;
        if (gid) {
            dataSizeMB = ((tickets * 1.5) + (mensajes * 0.8) + (logs * 0.5)) / 1024;
        } else {
            try {
                const dbStats = await require('mongoose').connection.db.stats();
                dataSizeMB = (dbStats.dataSize || 0) / (1024 * 1024);
            } catch (e) {
                dataSizeMB = ((tickets * 1.5) + (mensajes * 0.8) + (logs * 0.5)) / 1024;
            }
        }
        const porcentajeMemoria = Math.min(100, Math.round((dataSizeMB / cuotaMB) * 100));

        // Datos del servidor de Discord (nombre + icono) para el panel.
        let serverName = 'Mi Servidor';
        let serverIcon = null;
        const guild = gid ? client.guilds.cache.get(gid) : null;
        if (guild) {
            serverName = guild.name;
            serverIcon = guild.iconURL({ size: 128 }) || null;
        }

        res.json({
            esPremium,
            plan: esPremium ? 'Premium' : 'Free',
            memoria: {
                usadoMB: Math.round(dataSizeMB * 10) / 10,
                cuotaMB,
                porcentaje: porcentajeMemoria
            },
            conteos: { tickets, mensajes, logs },
            servidor: { nombre: serverName, icono: serverIcon }
        });
    } catch (error) {
        console.error('Error en /api/stats/uso:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

    app.post('/api/mensajes/:ticketId', scopeTicket, async (req, res) => {
        try {
            const { ticketId } = req.params;
            const { usuario, contenido } = req.body; 

            const nuevoMsg = await Mensaje.create({
                ticketId: ticketId,
                usuarioId: 'sokyo-web', 
                usuario: usuario,
                contenido: contenido
            });

            const canal = client.channels.cache.get(ticketId);
            if (canal) {
                await canal.send(`**[${usuario}]** ${contenido}`);
            }

            res.json({ success: true, mensaje: nuevoMsg });
        } catch (error) {
            console.error('Error al enviar mensaje desde la web:', error);
            res.status(500).json({ error: 'Fallo interno al enviar' });
        }
    });

    // --- NUEVA RUTA: Añadir Nota Interna a un Ticket ---
    app.post('/api/tickets/:canalId/notas', scopeTicket, async (req, res) => {
        try {
            const { canalId } = req.params;
            const { contenido, autor } = req.body;

            const ticketActualizado = await Ticket.findOneAndUpdate(
                { canalId: canalId },
                { $push: { notasInternas: { contenido: contenido, autor: autor } } },
                { returnDocument: 'after' }
            );

            res.json({ success: true, ticket: ticketActualizado });
        } catch (error) {
            console.error('Error al añadir nota interna:', error);
            res.status(500).json({ error: 'Fallo interno al guardar la nota' });
        }
    });

    app.put('/api/tickets/:canalId/cerrar', scopeTicket, async (req, res) => {
        try {
            // Mismo comportamiento que el botón de Discord: transcript + CSAT + log + archivado.
            const resultado = await cerrarTicket(client, req.params.canalId, {
                autor: req.body?.autor || 'Panel Web',
                avisarCanal: true
            });
            if (!resultado.ok) return res.status(404).json({ error: resultado.error });
            res.json({ success: true, ticket: resultado.ticket });
        } catch (error) {
            console.error('Error al cerrar ticket desde la API:', error);
            res.status(500).json({ error: 'Fallo interno al cerrar el ticket' });
        }
    });

    app.put('/api/tickets/:canalId/reabrir', scopeTicket, async (req, res) => {
        try {
            const resultado = await reabrirTicket(client, req.params.canalId, {
                autor: req.body?.autor || 'Panel Web'
            });
            if (!resultado.ok) return res.status(404).json({ error: resultado.error });
            res.json({ success: true, ticket: resultado.ticket });
        } catch (error) {
            console.error('Error al reabrir ticket desde la API:', error);
            res.status(500).json({ error: 'Fallo interno al reabrir el ticket' });
        }
    });

    app.put('/api/tickets/:canalId/ocultar', scopeTicket, async (req, res) => {
        try {
            const { canalId } = req.params;
        const ticketOcultado = await Ticket.findOneAndUpdate(
        { canalId: canalId },
        { visibleWeb: false },
        { returnDocument: 'after' }
        );
            res.json({ success: true, ticket: ticketOcultado });
        } catch (error) {
            console.error('Error al ocultar ticket desde la API:', error);
            res.status(500).json({ error: 'Fallo interno al ocultar el ticket' });
        }
    });

    // --- NUEVA RUTA: Etiquetas de un ticket (productividad del staff) ---
    app.put('/api/tickets/:canalId/etiquetas', scopeTicket, async (req, res) => {
        try {
            const { canalId } = req.params;
            const { etiquetas } = req.body;
            // Saneamos: únicas, sin vacíos, máx 30 chars, máx 15 etiquetas.
            const limpias = Array.isArray(etiquetas)
                ? [...new Set(etiquetas.map((e) => String(e).trim().slice(0, 30)).filter(Boolean))].slice(0, 15)
                : [];
            const ticketActualizado = await Ticket.findOneAndUpdate(
                { canalId },
                { $set: { etiquetas: limpias } },
                { returnDocument: 'after' }
            );
            res.json({ success: true, ticket: ticketActualizado });
        } catch (error) {
            console.error('Error al actualizar etiquetas:', error);
            res.status(500).json({ error: 'Fallo interno al actualizar las etiquetas' });
        }
    });

    app.put('/api/config/:guildId/motivos', async (req, res) => {
        try {
            const { guildId } = req.params;
            const { motivos } = req.body; 

            const configActualizada = await ServidorConfig.findOneAndUpdate(
                { guildId: guildId },
                { motivos: motivos },
                { returnDocument: 'after' } 
            );

            res.json({ success: true, config: configActualizada });
        } catch (error) {
            console.error('Error al actualizar los motivos:', error);
            res.status(500).json({ error: 'Fallo interno al actualizar la configuración' });
        }
    });

    app.put('/api/config/:guildId/urgencias', async (req, res) => {
        try {
            const { guildId } = req.params;
            const { urgencias } = req.body; 

            const configActualizada = await ServidorConfig.findOneAndUpdate(
                { guildId: guildId },
                { urgencias: urgencias },
                { new: true } 
            );

            res.json({ success: true, config: configActualizada });
        } catch (error) {
            console.error('Error al actualizar las urgencias:', error);
            res.status(500).json({ error: 'Fallo interno al actualizar' });
        }
    });

    // --- NUEVA RUTA: Actualizar textos de Marca Blanca + personalización (Fase 2) ---
    app.put('/api/config/:guildId/textos', async (req, res) => {
        try {
            const { guildId } = req.params;
            const { titulo, descripcion, footer, colorEmbed, textoBoton, mensajeBienvenida, prefijo, categoriaArchivados } = req.body;

            // Solo escribimos los campos que llegan (evita pisar con undefined).
            const cambios = {};
            if (titulo !== undefined) cambios.mensajeSoporteTitulo = titulo;
            if (descripcion !== undefined) cambios.mensajeSoporteDescripcion = descripcion;
            if (footer !== undefined) cambios.footerPersonalizado = footer;
            if (colorEmbed !== undefined) cambios.colorEmbed = colorEmbed;
            if (textoBoton !== undefined) cambios.textoBoton = textoBoton;
            if (mensajeBienvenida !== undefined) cambios.mensajeBienvenida = mensajeBienvenida;
            if (prefijo !== undefined) cambios.prefijo = (prefijo || '!').trim() || '!';
            if (categoriaArchivados !== undefined) cambios.categoriaArchivados = categoriaArchivados;

            const configActualizada = await ServidorConfig.findOneAndUpdate(
                { guildId: guildId },
                { $set: cambios },
                { returnDocument: 'after', upsert: true }
            );

            res.json({ success: true, config: configActualizada });
        } catch (error) {
            console.error('Error al actualizar textos personalizados:', error);
            res.status(500).json({ error: 'Fallo interno al actualizar los textos' });
        }
    });

    // --- NUEVA RUTA: Ajustes de comportamiento (Fase 1) ---
    app.put('/api/config/:guildId/comportamiento', async (req, res) => {
        try {
            const { guildId } = req.params;
            const { ratingActivo, enviarTranscript, avisoCierreCanal, pingSoporte, rolSoporteId, logsActivos } = req.body;

            // Construimos solo con los campos que llegan (evita pisar con undefined).
            const cambios = {};
            if (ratingActivo !== undefined) cambios.ratingActivo = !!ratingActivo;
            if (enviarTranscript !== undefined) cambios.enviarTranscript = !!enviarTranscript;
            if (avisoCierreCanal !== undefined) cambios.avisoCierreCanal = !!avisoCierreCanal;
            if (pingSoporte !== undefined) cambios.pingSoporte = !!pingSoporte;
            if (rolSoporteId !== undefined) cambios.rolSoporteId = rolSoporteId || null;
            if (logsActivos && typeof logsActivos === 'object') {
                ['entradas', 'salidas', 'mensajesBorrados', 'mensajesEditados', 'tickets'].forEach((k) => {
                    if (logsActivos[k] !== undefined) cambios[`logsActivos.${k}`] = !!logsActivos[k];
                });
            }

            const configActualizada = await ServidorConfig.findOneAndUpdate(
                { guildId },
                { $set: cambios },
                { returnDocument: 'after', upsert: true }
            );

            res.json({ success: true, config: configActualizada });
        } catch (error) {
            console.error('Error al actualizar comportamiento:', error);
            res.status(500).json({ error: 'Fallo interno al actualizar el comportamiento' });
        }
    });

    // --- NUEVA RUTA: Reglas y control (Fase 3) ---
    app.put('/api/config/:guildId/reglas', async (req, res) => {
        try {
            const { guildId } = req.params;
            const { rolStaffId, categoriaTicketsId, maxTicketsAbiertos, autoCierreDias, autoAsignar } = req.body;

            const cambios = {};
            if (rolStaffId !== undefined) cambios.rolStaffId = rolStaffId || null;
            if (categoriaTicketsId !== undefined) cambios.categoriaTicketsId = categoriaTicketsId || null;
            if (maxTicketsAbiertos !== undefined) cambios.maxTicketsAbiertos = Math.max(0, parseInt(maxTicketsAbiertos, 10) || 0);
            if (autoCierreDias !== undefined) cambios.autoCierreDias = Math.max(0, parseInt(autoCierreDias, 10) || 0);
            if (autoAsignar !== undefined) cambios.autoAsignar = !!autoAsignar;

            const configActualizada = await ServidorConfig.findOneAndUpdate(
                { guildId },
                { $set: cambios },
                { returnDocument: 'after', upsert: true }
            );

            res.json({ success: true, config: configActualizada });
        } catch (error) {
            console.error('Error al actualizar reglas:', error);
            res.status(500).json({ error: 'Fallo interno al actualizar las reglas' });
        }
    });

    // --- NUEVA RUTA: Categorías del servidor (para el selector de categoría) ---
    app.get('/api/servidor/categorias', async (req, res) => {
        try {
            const { guildId } = req.query;
            const config = guildId ? null : await ServidorConfig.findOne();
            const gid = guildId || (config && config.guildId);
            const guild = gid ? client.guilds.cache.get(gid) : null;
            if (!guild) return res.json([]);
            const categorias = guild.channels.cache
                .filter((c) => c.type === ChannelType.GuildCategory)
                .sort((a, b) => a.position - b.position)
                .map((c) => ({ id: c.id, nombre: c.name }));
            res.json(categorias);
        } catch (error) {
            console.error('Error al obtener categorías:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    });

    // --- NUEVA RUTA: Respuestas rápidas / macros (productividad del staff) ---
    app.put('/api/config/:guildId/macros', async (req, res) => {
        try {
            const { guildId } = req.params;
            const { respuestasRapidas } = req.body;
            // Saneamos: solo objetos con titulo y contenido como texto.
            const limpias = Array.isArray(respuestasRapidas)
                ? respuestasRapidas
                    .filter((m) => m && (m.titulo || m.contenido))
                    .map((m) => ({ titulo: String(m.titulo || '').slice(0, 100), contenido: String(m.contenido || '').slice(0, 2000) }))
                : [];

            const configActualizada = await ServidorConfig.findOneAndUpdate(
                { guildId },
                { $set: { respuestasRapidas: limpias } },
                { returnDocument: 'after', upsert: true }
            );
            res.json({ success: true, config: configActualizada });
        } catch (error) {
            console.error('Error al actualizar macros:', error);
            res.status(500).json({ error: 'Fallo interno al actualizar las respuestas rápidas' });
        }
    });

    // --- NUEVA RUTA: Roles del servidor (para el selector de rol de soporte) ---
    app.get('/api/servidor/roles', async (req, res) => {
        try {
            const { guildId } = req.query;
            const config = guildId ? null : await ServidorConfig.findOne();
            const gid = guildId || (config && config.guildId);
            const guild = gid ? client.guilds.cache.get(gid) : null;
            if (!guild) return res.json([]);
            const roles = guild.roles.cache
                .filter((r) => r.name !== '@everyone' && !r.managed)
                .sort((a, b) => b.position - a.position)
                .map((r) => ({ id: r.id, nombre: r.name, color: r.hexColor }));
            res.json(roles);
        } catch (error) {
            console.error('Error al obtener roles:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    });

    app.listen(port, () => console.log(`🌐 API corriendo en puerto ${port}`));
};