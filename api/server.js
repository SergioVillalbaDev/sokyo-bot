const express = require('express');
const cors = require('cors');
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

    app.use(cors());
    app.use(express.json());

    if (!API_KEY) {
        console.warn('⚠️  API_KEY no está definida en el .env: la API queda SIN protección. Define API_KEY para protegerla.');
    }
    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
        console.warn('⚠️  DISCORD_CLIENT_ID/SECRET no definidos: el Portal del Cliente (login con Discord) estará desactivado.');
    }

    // --- AUTENTICACIÓN del panel de staff: exige x-api-key (o "Authorization: Bearer <key>") ---
    app.use('/api', (req, res, next) => {
        if (req.path === '/estado') return next();          // health check público
        if (req.path.startsWith('/auth')) return next();    // flujo OAuth del portal (público)
        if (req.path.startsWith('/portal')) return next();  // portal: protegido por sesión JWT, no por API key
        if (!API_KEY) return next();                        // sin key configurada: no se aplica (ver aviso de arranque)
        const enviada = req.headers['x-api-key'] || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
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
            scope: 'identify'
        });
        res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
    });

    // 2. Callback: intercambia el code, obtiene el usuario y emite la sesión
    app.get('/api/auth/discord/callback', async (req, res) => {
        const { code } = req.query;
        if (!code) return res.redirect(`${FRONTEND_URL}/?portal=1&error=denegado`);
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

            const sesion = firmarToken({ id: user.id, username: user.username, avatar }, JWT_SECRET);
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
    
    app.get('/api/servidores', async (req, res) => res.json(await ServidorConfig.find()));
    
    // Todos los tickets
    app.get('/api/tickets', async (req, res) => {
        res.json(await Ticket.find({ visibleWeb: true }).sort({ fechaCreacion: -1 }));
    });

    // --- NUEVA RUTA: Tickets asignados a un miembro del Staff concreto ---
    app.get('/api/tickets/asignados/:staffId', async (req, res) => {
        try {
            const ticketsStaff = await Ticket.find({ asignadoA: req.params.staffId, visibleWeb: true }).sort({ fechaCreacion: -1 });
            res.json(ticketsStaff);
        } catch (error) {
            console.error('Error al obtener tickets asignados:', error);
            res.status(500).json({ error: 'Fallo interno' });
        }
    });
    
    app.get('/api/mensajes/:ticketId', async (req, res) => {
        res.json(await Mensaje.find({ ticketId: req.params.ticketId }).sort({ fecha: 1 }));
    });


// --- RUTA PARA ESTADÍSTICAS DE USUARIOS ---
app.get('/api/usuarios/stats', async (req, res) => {
    try {
        const stats = await Ticket.aggregate([
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
        ]);
        res.json(stats);
    } catch (error) {
        console.error('Error en stats:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});
// --- RUTA PARA OBTENER LOS LOGS (CON LÍMITES FREE/PREMIUM) ---
app.get('/api/logs', async (req, res) => {
    try {
        // Buscamos la configuración del servidor
        const config = await ServidorConfig.findOne();

        // El campo del modelo es 'esPremium' (ServidorConfig.js)
        const esPremium = config && config.esPremium === true;
        const limiteLogs = esPremium ? 150 : 50;

        // Devuelve los logs respetando el límite
        const logs = await Log.find().sort({ fecha: -1 }).limit(limiteLogs);
        
        // Enviamos los logs y también los datos del límite para pintarlos en la web
        res.json({ logs: logs, limite: limiteLogs, esPremium: esPremium });
    } catch (error) {
        console.error('Error al obtener logs:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

    app.post('/api/mensajes/:ticketId', async (req, res) => {
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
    app.post('/api/tickets/:canalId/notas', async (req, res) => {
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

    app.put('/api/tickets/:canalId/cerrar', async (req, res) => {
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

    app.put('/api/tickets/:canalId/reabrir', async (req, res) => {
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

    app.put('/api/tickets/:canalId/ocultar', async (req, res) => {
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

    // --- NUEVA RUTA: Actualizar textos de Marca Blanca ---
    app.put('/api/config/:guildId/textos', async (req, res) => {
        try {
            const { guildId } = req.params;
            const { titulo, descripcion, footer } = req.body; 

            const configActualizada = await ServidorConfig.findOneAndUpdate(
                { guildId: guildId },
                { 
                    mensajeSoporteTitulo: titulo,
                    mensajeSoporteDescripcion: descripcion,
                    footerPersonalizado: footer
                },
                { returnDocument: 'after' } 
            );

            res.json({ success: true, config: configActualizada });
        } catch (error) {
            console.error('Error al actualizar textos personalizados:', error);
            res.status(500).json({ error: 'Fallo interno al actualizar los textos' });
        }
    });

    app.listen(port, () => console.log(`🌐 API corriendo en puerto ${port}`));
};