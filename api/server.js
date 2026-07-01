const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { ChannelType, PermissionsBitField, AttachmentBuilder } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const Ticket = require('../models/Ticket.js');
const Mensaje = require('../models/Mensaje.js');
const Log = require('../models/Log.js');
const RolePanel = require('../models/RolePanel.js');
const TipoSancion = require('../models/TipoSancion.js');
const Sancion = require('../models/Sancion.js');
const ActividadUsuario = require('../models/ActividadUsuario.js');
const RegistroMensaje = require('../models/RegistroMensaje.js');
const TarjetaPersonal = require('../models/TarjetaPersonal.js');
const CatalogoPresets = require('../models/CatalogoPresets.js');
const Reporte = require('../models/Reporte.js');
const AnuncioProgramado = require('../models/AnuncioProgramado.js');
const AnuncioPreset = require('../models/AnuncioPreset.js');
const { publicarPanel: publicarPanelVerificacion } = require('../utils/verificacion.js');
const { publicarPanel: publicarPanelEmbudo } = require('../utils/embudo.js');
const { enviarBienvenida, enviarDespedida } = require('../utils/bienvenida.js');
const { abrirTicketDesdeReporte } = require('../utils/reportes.js');
const { construirMensaje, sanearEmbed, embedTieneContenido } = require('../utils/embeds.js');
const { cerrarTicket, reabrirTicket, construirTranscriptHTML, generarTranscriptPDF } = require('../utils/ticketManager.js');
const ia = require('../utils/ia.js');
const { publicarPanel } = require('../utils/rolePanelManager.js');
const { aplicarSancion, aplicarSancionMasiva, revocarSancion } = require('../utils/moderationManager.js');
const { construirBuffer } = require('../utils/niveles.js');
const { firmarToken, verificarToken } = require('../utils/auth.js');
const billing = require('../utils/billing.js');
const { limite } = require('../utils/limites.js');
const { construirAnalitica } = require('../utils/analitica.js');
const { enviarResumen } = require('../utils/resumenDiario.js');

module.exports = (client) => {
    const app = express();
    const port = process.env.PORT || 3000;
    const API_KEY = process.env.API_KEY;

    // En producción el bot va detrás de un proxy/HTTPS (Nginx, Cloudflare…). Sin esto
    // express-rate-limit vería la IP del proxy y no la real del visitante. Se activa
    // con TRUST_PROXY en el .env (p. ej. 1 = un salto). En local se deja sin tocar.
    if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

    // --- Configuración del Portal del Cliente (login con Discord) ---
    const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
    const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
    const OAUTH_REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || `http://localhost:${port}/api/auth/discord/callback`;
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    const JWT_SECRET = process.env.JWT_SECRET || API_KEY || 'cambia-este-secreto-de-sesion';

    // IDs de Discord del/los PROPIETARIO(s): ven absolutamente TODO (todos los
    // servidores y tickets), sin el filtrado del staff. Separados por comas.
    const OWNER_IDS = new Set((process.env.OWNER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean));

    // IDs con permiso de DIFUSIÓN: pueden mandar mensajes/embeds a un servidor
    // concreto o a TODOS los servidores del bot. Exclusivo de estas IDs.
    const BROADCAST_IDS = new Set((process.env.BROADCAST_IDS || '').split(',').map((s) => s.trim()).filter(Boolean));

    app.use(cors());

    // --- CABECERAS DE SEGURIDAD (helmet) ---
    // Añade cabeceras que protegen frente a ataques comunes (clickjacking, sniffing…).
    // - contentSecurityPolicy: false → el panel es una SPA aparte (otro origen) y
    //   servimos páginas propias (public/tienda.html) con scripts; una CSP estricta
    //   las rompería. Se puede afinar más adelante con una CSP a medida.
    // - crossOriginResourcePolicy cross-origin → el panel (otro origen) debe poder
    //   cargar las imágenes servidas en /uploads.
    app.use(helmet({
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    }));

    // --- WEBHOOK DE STRIPE ---
    // DEBE ir ANTES de express.json: Stripe firma el cuerpo CRUDO y hay que
    // verificarlo sin parsear. Es público (lo llama Stripe, no el panel).
    app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
        if (!billing.getStripe()) return res.status(503).end();
        let event;
        try {
            event = billing.construirEvento(req.body, req.headers['stripe-signature']);
        } catch (e) {
            console.error('🔴 Webhook de Stripe inválido:', e.message);
            return res.status(400).send(`Webhook Error: ${e.message}`);
        }
        try {
            await billing.procesarEvento(event);
        } catch (e) {
            console.error('🔴 Error procesando webhook de Stripe:', e.message);
        }
        res.json({ received: true });
    });

    app.use(express.json({ limit: '12mb' })); // suficiente para imágenes/gifs en base64

    // --- HEALTH-CHECK (público, sin login ni rate-limit) ---
    // Pensado para un monitor externo (UptimeRobot, healthchecks.io…) que lo
    // consulte cada pocos minutos y avise si algo se cae. Devuelve 200 solo si
    // TODO está sano: servidor vivo + base de datos conectada + bot en Discord.
    // Si Mongo o Discord están caídos devuelve 503 → el monitor te alerta.
    app.get('/api/health', (req, res) => {
        const mongoOk = mongoose.connection.readyState === 1; // 1 = conectado
        const discordOk = !!(client && typeof client.isReady === 'function' && client.isReady());
        const ok = mongoOk && discordOk;
        res.status(ok ? 200 : 503).json({
            ok,
            uptime: Math.round(process.uptime()),
            mongo: mongoOk ? 'up' : 'down',
            discord: discordOk ? 'up' : 'down',
            ts: new Date().toISOString(),
        });
    });

    // Carpeta donde se guardan las imágenes subidas para los paneles, servida públicamente.
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    app.use('/uploads', express.static(uploadsDir));

    // Páginas estáticas propias (p. ej. la tienda en public/tienda.html), servidas
    // en el MISMO origen que la API para evitar problemas de CORS con el token.
    app.use(express.static(path.join(__dirname, '..', 'public')));

    if (!API_KEY) {
        console.warn('⚠️  API_KEY no está definida en el .env: la API queda SIN protección. Define API_KEY para protegerla.');
    }
    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
        console.warn('⚠️  DISCORD_CLIENT_ID/SECRET no definidos: el Portal del Cliente (login con Discord) estará desactivado.');
    }

    // --- LÍMITE DE PETICIONES (rate limiting) ---
    // Evita que alguien martillee la API (fuerza bruta del login, abuso de endpoints…).
    // OJO: el webhook de Stripe se registró ANTES, así que NO pasa por estos límites.
    // El panel hace polling, por eso el límite general es holgado.
    const limitadorGeneral = rateLimit({
        windowMs: 60 * 1000,           // ventana de 1 minuto
        max: 600,                      // 600 peticiones/min por IP
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Demasiadas peticiones, espera un momento.' },
    });

    // Mucho más estricto en el login/OAuth: ahí no hay polling y es lo que más se abusa.
    const limitadorAuth = rateLimit({
        windowMs: 60 * 1000,
        max: 30,                       // 30 intentos/min por IP
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Demasiados intentos de inicio de sesión, espera un minuto.' },
    });

    app.use('/api/auth', limitadorAuth);   // primero el específico del login
    app.use('/api', limitadorGeneral);     // y el general para el resto de la API

    // Calcula en qué servidores (de los que tiene el bot) el usuario es staff:
    // tiene el rol de soporte configurado, o permiso de gestionar canales / admin.
    async function guildsDelStaff(userId) {
        const out = [];
        for (const [, g] of client.guilds.cache) {
            try {
                const member = await g.members.fetch(userId);
                const cfg = await ServidorConfig.findOne({ guildId: g.id });
                const tieneRol = cfg && cfg.rolStaffId && member.roles.cache.has(cfg.rolStaffId);
                const tieneAcceso = cfg && Array.isArray(cfg.rolesPanelAcceso) && cfg.rolesPanelAcceso.some((id) => member.roles.cache.has(id));
                const esAdmin = member.permissions.has(PermissionsBitField.Flags.ManageChannels)
                    || member.permissions.has(PermissionsBitField.Flags.Administrator);
                if (tieneRol || tieneAcceso || esAdmin) out.push({ id: g.id, nombre: g.name, icono: g.iconURL({ size: 128 }) || null });
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
        if (req.path.startsWith('/spotify')) return next(); // callback OAuth de Spotify (verificado por state)

        // (1) ¿Sesión de staff por JWT?
        const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        const sesion = bearer ? verificarToken(bearer, JWT_SECRET) : null;
        if (sesion && sesion.staff) {
            req.staff = sesion;
            if (sesion.owner) return next(); // el PROPIETARIO lo ve todo, sin filtros
            // Un difusor llega a los endpoints de difusión aunque no sea de sus servidores.
            if (sesion.broadcaster && req.path.startsWith('/broadcast')) return next();
            // Acotamos por servidor: si la petición apunta a un guildId, debe ser de los suyos.
            const guildIds = sesion.guilds || [];
            const enQuery = req.query.guildId;
            const enRuta = (req.path.match(/^\/config\/([^/]+)/) || [])[1];
            const enBody = req.body && req.body.guildId; // p. ej. crear rol/panel o asignar miembro
            const objetivo = enQuery || enRuta || enBody;
            if (objetivo && !guildIds.includes(objetivo)) {
                return res.status(403).json({ error: 'No tienes acceso a ese servidor' });
            }
            return next();
        }

        // (2) API key del propietario
        if (!API_KEY) return next(); // sin key configurada: API abierta (ver aviso de arranque)
        const enviada = req.headers['x-api-key'] || bearer;
        if (enviada !== API_KEY) {
            // Distinguimos el motivo para que el panel muestre el mensaje correcto:
            // - Había un token (Bearer) pero no es válido -> sesión caducada/ inválida.
            // - No había token -> es la API key (VITE_API_KEY) la que no coincide.
            if (bearer) {
                return res.status(401).json({
                    error: 'Tu sesión ha caducado o no es válida. Cierra sesión y vuelve a entrar con Discord.',
                    code: 'session_invalid',
                });
            }
            return res.status(401).json({
                error: 'La clave del panel (VITE_API_KEY) no coincide con la API_KEY del bot.',
                code: 'apikey_mismatch',
            });
        }
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

    // --- Sistema de economía y tienda (rutas en api/routes/economia.js) ---
    app.use('/api', require('./routes/economia.js')({ portalAuth }));

    // --- Sistema de música (rutas en api/routes/musica.js) ---
    app.use('/api', require('./routes/musica.js')({ portalAuth, client }));
    app.use('/api', require('./routes/canales.js')({ client }));

    // --- Canales de voz temporales (rutas en api/routes/vozTemporal.js) ---
    app.use('/api', require('./routes/vozTemporal.js')({ client }));

    // --- Playlists de usuario (guardadas en BD) ---
    app.use('/api', require('./routes/playlists.js')({ portalAuth, client }));

    // --- Spotify OAuth y browsing de playlists ---
    app.use('/api', require('./routes/spotify.js')({ portalAuth }));

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

    // --- Endurecimiento: acota las acciones por panel (por su id). El panel debe
    // pertenecer a uno de los servidores del staff. El dueño/API key no aplica. ---
    const scopePanel = async (req, res, next) => {
        if (!req.staff || req.staff.owner) return next();
        try {
            const panel = await RolePanel.findById(req.params.id).select('guildId');
            if (!panel || !(req.staff.guilds || []).includes(panel.guildId)) {
                return res.status(403).json({ error: 'No tienes acceso a este panel' });
            }
            next();
        } catch (e) {
            console.error('Error verificando acceso al panel:', e);
            res.status(500).json({ error: 'Error de verificación' });
        }
    };

    // Versión genérica del acotado por recurso (mismo patrón) para cualquier modelo
    // con campo guildId, identificado por :id en la ruta.
    const scopeRecurso = (Modelo, etiqueta) => async (req, res, next) => {
        if (!req.staff || req.staff.owner) return next();
        try {
            const doc = await Modelo.findById(req.params.id).select('guildId');
            if (!doc || !(req.staff.guilds || []).includes(doc.guildId)) {
                return res.status(403).json({ error: `No tienes acceso a este ${etiqueta}` });
            }
            next();
        } catch (e) {
            console.error('Error verificando acceso al recurso:', e);
            res.status(500).json({ error: 'Error de verificación' });
        }
    };

    // ¿El solicitante puede MODERAR en este servidor? Dueño del bot / API key: sí.
    // Staff: necesita permiso de Discord (banear/expulsar/aislar o administrador) en ESE servidor.
    async function puedeModerar(req, guildId) {
        if (!req.staff || req.staff.owner) return true;
        if (!guildId) return false;
        try {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) return false;
            const member = await guild.members.fetch(req.staff.id);
            const P = PermissionsBitField.Flags;
            if (member.permissions.has(P.Administrator) || member.permissions.has(P.BanMembers)
                || member.permissions.has(P.KickMembers) || member.permissions.has(P.ModerateMembers)) return true;
            // Roles de moderación configurados en el panel.
            const cfg = await ServidorConfig.findOne({ guildId });
            const rolesMod = (cfg && cfg.rolesModeracion) || [];
            return rolesMod.some((id) => member.roles.cache.has(id));
        } catch { return false; }
    }

    // Middleware: exige permiso de moderación (el guildId va en query o body).
    const exigeModerador = async (req, res, next) => {
        const guildId = (req.body && req.body.guildId) || req.query.guildId;
        if (!guildId) {
            if (!req.staff || req.staff.owner) return next(); // dueño/API key sin servidor concreto
            return res.status(400).json({ error: 'Indica un servidor' });
        }
        if (await puedeModerar(req, guildId)) return next();
        return res.status(403).json({ error: 'Necesitas permiso de moderación en este servidor' });
    };

    // Como scopeRecurso pero además exige permiso de moderación sobre el guild del recurso.
    const scopeModRecurso = (Modelo, etiqueta) => async (req, res, next) => {
        if (!req.staff || req.staff.owner) return next();
        try {
            const doc = await Modelo.findById(req.params.id).select('guildId');
            if (!doc || !(req.staff.guilds || []).includes(doc.guildId)) {
                return res.status(403).json({ error: `No tienes acceso a este ${etiqueta}` });
            }
            if (!(await puedeModerar(req, doc.guildId))) {
                return res.status(403).json({ error: 'Necesitas permiso de moderación en este servidor' });
            }
            next();
        } catch (e) {
            console.error('Error verificando moderación del recurso:', e);
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
            state: ['staff', 'tienda'].includes(req.query.state) ? req.query.state : 'portal', // staff / tienda / portal
        });
        res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
    });

    

    // 2. Callback: intercambia el code, obtiene el usuario y emite la sesión
    app.get('/api/auth/discord/callback', async (req, res) => {
        const { code, state } = req.query;
        const esStaff = state === 'staff';
        const esTienda = state === 'tienda';
        const destinoError = esStaff ? `${FRONTEND_URL}/?staff=1&error=denegado`
            : esTienda ? `/tienda.html?error=denegado`
            : `${FRONTEND_URL}/?portal=1&error=denegado`;
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
                const esBroadcaster = BROADCAST_IDS.has(user.id);
                const guilds = esOwner
                    ? client.guilds.cache.map((g) => g.id)
                    : (await guildsDelStaff(user.id)).map((g) => g.id);
                // Un difusor puro (no staff de ningún servidor) también puede entrar.
                if (!esOwner && !esBroadcaster && guilds.length === 0) {
                    return res.redirect(`${FRONTEND_URL}/?staff=1&error=nostaff`);
                }
                const sesion = firmarToken({ id: user.id, username: user.username, avatar, staff: true, owner: esOwner, broadcaster: esBroadcaster, guilds }, JWT_SECRET);
                return res.redirect(`${FRONTEND_URL}/?staff=1&token=${sesion}`);
            }

            // Login desde la página de la tienda (servida por el propio Express):
            // volvemos a ella, en el mismo origen, con la sesión ya puesta.
            if (esTienda) {
                const sesion = firmarToken({ id: user.id, username: user.username, avatar }, JWT_SECRET);
                return res.redirect(`/tienda.html?token=${sesion}`);
            }

            // Login del PORTAL del cliente (comportamiento existente).
            const sesion = firmarToken({ id: user.id, username: user.username, avatar }, JWT_SECRET);
            res.redirect(`${FRONTEND_URL}/?portal=1&token=${sesion}`);
        } catch (error) {
            console.error('Error en el callback de OAuth:', error);
            res.redirect(esStaff ? `${FRONTEND_URL}/?staff=1&error=oauth`
                : esTienda ? `/tienda.html?error=oauth`
                : `${FRONTEND_URL}/?portal=1&error=oauth`);
        }
    });

    // ¿El usuario tiene Premium? Lo es si es miembro de algún servidor Premium.
    // (Los servidores premium suelen ser pocos, así que recorrerlos es barato.)
    async function usuarioEsPremium(userId) {
        const premium = await ServidorConfig.find({ esPremium: true }).select('guildId');
        for (const pg of premium) {
            const guild = client.guilds.cache.get(pg.guildId);
            if (!guild) continue;
            const miembro = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null);
            if (miembro) return true;
        }
        return false;
    }

    // 3. Datos de la sesión actual
    app.get('/api/portal/yo', portalAuth, async (req, res) => {
        const esPremium = await usuarioEsPremium(req.usuario.id).catch(() => false);
        res.json({ id: req.usuario.id, username: req.usuario.username, avatar: req.usuario.avatar, esPremium });
    });

    // Tarjeta de rango personalizada del usuario (premium). Leer / guardar.
    app.get('/api/portal/tarjeta', portalAuth, async (req, res) => {
        try {
            const t = await TarjetaPersonal.findOne({ userId: req.usuario.id });
            res.json(t || {});
        } catch (error) {
            console.error('Error al leer tarjeta personal:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    });

    app.put('/api/portal/tarjeta', portalAuth, async (req, res) => {
        try {
            const cambios = {};
            if (req.body.colorAcento !== undefined) cambios.colorAcento = req.body.colorAcento;
            if (req.body.fondoTipo !== undefined) cambios.fondoTipo = ['color', 'degradado', 'imagen'].includes(req.body.fondoTipo) ? req.body.fondoTipo : 'color';
            if (req.body.fondoColor !== undefined) cambios.fondoColor = req.body.fondoColor;
            if (req.body.colorSecundario !== undefined) cambios.colorSecundario = req.body.colorSecundario;
            if (req.body.preset !== undefined) cambios.preset = req.body.preset ? String(req.body.preset).slice(0, 40) : null;
            if (req.body.animado !== undefined) cambios.animado = !!req.body.animado;
            if (req.body.fondoImagen !== undefined) {
                const v = req.body.fondoImagen;
                cambios.fondoImagen = (v && (/^https?:\/\//i.test(v) || v.startsWith('/uploads/'))) ? String(v).slice(0, 500) : null;
            }
            const t = await TarjetaPersonal.findOneAndUpdate({ userId: req.usuario.id }, { $set: cambios }, { returnDocument: 'after', upsert: true });
            res.json({ success: true, tarjeta: t });
        } catch (error) {
            console.error('Error al guardar tarjeta personal:', error);
            res.status(500).json({ error: 'No se pudo guardar' });
        }
    });

    // Subir el fondo de la tarjeta desde el ordenador (dataURL base64).
    app.post('/api/portal/tarjeta/upload', portalAuth, (req, res) => {
        try {
            const m = /^data:(image\/(png|jpe?g|gif|webp));base64,(.+)$/i.exec(req.body?.datos || '');
            if (!m) return res.status(400).json({ error: 'Formato no válido (png, jpg, gif o webp)' });
            const ext = m[2].toLowerCase() === 'jpeg' ? 'jpg' : m[2].toLowerCase();
            const buffer = Buffer.from(m[3], 'base64');
            if (buffer.length > 8 * 1024 * 1024) return res.status(400).json({ error: 'La imagen supera 8 MB' });
            const archivo = `tarjeta-${req.usuario.id}-${Date.now()}.${ext}`;
            fs.writeFileSync(path.join(uploadsDir, archivo), buffer);
            res.json({ success: true, url: `/uploads/${archivo}` });
        } catch (error) {
            console.error('Error al subir fondo de tarjeta:', error);
            res.status(500).json({ error: 'No se pudo subir la imagen' });
        }
    });

    // Previsualización REAL de la tarjeta: renderiza la misma imagen que el bot
    // (PNG, o GIF si el estilo es animado) con los ajustes ENVIADOS (sin guardar)
    // y el avatar del usuario. Devuelve la imagen binaria.
    app.post('/api/portal/tarjeta/preview', portalAuth, async (req, res) => {
        try {
            const esPremium = await usuarioEsPremium(req.usuario.id).catch(() => false);
            const b = req.body || {};
            const opc = {
                color: b.colorAcento || '#5865F2',
                fondoTipo: b.fondoTipo || 'color',
                fondoColor: b.fondoColor || '#1e2030',
                colorSecundario: b.colorSecundario || null,
                preset: b.preset || null,
                animado: !!b.animado,
            };
            // La imagen propia solo aplica con premium (igual que en el bot).
            if (b.fondoTipo === 'imagen') {
                if (esPremium) opc.fondoImagen = b.fondoImagen;
                else opc.fondoTipo = b.colorSecundario ? 'degradado' : 'color';
            }
            const r = await construirBuffer(opc, esPremium, {
                avatarURL: req.usuario.avatar, nombre: req.usuario.username,
                nivel: 12, rank: 1, xpActual: 600, xpNecesaria: 1000,
            });
            if (!r) return res.status(500).json({ error: 'No se pudo generar' });
            res.set('Content-Type', r.ext === 'gif' ? 'image/gif' : 'image/png');
            res.set('Cache-Control', 'no-store');
            res.send(r.buffer);
        } catch (error) {
            console.error('Error en previsualización de tarjeta:', error);
            res.status(500).json({ error: 'No se pudo generar la previsualización' });
        }
    });

    // Catálogo de presets para el PORTAL (qué hay disponible para los usuarios).
    app.get('/api/portal/presets', portalAuth, async (req, res) => {
        try {
            const cat = await CatalogoPresets.findOne({ clave: 'global' });
            res.json({ ocultos: cat?.ocultos || [], personalizados: cat?.personalizados || [] });
        } catch (error) {
            console.error('Error leyendo catálogo de presets:', error);
            res.json({ ocultos: [], personalizados: [] });
        }
    });

    // Catálogo de presets — gestión desde el PANEL DE ADMIN (protegido por el
    // middleware de /api: requiere sesión de staff o la API key del propietario).
    app.get('/api/presets-tarjeta', async (req, res) => {
        try {
            const cat = await CatalogoPresets.findOne({ clave: 'global' });
            res.json({ ocultos: cat?.ocultos || [], personalizados: cat?.personalizados || [] });
        } catch (error) {
            console.error('Error leyendo catálogo de presets:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    });

    app.put('/api/presets-tarjeta', async (req, res) => {
        try {
            const b = req.body || {};
            const ocultos = Array.isArray(b.ocultos) ? b.ocultos.map(String).slice(0, 50) : [];
            const personalizados = (Array.isArray(b.personalizados) ? b.personalizados : []).slice(0, 50).map((p) => ({
                id: (String(p.id || '').trim() || `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`).slice(0, 40),
                nombre: String(p.nombre || 'Diseño').slice(0, 40),
                colorAcento: p.colorAcento || '#5865F2',
                fondoColor: p.fondoColor || '#1e2030',
                colorSecundario: p.colorSecundario || '#9b59b6',
                fondoTipo: ['color', 'degradado'].includes(p.fondoTipo) ? p.fondoTipo : 'degradado',
                premium: !!p.premium,
                animado: !!p.animado,
            }));
            const cat = await CatalogoPresets.findOneAndUpdate(
                { clave: 'global' }, { $set: { ocultos, personalizados } },
                { upsert: true, returnDocument: 'after' },
            );
            res.json({ success: true, ocultos: cat.ocultos, personalizados: cat.personalizados });
        } catch (error) {
            console.error('Error guardando catálogo de presets:', error);
            res.status(500).json({ error: 'No se pudo guardar' });
        }
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
    app.get('/api/estado', (req, res) => res.json({
        message: 'Sokyo Bot está operativo',
        ok: true,
        ready: !!(client && typeof client.isReady === 'function' && client.isReady()),
        apiKeyRequired: !!API_KEY, // si es true, el panel necesita sesión de Discord o la API key correcta
    }));

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

    app.get('/api/ping', (req, res) => {

        res.json({ ping: Math.round(client.ws.ping) });
    });

    // Qué SECCIONES del panel puede ver el usuario actual en un servidor.
    // Propietario/API key y administradores ven todo. El resto, según accesoAreas:
    // lista vacía = visible para todos; con roles = solo quien tenga uno de ellos.
    // Debe cubrir TODOS los grupos del nav (incluida 'cuenta' = facturación) para
    // que se puedan restringir; si falta uno, ese grupo sería visible para todos.
    const AREAS = ['cuenta', 'datos', 'entrada', 'musica', 'tickets', 'roles', 'moderacion', 'logs', 'mensajes', 'config'];
    app.get('/api/mis-permisos', async (req, res) => {
        try {
            const todo = () => res.json({ areas: Object.fromEntries(AREAS.map((a) => [a, true])) });
            if (!req.staff || req.staff.owner) return todo();

            const guildId = req.query.guildId;
            const guild = guildId ? client.guilds.cache.get(guildId) : null;
            const member = guild ? await guild.members.fetch(req.staff.id).catch(() => null) : null;
            if (member && member.permissions.has(PermissionsBitField.Flags.Administrator)) return todo();

            const cfg = guildId ? await ServidorConfig.findOne({ guildId }) : null;
            const areas = {};
            for (const a of AREAS) {
                const lista = (cfg && cfg.accesoAreas && cfg.accesoAreas[a]) || [];
                areas[a] = lista.length === 0 || !!(member && lista.some((id) => member.roles.cache.has(id)));
            }
            res.json({ areas });
        } catch (error) {
            console.error('Error en mis-permisos:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    });

    // Config de servidores. Con ?guildId= devuelve solo ese (creándolo si no existe).
    app.get('/api/servidores', async (req, res) => {
        const { guildId } = req.query;
        // Adjunta iaActiva (¿hay clave de IA configurada?) para que el panel muestre o no la IA.
        const conIA = (doc) => { const o = doc.toObject ? doc.toObject() : doc; o.iaActiva = ia.iaDisponible(); return o; };
        if (guildId) {
            let cfg = await ServidorConfig.findOne({ guildId });
            if (!cfg) cfg = await ServidorConfig.create({ guildId });
            return res.json([conIA(cfg)]);
        }
        // Sin guildId: el staff (no dueño) solo ve la config de SUS servidores.
        if (req.staff && !req.staff.owner) {
            return res.json((await ServidorConfig.find({ guildId: { $in: req.staff.guilds || [] } })).map(conIA));
        }
        res.json((await ServidorConfig.find()).map(conIA));
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

    // --- ANALÍTICA (Pro): radiografía completa del servidor + insights ---
    app.get('/api/stats/analitica', async (req, res) => {
        try {
            const gid = req.query.guildId || (req.staff && (req.staff.guilds || [])[0]) || null;
            if (!gid) return res.json({ esPro: false, vacio: true });
            const cfg = await ServidorConfig.findOne({ guildId: gid });
            const dias = Math.min(90, Math.max(7, parseInt(req.query.dias, 10) || 30));
            const data = await construirAnalitica(client, gid, cfg, dias);
            data.iaActiva = ia.iaDisponible();
            res.json(data);
        } catch (error) {
            console.error('Error en /api/stats/analitica:', error.message);
            res.status(500).json({ error: 'Error del servidor' });
        }
    });

    // --- INFORME CON IA (Pro): convierte la analítica en informe + plan de acción ---
    app.post('/api/stats/analitica/informe', async (req, res) => {
        try {
            const gid = req.query.guildId || (req.body && req.body.guildId) || (req.staff && (req.staff.guilds || [])[0]) || null;
            if (!gid) return res.status(400).json({ error: 'Falta el servidor' });
            if (!ia.iaDisponible()) return res.status(503).json({ error: 'El asistente IA no está configurado (falta ANTHROPIC_API_KEY).' });
            const cfg = await ServidorConfig.findOne({ guildId: gid });
            if (!billing.esPro(cfg)) return res.status(402).json({ error: 'El informe con IA es una función Pro.' });
            const est = billing.estadoIA(cfg);
            if (est.restantes <= 0) return res.status(402).json({ error: `Has agotado tus ${est.cuota} usos de IA de este mes. Se renueva el día 1.`, iaUsos: est.usos, iaCuota: est.cuota });
            const dias = Math.min(90, Math.max(7, parseInt(req.query.dias, 10) || 30));
            const data = await construirAnalitica(client, gid, cfg, dias);
            const texto = await ia.informeServidor(data);
            const consumo = await billing.consumirIA(gid, cfg);
            res.json({ texto, iaUsos: consumo.usos, iaCuota: consumo.cuota });
        } catch (error) {
            console.error('Error en informe IA:', error.message);
            res.status(500).json({ error: 'No se pudo generar el informe' });
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

    // --- ASISTENTE IA (Pro): resumen y respuesta sugerida de un ticket ---
    app.post('/api/tickets/:canalId/ia/:accion', scopeTicket, async (req, res) => {
        try {
            const accion = req.params.accion;
            if (!['resumen', 'sugerir'].includes(accion)) return res.status(400).json({ error: 'Acción no válida' });
            if (!ia.iaDisponible()) return res.status(503).json({ error: 'El asistente IA no está configurado (falta ANTHROPIC_API_KEY).' });
            const ticket = await Ticket.findOne({ canalId: req.params.canalId });
            if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
            const cfg = await ServidorConfig.findOne({ guildId: ticket.guildId });
            // Cuota mensual de IA por servidor (Free 5 · Pro 150 · Agencia 1500).
            const est = billing.estadoIA(cfg);
            if (est.restantes <= 0) {
                return res.status(402).json({ error: `Has agotado tus ${est.cuota} usos de IA de este mes. Se renueva el día 1${est.cuota <= 5 ? ' · sube a Pro para 150 usos' : ''}.`, iaUsos: est.usos, iaCuota: est.cuota });
            }
            const mensajes = await Mensaje.find({ ticketId: req.params.canalId }).sort({ fecha: 1 }).limit(100);
            const texto = accion === 'resumen'
                ? await ia.resumirTicket(mensajes, ticket)
                : await ia.sugerirRespuesta(mensajes, ticket);
            const consumo = await billing.consumirIA(ticket.guildId, cfg); // solo cuenta si tuvo éxito
            res.json({ texto, iaUsos: consumo.usos, iaCuota: consumo.cuota });
        } catch (error) {
            console.error('Error en el asistente IA:', error.message);
            res.status(500).json({ error: 'La IA no pudo responder. Inténtalo de nuevo.' });
        }
    });

    // --- TRANSCRIPT HTML/PDF (Pro): descarga la conversación del ticket ---
    app.get('/api/tickets/:canalId/transcript', scopeTicket, async (req, res) => {
        try {
            const ticket = await Ticket.findOne({ canalId: req.params.canalId });
            if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
            const cfg = await ServidorConfig.findOne({ guildId: ticket.guildId });
            if (!billing.esPro(cfg)) return res.status(402).json({ error: 'Los transcripts en HTML/PDF son una función Pro.' });

            if (req.query.format === 'pdf') {
                const buffer = await generarTranscriptPDF(req.params.canalId, ticket);
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="transcript-${req.params.canalId}.pdf"`);
                return res.send(buffer);
            }

            const html = await construirTranscriptHTML(req.params.canalId, ticket);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="transcript-${req.params.canalId}.html"`);
            res.send(html);
        } catch (error) {
            console.error('Error generando transcript:', error.message);
            res.status(500).json({ error: 'No se pudo generar el transcript' });
        }
    });

    // --- RESUMEN DIARIO (Pro): guardar config + enviar prueba ---
    app.put('/api/config/:guildId/resumen', async (req, res) => {
        try {
            const b = req.body || {};
            const set = {
                'resumenDiario.activo': !!b.activo,
                'resumenDiario.hora': Math.min(23, Math.max(0, parseInt(b.hora, 10) || 9)),
                'resumenDiario.canalId': b.canalId ? String(b.canalId) : null,
                'resumenDiario.destinatarioId': b.destinatarioId ? String(b.destinatarioId).trim() : null,
            };
            const config = await ServidorConfig.findOneAndUpdate(
                { guildId: req.params.guildId }, { $set: set }, { returnDocument: 'after', upsert: true },
            );
            res.json({ success: true, config });
        } catch (error) {
            console.error('Error al guardar resumen diario:', error.message);
            res.status(500).json({ error: 'No se pudo guardar' });
        }
    });

    app.post('/api/resumen/:guildId/probar', async (req, res) => {
        try {
            const r = await enviarResumen(client, req.params.guildId, { prueba: true });
            if (r.ok) return res.json({ success: true });
            res.status(400).json({ error: r.error || 'No se pudo enviar' });
        } catch (error) {
            console.error('Error en prueba de resumen:', error.message);
            res.status(500).json({ error: 'No se pudo enviar el resumen' });
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
            const { ratingActivo, enviarTranscript, avisoCierreCanal, pingSoporte, rolSoporteId, logsActivos, canalLogsId } = req.body;

            // Construimos solo con los campos que llegan (evita pisar con undefined).
            const cambios = {};
            if (ratingActivo !== undefined) cambios.ratingActivo = !!ratingActivo;
            if (enviarTranscript !== undefined) cambios.enviarTranscript = !!enviarTranscript;
            if (avisoCierreCanal !== undefined) cambios.avisoCierreCanal = !!avisoCierreCanal;
            if (pingSoporte !== undefined) cambios.pingSoporte = !!pingSoporte;
            if (rolSoporteId !== undefined) cambios.rolSoporteId = rolSoporteId || null;
            if (canalLogsId !== undefined) cambios.canalLogsId = canalLogsId || null;
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
            const guild = await resolverGuild(req.query.guildId, req.staff);
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

    // --- Canales de VOZ del servidor (para el selector de generadores) ---
    app.get('/api/servidor/canales-voz', async (req, res) => {
        try {
            const guild = await resolverGuild(req.query.guildId, req.staff);
            if (!guild) return res.json([]);
            const canales = guild.channels.cache
                .filter((c) => c.type === ChannelType.GuildVoice)
                .sort((a, b) => a.position - b.position)
                .map((c) => ({ id: c.id, nombre: c.name }));
            res.json(canales);
        } catch (error) {
            console.error('Error al obtener canales de voz:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    });

    // --- SOLO PROPIETARIO (OWNER_IDS): activar/cambiar plan de CUALQUIER servidor ---
    // `req.staff.owner` se firma en el login a partir de OWNER_IDS (no es falsificable
    // sin el JWT_SECRET). Esto deja a los dueños del bot conceder Pro/Agencia a mano
    // desde el panel, sin tocar la consola. NADIE más puede llamar a esto.
    const exigeOwner = (req, res, next) => {
        if (req.staff && req.staff.owner) return next();
        return res.status(403).json({ error: 'Solo el propietario del bot puede hacer esto.' });
    };
    app.post('/api/owner/premium', exigeOwner, async (req, res) => {
        try {
            const guildId = String(req.body.guildId || '').trim();
            const plan = String(req.body.plan || '').toLowerCase();
            // `dias`: nº de días de suscripción. 0/ausente = de por vida (sin caducidad).
            const dias = Number(req.body.dias);
            if (!guildId) return res.status(400).json({ error: 'Falta el guildId.' });
            if (!['free', 'pro', 'agency'].includes(plan)) return res.status(400).json({ error: 'Plan no válido.' });
            if (plan === 'free') {
                await billing.desactivarPlan(guildId);
            } else {
                const premiumHasta = (Number.isFinite(dias) && dias > 0)
                    ? new Date(Date.now() + dias * 24 * 60 * 60 * 1000)
                    : null; // null = de por vida
                await billing.activarPlan(guildId, { plan, premiumHasta, cancelaAlFinal: false });
            }
            const config = await ServidorConfig.findOne({ guildId });
            res.json({ success: true, config });
        } catch (error) {
            console.error('owner/premium:', error.message);
            res.status(500).json({ error: 'No se pudo cambiar el plan.' });
        }
    });

    // Listado de TODOS los servidores con su suscripción (solo owner). Para el
    // panel de control de suscripciones (ver/ajustar plan y caducidad a mano).
    app.get('/api/owner/servidores', exigeOwner, async (req, res) => {
        try {
            const docs = await ServidorConfig.find({}).select(
                'guildId esPremium plan premiumHasta premiumCancelaAlFinal stripeSubscriptionId');
            const lista = docs.map((c) => {
                const guild = client.guilds.cache.get(c.guildId);
                return {
                    guildId: c.guildId,
                    nombre: guild?.name || null,
                    icono: guild?.iconURL?.({ size: 64 }) || null,
                    miembros: guild?.memberCount ?? null,
                    presente: !!guild, // ¿el bot sigue en ese servidor?
                    plan: c.plan || 'free',
                    esPremium: !!c.esPremium,
                    activo: billing.premiumActivo(c),       // ¿la suscripción está vigente ahora?
                    premiumHasta: c.premiumHasta || null,    // null = de por vida (si premium)
                    cancelaAlFinal: !!c.premiumCancelaAlFinal,
                    pagado: !!c.stripeSubscriptionId,        // viene de Stripe (no manual)
                };
            });
            // Primero los premium, luego por nombre.
            lista.sort((a, b) => (Number(b.activo) - Number(a.activo)) || String(a.nombre || a.guildId).localeCompare(String(b.nombre || b.guildId)));
            res.json(lista);
        } catch (error) {
            console.error('owner/servidores:', error.message);
            res.status(500).json({ error: 'No se pudo cargar la lista.' });
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
            const guild = await resolverGuild(req.query.guildId, req.staff);
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

    // --- MODERACIÓN: ajustes (canal de registro + aviso por MD) ---
    app.put('/api/config/:guildId/modlog', async (req, res) => {
        try {
            const cambios = {};
            if (req.body.canalModLogId !== undefined) cambios.canalModLogId = req.body.canalModLogId || null;
            if (req.body.dmSancion !== undefined) cambios.dmSancion = !!req.body.dmSancion;
            const config = await ServidorConfig.findOneAndUpdate(
                { guildId: req.params.guildId },
                { $set: cambios },
                { returnDocument: 'after', upsert: true },
            );
            res.json({ success: true, config });
        } catch (error) {
            console.error('Error al guardar ajustes de moderación:', error);
            res.status(500).json({ error: 'No se pudieron guardar los ajustes' });
        }
    });

    // --- AUTOMODERADOR: filtros automáticos de mensajes ---
    app.put('/api/config/:guildId/automod', async (req, res) => {
        try {
            const ACC = ['borrar', 'aviso', 'timeout', 'expulsion', 'ban'];
            const accion = (a, def) => (ACC.includes(a) ? a : def);
            const num = (v, def, min = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= min ? n : def; };
            const arr = (v) => (Array.isArray(v) ? v.map((x) => String(x || '').trim()).filter(Boolean) : []);
            const b = req.body.automod || req.body || {};

            const ACC_MIEMBRO = ['alerta', 'timeout', 'kick', 'ban'];
            const accionMiembro = (a, def) => (ACC_MIEMBRO.includes(a) ? a : def);
            const am = {
                activo: !!b.activo,
                preset: typeof b.preset === 'string' ? b.preset.slice(0, 40) : '',
                rolesExentos: arr(b.rolesExentos),
                canalesExentos: arr(b.canalesExentos),
                avisarEnCanal: b.avisarEnCanal !== false,
                canalAlertasId: b.canalAlertasId ? String(b.canalAlertasId) : null,
                ia: {
                    activo: !!(b.ia && b.ia.activo),
                    accion: accion(b.ia && b.ia.accion, 'borrar'),
                    timeoutMin: num(b.ia && b.ia.timeoutMin, 10, 1),
                    sensibilidad: ['baja', 'media', 'alta'].includes(b.ia && b.ia.sensibilidad) ? b.ia.sensibilidad : 'media',
                    minLongitud: num(b.ia && b.ia.minLongitud, 12, 1),
                    categorias: {
                        toxicidad: !(b.ia && b.ia.categorias && b.ia.categorias.toxicidad === false),
                        acoso: !(b.ia && b.ia.categorias && b.ia.categorias.acoso === false),
                        amenazas: !(b.ia && b.ia.categorias && b.ia.categorias.amenazas === false),
                        nsfw: !(b.ia && b.ia.categorias && b.ia.categorias.nsfw === false),
                        autolesion: !(b.ia && b.ia.categorias && b.ia.categorias.autolesion === false),
                    },
                },
                palabras: {
                    activo: !!(b.palabras && b.palabras.activo),
                    lista: arr(b.palabras && b.palabras.lista).map((s) => s.slice(0, 100)).slice(0, 200),
                    accion: accion(b.palabras && b.palabras.accion, 'borrar'),
                    timeoutMin: num(b.palabras && b.palabras.timeoutMin, 10, 1),
                },
                invitaciones: {
                    activo: !!(b.invitaciones && b.invitaciones.activo),
                    accion: accion(b.invitaciones && b.invitaciones.accion, 'borrar'),
                    timeoutMin: num(b.invitaciones && b.invitaciones.timeoutMin, 10, 1),
                },
                enlaces: {
                    activo: !!(b.enlaces && b.enlaces.activo),
                    accion: accion(b.enlaces && b.enlaces.accion, 'borrar'),
                    timeoutMin: num(b.enlaces && b.enlaces.timeoutMin, 10, 1),
                    listaBlanca: arr(b.enlaces && b.enlaces.listaBlanca).map((s) => s.slice(0, 100)).slice(0, 100),
                },
                spam: {
                    activo: !!(b.spam && b.spam.activo),
                    accion: accion(b.spam && b.spam.accion, 'timeout'),
                    timeoutMin: num(b.spam && b.spam.timeoutMin, 5, 1),
                    maxMensajes: num(b.spam && b.spam.maxMensajes, 5, 2),
                    enSegundos: num(b.spam && b.spam.enSegundos, 5, 1),
                    repetidos: !(b.spam && b.spam.repetidos === false),
                },
                menciones: {
                    activo: !!(b.menciones && b.menciones.activo),
                    accion: accion(b.menciones && b.menciones.accion, 'borrar'),
                    timeoutMin: num(b.menciones && b.menciones.timeoutMin, 10, 1),
                    max: num(b.menciones && b.menciones.max, 5, 1),
                    bloquearEveryone: !(b.menciones && b.menciones.bloquearEveryone === false),
                },
                mayusculas: {
                    activo: !!(b.mayusculas && b.mayusculas.activo),
                    accion: accion(b.mayusculas && b.mayusculas.accion, 'borrar'),
                    timeoutMin: num(b.mayusculas && b.mayusculas.timeoutMin, 5, 1),
                    porcentaje: Math.min(100, num(b.mayusculas && b.mayusculas.porcentaje, 70, 1)),
                    minLongitud: num(b.mayusculas && b.mayusculas.minLongitud, 10, 1),
                },
                estafas: {
                    activo: !!(b.estafas && b.estafas.activo),
                    accion: accion(b.estafas && b.estafas.accion, 'ban'),
                    timeoutMin: num(b.estafas && b.estafas.timeoutMin, 60, 1),
                    palabrasClave: arr(b.estafas && b.estafas.palabrasClave).map((s) => s.slice(0, 100)).slice(0, 200),
                    conEnlace: !(b.estafas && b.estafas.conEnlace === false),
                    conImagen: !(b.estafas && b.estafas.conImagen === false),
                    nitroFalso: !(b.estafas && b.estafas.nitroFalso === false),
                    borrarHoras: Math.min(168, num(b.estafas && b.estafas.borrarHoras, 1, 0)),
                },
                antiRaid: {
                    activo: !!(b.antiRaid && b.antiRaid.activo),
                    uniones: num(b.antiRaid && b.antiRaid.uniones, 8, 2),
                    enSegundos: num(b.antiRaid && b.antiRaid.enSegundos, 10, 1),
                    accion: ['kick', 'ban', 'timeout'].includes(b.antiRaid && b.antiRaid.accion) ? b.antiRaid.accion : 'kick',
                    timeoutMin: num(b.antiRaid && b.antiRaid.timeoutMin, 60, 1),
                    edadMinHoras: num(b.antiRaid && b.antiRaid.edadMinHoras, 0, 0),
                    lockdownMin: num(b.antiRaid && b.antiRaid.lockdownMin, 10, 1),
                },
                cuentasNuevas: {
                    activo: !!(b.cuentasNuevas && b.cuentasNuevas.activo),
                    edadMinHoras: num(b.cuentasNuevas && b.cuentasNuevas.edadMinHoras, 72, 1),
                    sinAvatar: !(b.cuentasNuevas && b.cuentasNuevas.sinAvatar === false),
                    accion: accionMiembro(b.cuentasNuevas && b.cuentasNuevas.accion, 'alerta'),
                    timeoutMin: num(b.cuentasNuevas && b.cuentasNuevas.timeoutMin, 60, 1),
                    asignarRolId: (b.cuentasNuevas && b.cuentasNuevas.asignarRolId) ? String(b.cuentasNuevas.asignarRolId) : null,
                },
            };

            const config = await ServidorConfig.findOneAndUpdate(
                { guildId: req.params.guildId },
                { $set: { automod: am } },
                { returnDocument: 'after', upsert: true },
            );
            res.json({ success: true, config });
        } catch (error) {
            console.error('Error al guardar automod:', error);
            res.status(500).json({ error: 'No se pudo guardar el automoderador' });
        }
    });

    // --- SEGURIDAD: verificación de entrada ---
    app.put('/api/config/:guildId/verificacion', async (req, res) => {
        try {
            const b = req.body.verificacion || req.body || {};
            const v = {
                activo: !!b.activo,
                canalId: b.canalId ? String(b.canalId) : null,
                rolVerificadoId: b.rolVerificadoId ? String(b.rolVerificadoId) : null,
                modo: b.modo === 'captcha' ? 'captcha' : 'boton',
                titulo: String(b.titulo || '🔒 Verificación').slice(0, 256),
                descripcion: String(b.descripcion || '').slice(0, 2000),
                textoBoton: String(b.textoBoton || '✅ Verificarme').slice(0, 80),
                embed: sanearEmbed(b.embed), // embed personalizable del panel (null = básico)
            };
            const set = Object.fromEntries(Object.entries(v).map(([k, val]) => [`verificacion.${k}`, val]));
            // Puertas de entrada excluyentes: al activar la verificación normal se
            // apaga la doble bienvenida (solo el flag, sin tocar sus versiones).
            if (v.activo) set['embudoAB.activo'] = false;
            const config = await ServidorConfig.findOneAndUpdate(
                { guildId: req.params.guildId },
                { $set: set },
                { returnDocument: 'after', upsert: true },
            );
            res.json({ success: true, config });
        } catch (error) {
            console.error('Error al guardar verificación:', error);
            res.status(500).json({ error: 'No se pudo guardar la verificación' });
        }
    });

    // Publica (o reedita) el panel de verificación en el canal configurado.
    app.post('/api/seguridad/:guildId/verificacion/publicar', async (req, res) => {
        try {
            const mensajeId = await publicarPanelVerificacion(client, req.params.guildId);
            res.json({ success: true, mensajeId });
        } catch (error) {
            console.error('Error al publicar panel de verificación:', error);
            res.status(400).json({ error: error.message || 'No se pudo publicar el panel' });
        }
    });

    // --- EMBUDO DE BIENVENIDA: Test A/B de retención ---
    app.put('/api/config/:guildId/embudo', async (req, res) => {
        try {
            const cfgActual = await ServidorConfig.findOne({ guildId: req.params.guildId });
            if (!billing.esPro(cfgActual)) return res.status(402).json({ error: 'El embudo de bienvenida A/B es una función Pro.' });
            const b = req.body.embudoAB || req.body || {};
            const a = b.varianteA || {};
            const bb = b.varianteB || {};
            const set = {
                'embudoAB.activo': !!b.activo,
                'embudoAB.entrega': ['md', 'ambos'].includes(b.entrega) ? b.entrega : 'panel',
                'embudoAB.canalId': b.canalId ? String(b.canalId) : null,
                'embudoAB.rolVerificadoId': b.rolVerificadoId ? String(b.rolVerificadoId) : null,
                'embudoAB.varianteA.titulo': String(a.titulo || '📋 Bienvenido/a — Lee las normas').slice(0, 256),
                'embudoAB.varianteA.reglas': String(a.reglas || '').slice(0, 2000),
                'embudoAB.varianteA.captcha': a.captcha !== false,
                'embudoAB.varianteA.textoBoton': String(a.textoBoton || '✅ Aceptar y acceder').slice(0, 80),
                'embudoAB.varianteB.titulo': String(bb.titulo || '👋 ¡Te damos la bienvenida!').slice(0, 256),
                'embudoAB.varianteB.descripcion': String(bb.descripcion || '').slice(0, 2000),
                'embudoAB.varianteB.color': /^#[0-9a-fA-F]{6}$/.test(bb.color || '') ? bb.color : '#5865F2',
                'embudoAB.varianteB.reglas': String(bb.reglas || '').slice(0, 2000),
                'embudoAB.varianteB.textoBoton': String(bb.textoBoton || '🎉 Unirme').slice(0, 80),
            };
            // Puertas de entrada excluyentes: al activar la doble bienvenida se
            // apaga la verificación normal (solo el flag, sin tocar su config).
            if (b.activo) set['verificacion.activo'] = false;
            const config = await ServidorConfig.findOneAndUpdate(
                { guildId: req.params.guildId },
                { $set: set },
                { returnDocument: 'after', upsert: true },
            );
            res.json({ success: true, config });
        } catch (error) {
            console.error('Error al guardar embudo:', error);
            res.status(500).json({ error: 'No se pudo guardar el embudo' });
        }
    });

    // Publica (o reedita) el panel del embudo en el canal configurado.
    app.post('/api/embudo/:guildId/publicar', async (req, res) => {
        try {
            const cfgActual = await ServidorConfig.findOne({ guildId: req.params.guildId });
            if (!billing.esPro(cfgActual)) return res.status(402).json({ error: 'El embudo de bienvenida A/B es una función Pro.' });
            const mensajeId = await publicarPanelEmbudo(client, req.params.guildId);
            res.json({ success: true, mensajeId });
        } catch (error) {
            console.error('Error al publicar panel del embudo:', error.message);
            res.status(400).json({ error: error.message || 'No se pudo publicar el panel' });
        }
    });

    // --- COMUNIDAD: mensajes de bienvenida y despedida ---
    app.put('/api/config/:guildId/bienvenidas', async (req, res) => {
        try {
            const norm = (b) => {
                b = b || {};
                const embed = sanearEmbed(b.embed);
                return {
                    activo: !!b.activo,
                    canalId: b.canalId ? String(b.canalId) : null,
                    contenido: String(b.contenido || '').slice(0, 2000),
                    mencionar: !!b.mencionar,
                    embed: embedTieneContenido(embed) ? embed : null,
                };
            };
            const set = {};
            for (const [k, v] of Object.entries(norm(req.body.bienvenida))) set[`bienvenida.${k}`] = v;
            for (const [k, v] of Object.entries(norm(req.body.despedida))) set[`despedida.${k}`] = v;
            const config = await ServidorConfig.findOneAndUpdate(
                { guildId: req.params.guildId },
                { $set: set },
                { returnDocument: 'after', upsert: true },
            );
            res.json({ success: true, config });
        } catch (error) {
            console.error('Error al guardar bienvenidas:', error);
            res.status(500).json({ error: 'No se pudo guardar' });
        }
    });

    // Envía un mensaje de prueba (bienvenida/despedida) al canal, usando al propio
    // staff que lo solicita como miembro de ejemplo.
    app.post('/api/bienvenidas/:guildId/probar', async (req, res) => {
        try {
            const gid = req.params.guildId;
            const tipo = req.body.tipo === 'despedida' ? 'despedida' : 'bienvenida';
            const cfg = await ServidorConfig.findOne({ guildId: gid });
            if (!cfg) return res.status(404).json({ error: 'Servidor sin configurar.' });
            const guild = client.guilds.cache.get(gid);
            if (!guild) return res.status(404).json({ error: 'Servidor no encontrado.' });
            // El panel autentica como staff (req.staff); el portal como usuario (req.usuario).
            const probadorId = (req.staff && req.staff.id) || (req.usuario && req.usuario.id);
            if (!probadorId) return res.status(401).json({ error: 'Sesión no válida.' });
            const member = await guild.members.fetch(probadorId).catch(() => null);
            if (!member) return res.status(400).json({ error: 'No estás en ese servidor para la prueba.' });
            const r = await (tipo === 'despedida' ? enviarDespedida : enviarBienvenida)(member, cfg);
            if (r && r.error) return res.status(400).json({ error: r.error });
            res.json({ success: true });
        } catch (error) {
            console.error('Error en prueba de bienvenida:', error.message);
            res.status(500).json({ error: 'No se pudo enviar la prueba' });
        }
    });

    // --- SEGURIDAD: ajustes de reportes ---
    app.put('/api/config/:guildId/reportes', async (req, res) => {
        try {
            const b = req.body.reportes || req.body || {};
            const config = await ServidorConfig.findOneAndUpdate(
                { guildId: req.params.guildId },
                { $set: { 'reportes.activo': !!b.activo, 'reportes.canalId': b.canalId ? String(b.canalId) : null } },
                { returnDocument: 'after', upsert: true },
            );
            res.json({ success: true, config });
        } catch (error) {
            console.error('Error al guardar reportes:', error);
            res.status(500).json({ error: 'No se pudo guardar' });
        }
    });

    // Listado de reportes (filtrado por servidor / staff).
    app.get('/api/reportes', async (req, res) => {
        try {
            const { guildId } = req.query;
            const filtro = {};
            if (guildId) filtro.guildId = guildId;
            else if (req.staff && !req.staff.owner) filtro.guildId = { $in: req.staff.guilds || [] };
            res.json(await Reporte.find(filtro).sort({ fecha: -1 }).limit(200));
        } catch (error) {
            console.error('Error al listar reportes:', error);
            res.status(500).json({ error: 'Fallo interno' });
        }
    });

    // Cambia el estado de un reporte (resolver / descartar) desde el panel.
    app.put('/api/reportes/:id', async (req, res) => {
        try {
            const estado = ['resuelto', 'descartado', 'pendiente'].includes(req.body.estado) ? req.body.estado : null;
            if (!estado) return res.status(400).json({ error: 'Estado no válido' });
            const doc = await Reporte.findById(req.params.id);
            if (!doc) return res.status(404).json({ error: 'Reporte no encontrado' });
            if (req.staff && !req.staff.owner && !(req.staff.guilds || []).includes(doc.guildId)) {
                return res.status(403).json({ error: 'Sin permiso para este servidor' });
            }
            doc.estado = estado;
            doc.resueltoPor = (req.staff && req.staff.username) || 'Panel Web';
            doc.resueltoFecha = estado === 'pendiente' ? null : new Date();
            await doc.save();
            res.json({ success: true, reporte: doc });
        } catch (error) {
            console.error('Error al actualizar reporte:', error);
            res.status(500).json({ error: 'Fallo interno' });
        }
    });

    // Abre un ticket a raíz de un reporte (lo enlaza y lo marca como resuelto).
    app.post('/api/reportes/:id/ticket', async (req, res) => {
        try {
            const doc = await Reporte.findById(req.params.id);
            if (!doc) return res.status(404).json({ error: 'Reporte no encontrado' });
            if (req.staff && !req.staff.owner && !(req.staff.guilds || []).includes(doc.guildId)) {
                return res.status(403).json({ error: 'Sin permiso para este servidor' });
            }
            const r = await abrirTicketDesdeReporte(client, req.params.id, (req.staff && req.staff.username) || 'Panel Web');
            res.json({ success: true, canalId: r.canalId, reporte: r.reporte });
        } catch (error) {
            console.error('Error al abrir ticket desde reporte:', error);
            res.status(400).json({ error: error.message || 'No se pudo abrir el ticket' });
        }
    });

    // --- SEGURIDAD: exportar / importar configuración del servidor ---
    // Campos que NO se exportan/importan (identidad, estado interno, premium).
    const CAMPOS_NO_BACKUP = ['_id', '__v', 'guildId', 'esPremium', 'premiumHasta', 'autoAsignarIndex'];
    app.get('/api/config/:guildId/export', async (req, res) => {
        try {
            const cfg = await ServidorConfig.findOne({ guildId: req.params.guildId }).lean();
            if (!cfg) return res.status(404).json({ error: 'Sin configuración' });
            for (const k of CAMPOS_NO_BACKUP) delete cfg[k];
            res.json({ version: 1, exportado: new Date().toISOString(), config: cfg });
        } catch (error) {
            console.error('Error al exportar config:', error);
            res.status(500).json({ error: 'No se pudo exportar' });
        }
    });

    app.post('/api/config/:guildId/import', async (req, res) => {
        try {
            const entrante = (req.body && (req.body.config || req.body)) || {};
            if (typeof entrante !== 'object' || Array.isArray(entrante)) return res.status(400).json({ error: 'Formato no válido' });
            const cambios = { ...entrante };
            for (const k of CAMPOS_NO_BACKUP) delete cambios[k];
            // mensajeId de la verificación no debe importarse (es de otro servidor).
            if (cambios.verificacion) delete cambios.verificacion.mensajeId;
            const config = await ServidorConfig.findOneAndUpdate(
                { guildId: req.params.guildId },
                { $set: cambios },
                { returnDocument: 'after', upsert: true },
            );
            res.json({ success: true, config });
        } catch (error) {
            console.error('Error al importar config:', error);
            res.status(500).json({ error: 'No se pudo importar (¿JSON válido?)' });
        }
    });

    // ===================== PRODUCTIVIDAD =====================

    // --- Auto-respuestas / triggers ---
    const TIPOS_AR = ['contiene', 'exacto', 'empieza'];
    app.put('/api/config/:guildId/autorespuestas', async (req, res) => {
        try {
            const arr = Array.isArray(req.body.autoRespuestas) ? req.body.autoRespuestas : [];
            const cfgAR = await ServidorConfig.findOne({ guildId: req.params.guildId });
            const topeAR = limite(cfgAR, 'autoRespuestas');
            if (arr.length > topeAR) {
                return res.status(402).json({ error: `El plan Free permite ${topeAR} auto-respuestas. Sube a Pro para tener ilimitadas.` });
            }
            const limpio = arr.slice(0, 100).map((a) => ({
                activo: a && a.activo !== false,
                nombre: String((a && a.nombre) || '').slice(0, 80),
                patron: String((a && a.patron) || '').slice(0, 200),
                tipo: TIPOS_AR.includes(a && a.tipo) ? a.tipo : 'contiene',
                respuesta: String((a && a.respuesta) || '').slice(0, 2000),
                comoEmbed: !!(a && a.comoEmbed),
                eliminarMensaje: !!(a && a.eliminarMensaje),
            })).filter((a) => a.patron && a.respuesta);
            const config = await ServidorConfig.findOneAndUpdate(
                { guildId: req.params.guildId },
                { $set: { autoRespuestas: limpio } },
                { returnDocument: 'after', upsert: true },
            );
            res.json({ success: true, config });
        } catch (error) {
            console.error('Error al guardar auto-respuestas:', error);
            res.status(500).json({ error: 'No se pudo guardar' });
        }
    });

    // --- Constructor de embeds: enviar un embed/anuncio AHORA a un canal ---
    app.post('/api/embed/:guildId/enviar', async (req, res) => {
        try {
            const guild = client.guilds.cache.get(req.params.guildId);
            if (!guild) return res.status(404).json({ error: 'Servidor no encontrado' });
            const canal = guild.channels.cache.get(String(req.body.canalId || ''));
            if (!canal || !canal.isTextBased()) return res.status(400).json({ error: 'Canal no válido' });
            const cfg = await ServidorConfig.findOne({ guildId: req.params.guildId }).lean().catch(() => null);
            const payload = construirMensaje(req.body.contenido, sanearEmbed(req.body.embed), uploadsDir, cfg);
            if (!payload.content && !payload.embeds) return res.status(400).json({ error: 'El mensaje está vacío' });
            const msg = await canal.send(payload);
            res.json({ success: true, mensajeId: msg.id });
        } catch (error) {
            console.error('Error al enviar embed:', error);
            res.status(400).json({ error: error.message || 'No se pudo enviar' });
        }
    });

    // --- Anuncios programados (CRUD) ---
    app.get('/api/anuncios', async (req, res) => {
        try {
            const { guildId } = req.query;
            const filtro = {};
            if (guildId) filtro.guildId = guildId;
            else if (req.staff && !req.staff.owner) filtro.guildId = { $in: req.staff.guilds || [] };
            res.json(await AnuncioProgramado.find(filtro).sort({ fechaEnvio: 1 }).limit(200));
        } catch (error) {
            console.error('Error al listar anuncios:', error);
            res.status(500).json({ error: 'Fallo interno' });
        }
    });

    app.post('/api/anuncios', async (req, res) => {
        try {
            const b = req.body || {};
            const guildId = String(b.guildId || '');
            if (!guildId) return res.status(400).json({ error: 'Falta el servidor' });
            const guild = client.guilds.cache.get(guildId);
            if (!guild) return res.status(404).json({ error: 'Servidor no encontrado' });
            const canalId = String(b.canalId || '');
            if (!guild.channels.cache.get(canalId)) return res.status(400).json({ error: 'Canal no válido' });
            const cfgAnuncio = await ServidorConfig.findOne({ guildId });
            const topeAnuncio = limite(cfgAnuncio, 'anunciosProgramados');
            if (await AnuncioProgramado.countDocuments({ guildId, enviado: false }) >= topeAnuncio) {
                return res.status(402).json({ error: `El plan Free permite ${topeAnuncio} anuncios programados. Sube a Pro para tener ilimitados.` });
            }
            const fecha = new Date(b.fechaEnvio);
            if (isNaN(fecha.getTime()) || fecha.getTime() < Date.now() - 60000) {
                return res.status(400).json({ error: 'La fecha debe ser futura' });
            }
            const embedSan = sanearEmbed(b.embed);
            const tieneEmbed = embedTieneContenido(embedSan);
            const contenido = String(b.contenido || '').slice(0, 2000);
            if (!tieneEmbed && !contenido) return res.status(400).json({ error: 'El anuncio está vacío' });
            const doc = await AnuncioProgramado.create({
                guildId,
                canalId,
                contenido,
                embed: tieneEmbed ? embedSan : null,
                fechaEnvio: fecha,
                repetir: ['no', 'diario', 'semanal', 'mensual'].includes(b.repetir) ? b.repetir : 'no',
                creadoPor: (req.staff && req.staff.username) || 'Panel Web',
            });
            res.json({ success: true, anuncio: doc });
        } catch (error) {
            console.error('Error al crear anuncio:', error);
            res.status(400).json({ error: error.message || 'No se pudo crear' });
        }
    });

    app.delete('/api/anuncios/:id', async (req, res) => {
        try {
            const doc = await AnuncioProgramado.findById(req.params.id);
            if (!doc) return res.status(404).json({ error: 'No encontrado' });
            if (req.staff && !req.staff.owner && !(req.staff.guilds || []).includes(doc.guildId)) {
                return res.status(403).json({ error: 'Sin permiso para este servidor' });
            }
            await doc.deleteOne();
            res.json({ success: true });
        } catch (error) {
            console.error('Error al borrar anuncio:', error);
            res.status(500).json({ error: 'Fallo interno' });
        }
    });

    // --- Presets de anuncio (mensajes guardados: texto y/o embed) ---
    app.get('/api/anuncios/presets', async (req, res) => {
        try {
            const { guildId } = req.query;
            const filtro = {};
            if (guildId) filtro.guildId = guildId;
            else if (req.staff && !req.staff.owner) filtro.guildId = { $in: req.staff.guilds || [] };
            res.json(await AnuncioPreset.find(filtro).sort({ creadoFecha: -1 }).limit(100));
        } catch (error) {
            console.error('Error al listar presets de anuncio:', error);
            res.status(500).json({ error: 'Fallo interno' });
        }
    });

    app.post('/api/anuncios/presets', async (req, res) => {
        try {
            const b = req.body || {};
            const guildId = String(b.guildId || '');
            if (!guildId) return res.status(400).json({ error: 'Falta el servidor' });
            const nombre = String(b.nombre || '').trim().slice(0, 80);
            if (!nombre) return res.status(400).json({ error: 'Pon un nombre al preset' });
            const embedSan = sanearEmbed(b.embed);
            const tieneEmbed = embedTieneContenido(embedSan);
            const contenido = String(b.contenido || '').slice(0, 2000);
            if (!tieneEmbed && !contenido) return res.status(400).json({ error: 'El preset está vacío' });
            const doc = await AnuncioPreset.create({ guildId, nombre, contenido, embed: tieneEmbed ? embedSan : null });
            res.json({ success: true, preset: doc });
        } catch (error) {
            console.error('Error al guardar preset de anuncio:', error);
            res.status(400).json({ error: error.message || 'No se pudo guardar' });
        }
    });

    app.delete('/api/anuncios/presets/:id', async (req, res) => {
        try {
            const doc = await AnuncioPreset.findById(req.params.id);
            if (!doc) return res.status(404).json({ error: 'No encontrado' });
            if (req.staff && !req.staff.owner && !(req.staff.guilds || []).includes(doc.guildId)) {
                return res.status(403).json({ error: 'Sin permiso para este servidor' });
            }
            await doc.deleteOne();
            res.json({ success: true });
        } catch (error) {
            console.error('Error al borrar preset de anuncio:', error);
            res.status(500).json({ error: 'Fallo interno' });
        }
    });

    // --- DIFUSIÓN: enviar a un servidor concreto o a TODOS (solo BROADCAST_IDS) ---
    // Elige un canal de texto donde el bot pueda escribir (preferido: el del sistema).
    function canalDifusion(guild) {
        const yo = guild.members.me;
        const puede = (c) => c && c.isTextBased() && c.viewable && yo && c.permissionsFor(yo)?.has(PermissionsBitField.Flags.SendMessages);
        if (guild.systemChannel && puede(guild.systemChannel)) return guild.systemChannel;
        return guild.channels.cache
            .filter((c) => c.type === ChannelType.GuildText && puede(c))
            .sort((a, b) => a.position - b.position)
            .first() || null;
    }

    app.get('/api/broadcast/permitido', (req, res) => {
        res.json({ permitido: !!(req.staff && req.staff.broadcaster), servidores: client.guilds.cache.size });
    });

    app.post('/api/broadcast/enviar', async (req, res) => {
        try {
            if (!req.staff || !req.staff.broadcaster) return res.status(403).json({ error: 'No autorizado' });
            const b = req.body || {};
            // Validamos que haya algo que enviar (se reconstruye por servidor para no reutilizar adjuntos).
            const prueba = construirMensaje(b.contenido, sanearEmbed(b.embed), uploadsDir);
            if (!prueba.content && !prueba.embeds) return res.status(400).json({ error: 'El mensaje está vacío' });

            if (b.alcance === 'todos') {
                let enviados = 0;
                const fallos = [];
                for (const guild of client.guilds.cache.values()) {
                    const canal = canalDifusion(guild);
                    if (!canal) { fallos.push(guild.name); continue; }
                    try {
                        await canal.send(construirMensaje(b.contenido, sanearEmbed(b.embed), uploadsDir));
                        enviados++;
                    } catch { fallos.push(guild.name); }
                }
                return res.json({ success: true, enviados, total: client.guilds.cache.size, fallos });
            }

            // Alcance: un servidor concreto.
            const guild = client.guilds.cache.get(String(b.guildId || ''));
            if (!guild) return res.status(404).json({ error: 'Servidor no encontrado' });
            const canal = guild.channels.cache.get(String(b.canalId || ''));
            if (!canal || !canal.isTextBased()) return res.status(400).json({ error: 'Canal no válido' });
            await canal.send(construirMensaje(b.contenido, sanearEmbed(b.embed), uploadsDir));
            res.json({ success: true, enviados: 1, total: 1, fallos: [] });
        } catch (error) {
            console.error('Error en difusión:', error);
            res.status(400).json({ error: error.message || 'No se pudo difundir' });
        }
    });

    // --- ACCESO Y PERMISOS: roles que entran al panel + roles de moderación ---
    app.put('/api/config/:guildId/acceso', async (req, res) => {
        try {
            const cambios = {};
            if (Array.isArray(req.body.rolesPanelAcceso)) cambios.rolesPanelAcceso = req.body.rolesPanelAcceso.filter(Boolean);
            if (Array.isArray(req.body.rolesModeracion)) cambios.rolesModeracion = req.body.rolesModeracion.filter(Boolean);
            if (req.body.accesoAreas && typeof req.body.accesoAreas === 'object') {
                ['cuenta', 'datos', 'entrada', 'musica', 'tickets', 'roles', 'moderacion', 'logs', 'mensajes', 'config'].forEach((a) => {
                    if (Array.isArray(req.body.accesoAreas[a])) cambios[`accesoAreas.${a}`] = req.body.accesoAreas[a].filter(Boolean);
                });
            }
            const config = await ServidorConfig.findOneAndUpdate(
                { guildId: req.params.guildId },
                { $set: cambios },
                { returnDocument: 'after', upsert: true },
            );
            res.json({ success: true, config });
        } catch (error) {
            console.error('Error al guardar acceso y permisos:', error);
            res.status(500).json({ error: 'No se pudo guardar' });
        }
    });

    // --- Webhooks salientes (Pro): guardar configuración ---
    app.put('/api/config/:guildId/webhooks', async (req, res) => {
        try {
            const b = req.body || {};
            const ev = b.eventos || {};
            const cambios = {
                'webhooksSalientes.activo': !!b.activo,
                'webhooksSalientes.url': typeof b.url === 'string' ? b.url.trim().slice(0, 500) : '',
                'webhooksSalientes.secret': typeof b.secret === 'string' ? b.secret.trim().slice(0, 200) : '',
                'webhooksSalientes.eventos.ticketNuevo': ev.ticketNuevo !== false,
                'webhooksSalientes.eventos.sancion': ev.sancion !== false,
                'webhooksSalientes.eventos.raid': ev.raid !== false,
            };
            const config = await ServidorConfig.findOneAndUpdate(
                { guildId: req.params.guildId },
                { $set: cambios },
                { returnDocument: 'after', upsert: true },
            );
            res.json({ success: true, config });
        } catch (error) {
            console.error('Error al guardar webhooks:', error);
            res.status(500).json({ error: 'No se pudo guardar' });
        }
    });

    // --- Webhooks salientes: enviar una prueba a la URL indicada ---
    app.post('/api/config/:guildId/webhooks/test', async (req, res) => {
        try {
            const url = String(req.body.url || '').trim();
            const secret = String(req.body.secret || '').trim();
            if (!/^https:\/\//i.test(url)) return res.status(400).json({ error: 'La URL debe empezar por https://' });
            const headers = { 'Content-Type': 'application/json' };
            if (secret) headers['X-Sokyo-Secret'] = secret;
            const payload = {
                event: 'test', guildId: req.params.guildId,
                text: '✅ Webhook de prueba de Sokyo', content: '✅ Webhook de prueba de Sokyo',
                data: { prueba: true }, timestamp: new Date().toISOString(),
            };
            const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(5000) });
            res.json({ success: r.ok, status: r.status });
        } catch (e) {
            res.json({ success: false, error: e.message });
        }
    });

    // --- SISTEMA DE ROLES: guardar autorol al entrar (personas / bots) ---
    app.put('/api/config/:guildId/autoroles', async (req, res) => {
        try {
            const { guildId } = req.params;
            const { autoRoles, autoRolesBots } = req.body;
            const cambios = {};
            if (Array.isArray(autoRoles)) cambios.autoRoles = autoRoles.filter(Boolean);
            if (Array.isArray(autoRolesBots)) cambios.autoRolesBots = autoRolesBots.filter(Boolean);

            const configActualizada = await ServidorConfig.findOneAndUpdate(
                { guildId },
                { $set: cambios },
                { returnDocument: 'after', upsert: true }
            );
            res.json({ success: true, config: configActualizada });
        } catch (error) {
            console.error('Error al actualizar autoroles:', error);
            res.status(500).json({ error: 'Fallo interno al actualizar los autoroles' });
        }
    });

    // ===================== GESTIÓN DE ROLES (panel mejorado) =====================

    // Catálogo curado de permisos: solo los más útiles, agrupados para el panel.
    // La clave es el flag real de Discord (PermissionsBitField.Flags).
    const PERMISOS_CATALOGO = [
        { grupo: 'General', permisos: ['Administrator', 'ViewChannel', 'ManageGuild'] },
        { grupo: 'Texto', permisos: ['SendMessages', 'ManageMessages', 'MentionEveryone'] },
        { grupo: 'Voz', permisos: ['Connect', 'Speak', 'MoveMembers'] },
        { grupo: 'Moderación', permisos: ['KickMembers', 'BanMembers', 'ModerateMembers'] },
    ];

    // Resuelve el guild a partir de ?guildId=. Si no se indica: un staff (no dueño)
    // cae a SU primer servidor (nunca al de otro); el dueño/API key, al primero de la BD.
    async function resolverGuild(guildId, staff) {
        let gid = guildId;
        if (!gid) {
            if (staff && !staff.owner) {
                gid = (staff.guilds || [])[0] || null;
            } else {
                const config = await ServidorConfig.findOne();
                gid = config && config.guildId;
            }
        }
        return gid ? client.guilds.cache.get(gid) : null;
    }

    // Pasa un rol de Discord al formato que consume el frontend.
    function serializarRol(rol) {
        return {
            id: rol.id,
            nombre: rol.name,
            color: rol.hexColor,
            miembros: rol.members.size,
            posicion: rol.position,
            gestionable: rol.editable,           // ¿el bot puede tocarlo? (jerarquía)
            permisos: rol.permissions.toArray(), // lista de flags activos
        };
    }

    // Catálogo de permisos para que el panel pinte los toggles.
    app.get('/api/roles/catalogo', (req, res) => res.json(PERMISOS_CATALOGO));

    // Lista detallada de roles (con nº de miembros y permisos) para el panel.
    app.get('/api/roles', async (req, res) => {
        try {
            const guild = await resolverGuild(req.query.guildId, req.staff);
            if (!guild) return res.json([]);
            const roles = guild.roles.cache
                .filter((r) => r.name !== '@everyone' && !r.managed)
                .sort((a, b) => b.position - a.position)
                .map(serializarRol);
            res.json(roles);
        } catch (error) {
            console.error('Error al listar roles:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    });

    // Crear un rol nuevo.
    app.post('/api/roles', async (req, res) => {
        try {
            const { guildId, nombre, color, permisos } = req.body;
            const guild = await resolverGuild(guildId, req.staff);
            if (!guild) return res.status(404).json({ error: 'Servidor no encontrado' });
            if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });

            const rol = await guild.roles.create({
                name: nombre.trim(),
                color: color || '#99AAB5',
                permissions: Array.isArray(permisos) ? permisos : [],
            });
            res.json({ success: true, rol: serializarRol(rol) });
        } catch (error) {
            console.error('Error al crear rol:', error);
            res.status(500).json({ error: 'No se pudo crear el rol' });
        }
    });

    // Editar un rol (nombre / color / permisos).
    app.put('/api/roles/:roleId', async (req, res) => {
        try {
            const { guildId, nombre, color, permisos } = req.body;
            const guild = await resolverGuild(guildId, req.staff);
            if (!guild) return res.status(404).json({ error: 'Servidor no encontrado' });

            const rol = guild.roles.cache.get(req.params.roleId);
            if (!rol) return res.status(404).json({ error: 'Rol no encontrado' });
            if (!rol.editable) return res.status(403).json({ error: 'El bot no puede editar este rol (jerarquía)' });

            const cambios = {};
            if (nombre !== undefined) cambios.name = String(nombre).trim();
            if (color !== undefined) cambios.color = color;
            if (Array.isArray(permisos)) cambios.permissions = permisos;

            await rol.edit(cambios);
            res.json({ success: true, rol: serializarRol(rol) });
        } catch (error) {
            console.error('Error al editar rol:', error);
            res.status(500).json({ error: 'No se pudo editar el rol' });
        }
    });

    // Eliminar un rol.
    app.delete('/api/roles/:roleId', async (req, res) => {
        try {
            const guild = await resolverGuild(req.query.guildId, req.staff);
            if (!guild) return res.status(404).json({ error: 'Servidor no encontrado' });

            const rol = guild.roles.cache.get(req.params.roleId);
            if (!rol) return res.status(404).json({ error: 'Rol no encontrado' });
            if (!rol.editable) return res.status(403).json({ error: 'El bot no puede eliminar este rol (jerarquía)' });

            await rol.delete();
            res.json({ success: true });
        } catch (error) {
            console.error('Error al eliminar rol:', error);
            res.status(500).json({ error: 'No se pudo eliminar el rol' });
        }
    });

    // Pasa un miembro de Discord al formato que consume el frontend.
    function serializarMiembro(member) {
        return {
            id: member.id,
            username: member.user.username,
            displayName: member.displayName,
            avatar: member.user.displayAvatarURL({ size: 64 }),
        };
    }

    // Asegura la caché de miembros de un servidor pidiéndola a Discord UNA sola
    // vez (memorizada por guildId). Tras el primer fetch, discord.js mantiene la
    // caché al día con los eventos de entrada/salida, así que no volvemos a
    // tocar el gateway (evita el rate limit del opcode 8).
    const miembrosCargados = new Map(); // guildId -> Promise
    function asegurarMiembros(guild) {
        if (!miembrosCargados.has(guild.id)) {
            const p = guild.members.fetch().catch((e) => { miembrosCargados.delete(guild.id); throw e; });
            miembrosCargados.set(guild.id, p);
        }
        return miembrosCargados.get(guild.id);
    }

    // Miembros que TIENEN un rol concreto (para el desplegable del panel).
    app.get('/api/roles/:roleId/miembros', async (req, res) => {
        try {
            const guild = await resolverGuild(req.query.guildId, req.staff);
            if (!guild) return res.json([]);
            const rol = guild.roles.cache.get(req.params.roleId);
            if (!rol) return res.status(404).json({ error: 'Rol no encontrado' });

            await asegurarMiembros(guild);
            const miembros = rol.members.map(serializarMiembro);
            res.json(miembros);
        } catch (error) {
            console.error('Error al listar miembros del rol:', error);
            res.status(500).json({ error: 'No se pudieron obtener los miembros' });
        }
    });

    // Buscador de miembros del servidor (para elegir a quién asignar el rol).
    // Filtra sobre la caché local (no pega al gateway en cada pulsación).
    app.get('/api/servidor/miembros', async (req, res) => {
        try {
            const guild = await resolverGuild(req.query.guildId, req.staff);
            if (!guild) return res.json([]);
            await asegurarMiembros(guild);

            const q = (req.query.q || '').toString().trim().toLowerCase();
            const coincide = (m) =>
                !q || m.user.username.toLowerCase().includes(q) || m.displayName.toLowerCase().includes(q);

            const miembros = guild.members.cache
                .filter((m) => !m.user.bot && coincide(m))
                .first(10)
                .map(serializarMiembro);
            res.json(miembros);
        } catch (error) {
            console.error('Error al buscar miembros:', error);
            res.status(500).json({ error: 'No se pudieron buscar los miembros' });
        }
    });

    // Asignar un rol a un miembro.
    app.post('/api/roles/:roleId/miembros', async (req, res) => {
        try {
            const { guildId, userId } = req.body;
            const guild = await resolverGuild(guildId, req.staff);
            if (!guild) return res.status(404).json({ error: 'Servidor no encontrado' });
            const rol = guild.roles.cache.get(req.params.roleId);
            if (!rol) return res.status(404).json({ error: 'Rol no encontrado' });
            if (!rol.editable) return res.status(403).json({ error: 'El bot no puede asignar este rol (jerarquía)' });

            const member = await guild.members.fetch(userId);
            await member.roles.add(rol);
            res.json({ success: true, miembro: serializarMiembro(member) });
        } catch (error) {
            console.error('Error al asignar rol:', error);
            res.status(500).json({ error: 'No se pudo asignar el rol' });
        }
    });

    // Quitar un rol a un miembro.
    app.delete('/api/roles/:roleId/miembros/:userId', async (req, res) => {
        try {
            const guild = await resolverGuild(req.query.guildId, req.staff);
            if (!guild) return res.status(404).json({ error: 'Servidor no encontrado' });
            const rol = guild.roles.cache.get(req.params.roleId);
            if (!rol) return res.status(404).json({ error: 'Rol no encontrado' });
            if (!rol.editable) return res.status(403).json({ error: 'El bot no puede quitar este rol (jerarquía)' });

            const member = await guild.members.fetch(req.params.userId);
            await member.roles.remove(rol);
            res.json({ success: true });
        } catch (error) {
            console.error('Error al quitar rol:', error);
            res.status(500).json({ error: 'No se pudo quitar el rol' });
        }
    });

    // ===================== PANELES DE AUTOASIGNACIÓN DE ROLES =====================

    // Saneamos el cuerpo de un panel que llega del frontend (campos permitidos).
    function limpiarPanel(body) {
        const out = {};
        if (body.tipo !== undefined) out.tipo = ['boton', 'menu', 'reaccion', 'verificacion'].includes(body.tipo) ? body.tipo : 'boton';
        if (body.titulo !== undefined) out.titulo = String(body.titulo).slice(0, 256);
        if (body.descripcion !== undefined) out.descripcion = String(body.descripcion).slice(0, 2000);
        if (body.color !== undefined) out.color = body.color;
        if (body.imagen !== undefined) out.imagen = (body.imagen && /^https?:\/\//i.test(body.imagen)) ? String(body.imagen).slice(0, 500) : null;
        if (body.imagenArchivo !== undefined) out.imagenArchivo = body.imagenArchivo ? String(body.imagenArchivo).slice(0, 200) : null;
        if (body.channelId !== undefined) out.channelId = body.channelId || null;
        if (body.exclusivo !== undefined) out.exclusivo = !!body.exclusivo;
        if (body.maxRoles !== undefined) out.maxRoles = Math.max(0, parseInt(body.maxRoles, 10) || 0);
        if (body.permitirQuitar !== undefined) out.permitirQuitar = !!body.permitirQuitar;
        if (Array.isArray(body.items)) {
            const vistos = new Set();
            out.items = body.items
                .filter((it) => it && it.roleId)
                .filter((it) => { if (vistos.has(it.roleId)) return false; vistos.add(it.roleId); return true; }) // sin roles repetidos
                .slice(0, 25)
                .map((it) => ({
                    roleId: String(it.roleId),
                    emoji: it.emoji ? String(it.emoji).slice(0, 64) : null,
                    label: it.label ? String(it.label).slice(0, 80) : null,
                    descripcion: it.descripcion ? String(it.descripcion).slice(0, 100) : null,
                    duracionMin: Math.max(0, parseInt(it.duracionMin, 10) || 0),
                    estilo: ['primary', 'secondary', 'success', 'danger'].includes(it.estilo) ? it.estilo : 'secondary',
                }));
        }
        return out;
    }

    // Subir una imagen/gif para un panel (llega como dataURL base64). Se guarda
    // en /uploads y se devuelve el nombre del archivo + su URL para previsualizar.
    app.post('/api/paneles/upload', (req, res) => {
        try {
            const { datos } = req.body;
            const m = /^data:(image\/(png|jpe?g|gif|webp));base64,(.+)$/i.exec(datos || '');
            if (!m) return res.status(400).json({ error: 'Formato no válido (solo png, jpg, gif o webp)' });
            const ext = m[2].toLowerCase() === 'jpeg' ? 'jpg' : m[2].toLowerCase();
            const buffer = Buffer.from(m[3], 'base64');
            if (buffer.length > 8 * 1024 * 1024) return res.status(400).json({ error: 'La imagen supera el máximo de 8 MB' });
            const archivo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
            fs.writeFileSync(path.join(uploadsDir, archivo), buffer);
            res.json({ success: true, archivo, url: `/uploads/${archivo}` });
        } catch (error) {
            console.error('Error al subir imagen del panel:', error);
            res.status(500).json({ error: 'No se pudo subir la imagen' });
        }
    });

    // Lista de paneles del servidor.
    app.get('/api/paneles', async (req, res) => {
        try {
            const { guildId } = req.query;
            const filtro = guildId ? { guildId } : (req.staff && !req.staff.owner ? { guildId: { $in: req.staff.guilds || [] } } : {});
            res.json(await RolePanel.find(filtro).sort({ createdAt: -1 }));
        } catch (error) {
            console.error('Error al listar paneles:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    });

    // Crear un panel (y publicarlo si trae canal).
    app.post('/api/paneles', async (req, res) => {
        try {
            const { guildId } = req.body;
            if (!guildId) return res.status(400).json({ error: 'Falta el servidor' });
            const cfgPanel = await ServidorConfig.findOne({ guildId });
            const topePanel = limite(cfgPanel, 'panelesRoles');
            if (await RolePanel.countDocuments({ guildId }) >= topePanel) {
                return res.status(402).json({ error: `El plan Free permite ${topePanel} panel(es) de roles. Sube a Pro para tener paneles ilimitados.` });
            }
            const panel = await RolePanel.create({ guildId, ...limpiarPanel(req.body) });
            if (panel.channelId) {
                try { await publicarPanel(client, panel); }
                catch (e) { return res.json({ success: true, panel, aviso: `Panel guardado pero no se pudo publicar: ${e.message}` }); }
            }
            res.json({ success: true, panel });
        } catch (error) {
            console.error('Error al crear panel:', error);
            res.status(500).json({ error: 'No se pudo crear el panel' });
        }
    });

    // Editar un panel (y republicarlo).
    app.put('/api/paneles/:id', scopePanel, async (req, res) => {
        try {
            const panel = await RolePanel.findByIdAndUpdate(req.params.id, { $set: limpiarPanel(req.body) }, { new: true });
            if (!panel) return res.status(404).json({ error: 'Panel no encontrado' });
            if (panel.channelId) {
                try { await publicarPanel(client, panel); }
                catch (e) { return res.json({ success: true, panel, aviso: `Guardado pero no se pudo publicar: ${e.message}` }); }
            }
            res.json({ success: true, panel });
        } catch (error) {
            console.error('Error al editar panel:', error);
            res.status(500).json({ error: 'No se pudo editar el panel' });
        }
    });

    // Publicar / republicar manualmente.
    app.post('/api/paneles/:id/publicar', scopePanel, async (req, res) => {
        try {
            const panel = await RolePanel.findById(req.params.id);
            if (!panel) return res.status(404).json({ error: 'Panel no encontrado' });
            if (req.body.channelId) { panel.channelId = req.body.channelId; await panel.save(); }
            if (!panel.channelId) return res.status(400).json({ error: 'Elige un canal donde publicar' });
            await publicarPanel(client, panel);
            res.json({ success: true, panel });
        } catch (error) {
            console.error('Error al publicar panel:', error);
            res.status(500).json({ error: `No se pudo publicar: ${error.message}` });
        }
    });

    // Eliminar un panel (intenta borrar también el mensaje publicado).
    app.delete('/api/paneles/:id', scopePanel, async (req, res) => {
        try {
            const panel = await RolePanel.findById(req.params.id);
            if (!panel) return res.status(404).json({ error: 'Panel no encontrado' });
            if (panel.channelId && panel.messageId) {
                const guild = client.guilds.cache.get(panel.guildId);
                const canal = guild && guild.channels.cache.get(panel.channelId);
                if (canal) {
                    const msg = await canal.messages.fetch(panel.messageId).catch(() => null);
                    if (msg) await msg.delete().catch(() => {});
                }
            }
            await panel.deleteOne();
            res.json({ success: true });
        } catch (error) {
            console.error('Error al eliminar panel:', error);
            res.status(500).json({ error: 'No se pudo eliminar el panel' });
        }
    });

    // Emojis personalizados del servidor (para el selector de emojis del panel).
    app.get('/api/servidor/emojis', async (req, res) => {
        try {
            const guild = await resolverGuild(req.query.guildId, req.staff);
            if (!guild) return res.json([]);
            const emojis = guild.emojis.cache.map((e) => ({
                id: e.id,
                nombre: e.name,
                animado: e.animated,
                // Código que se inserta en el mensaje y que el bot sabe interpretar.
                codigo: `<${e.animated ? 'a' : ''}:${e.name}:${e.id}>`,
                url: e.imageURL({ size: 64 }),
            }));
            res.json(emojis);
        } catch (error) {
            console.error('Error al obtener emojis:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    });

    // Helper: dataURL base64 -> { buffer, mime }.
    function dataUrlABuffer(datos) {
        const m = /^data:(.+?);base64,(.+)$/.exec(datos || '');
        if (!m) return null;
        return { mime: m[1], buffer: Buffer.from(m[2], 'base64') };
    }
    // Nombre válido de emoji/sticker: 2–32, letras/números/guion bajo.
    const limpiarNombre = (n) => String(n || '').trim().replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32);

    // Crear un emoji (imagen en dataURL).
    app.post('/api/servidor/emojis', async (req, res) => {
        try {
            const guild = await resolverGuild(req.body.guildId, req.staff);
            if (!guild) return res.status(404).json({ error: 'Servidor no encontrado' });
            const nombre = limpiarNombre(req.body.nombre);
            if (nombre.length < 2) return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres' });
            const datos = dataUrlABuffer(req.body.datos);
            if (!datos || !/image\/(png|jpe?g|gif)/i.test(datos.mime)) return res.status(400).json({ error: 'Formato no válido (png, jpg o gif)' });
            if (datos.buffer.length > 256 * 1024) return res.status(400).json({ error: 'El emoji supera 256 KB' });

            const emoji = await guild.emojis.create({ attachment: datos.buffer, name: nombre });
            res.json({ success: true, emoji: { id: emoji.id, nombre: emoji.name, animado: emoji.animated, codigo: `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`, url: emoji.imageURL({ size: 64 }) } });
        } catch (error) {
            console.error('Error al crear emoji:', error);
            res.status(400).json({ error: error.message || 'No se pudo crear el emoji' });
        }
    });

    // Eliminar un emoji.
    app.delete('/api/servidor/emojis/:emojiId', async (req, res) => {
        try {
            const guild = await resolverGuild(req.query.guildId, req.staff);
            if (!guild) return res.status(404).json({ error: 'Servidor no encontrado' });
            await guild.emojis.delete(req.params.emojiId);
            res.json({ success: true });
        } catch (error) {
            console.error('Error al eliminar emoji:', error);
            res.status(400).json({ error: error.message || 'No se pudo eliminar' });
        }
    });

    // Listar stickers del servidor.
    app.get('/api/servidor/stickers', async (req, res) => {
        try {
            const guild = await resolverGuild(req.query.guildId, req.staff);
            if (!guild) return res.json([]);
            await guild.stickers.fetch().catch(() => {});
            const stickers = guild.stickers.cache.map((s) => ({ id: s.id, nombre: s.name, descripcion: s.description, tags: s.tags, url: s.url }));
            res.json(stickers);
        } catch (error) {
            console.error('Error al obtener stickers:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    });

    // Crear un sticker (imagen PNG/APNG en dataURL).
    app.post('/api/servidor/stickers', async (req, res) => {
        try {
            const guild = await resolverGuild(req.body.guildId, req.staff);
            if (!guild) return res.status(404).json({ error: 'Servidor no encontrado' });
            const nombre = limpiarNombre(req.body.nombre);
            if (nombre.length < 2) return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres' });
            const datos = dataUrlABuffer(req.body.datos);
            if (!datos || !/image\/png/i.test(datos.mime)) return res.status(400).json({ error: 'El sticker debe ser PNG o APNG' });
            if (datos.buffer.length > 512 * 1024) return res.status(400).json({ error: 'El sticker supera 512 KB' });

            const file = new AttachmentBuilder(datos.buffer, { name: 'sticker.png' });
            const sticker = await guild.stickers.create({ file, name: nombre, tags: req.body.tags || nombre, description: req.body.descripcion || undefined });
            res.json({ success: true, sticker: { id: sticker.id, nombre: sticker.name, descripcion: sticker.description, tags: sticker.tags, url: sticker.url } });
        } catch (error) {
            console.error('Error al crear sticker:', error);
            res.status(400).json({ error: error.message || 'No se pudo crear el sticker' });
        }
    });

    // Eliminar un sticker.
    app.delete('/api/servidor/stickers/:stickerId', async (req, res) => {
        try {
            const guild = await resolverGuild(req.query.guildId, req.staff);
            if (!guild) return res.status(404).json({ error: 'Servidor no encontrado' });
            await guild.stickers.delete(req.params.stickerId);
            res.json({ success: true });
        } catch (error) {
            console.error('Error al eliminar sticker:', error);
            res.status(400).json({ error: error.message || 'No se pudo eliminar' });
        }
    });

    // Canales de texto del servidor (para elegir dónde publicar el panel).
    app.get('/api/servidor/canales', async (req, res) => {
        try {
            const guild = await resolverGuild(req.query.guildId, req.staff);
            if (!guild) return res.json([]);
            const canales = guild.channels.cache
                .filter((c) => c.type === ChannelType.GuildText)
                .sort((a, b) => a.position - b.position)
                .map((c) => ({ id: c.id, nombre: c.name }));
            res.json(canales);
        } catch (error) {
            console.error('Error al obtener canales:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    });

    // ===================== MODERACIÓN (Centro de Mando) =====================

    // Moderador que ejecuta la acción (sesión de staff) o null (API key del dueño).
    const moderadorDe = (req) => (req.staff ? { id: req.staff.id, tag: req.staff.username } : null);

    // --- Tipos de sanción (plantillas) ---
    app.get('/api/sanciones/tipos', exigeModerador, async (req, res) => {
        try {
            const { guildId } = req.query;
            const filtro = guildId ? { guildId } : (req.staff && !req.staff.owner ? { guildId: { $in: req.staff.guilds || [] } } : {});
            res.json(await TipoSancion.find(filtro).sort({ orden: 1, createdAt: 1 }));
        } catch (error) {
            console.error('Error al listar tipos de sanción:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    });

    function limpiarTipo(body) {
        const out = {};
        if (body.nombre !== undefined) out.nombre = String(body.nombre).slice(0, 80);
        if (body.accion !== undefined) out.accion = ['aviso', 'timeout', 'expulsion', 'ban'].includes(body.accion) ? body.accion : 'aviso';
        if (body.duracionMin !== undefined) out.duracionMin = Math.max(0, parseInt(body.duracionMin, 10) || 0);
        if (body.borrarMensajesHoras !== undefined) out.borrarMensajesHoras = Math.min(168, Math.max(0, parseInt(body.borrarMensajesHoras, 10) || 0));
        if (body.color !== undefined) out.color = body.color;
        if (body.emoji !== undefined) out.emoji = body.emoji ? String(body.emoji).slice(0, 64) : null;
        if (body.descripcion !== undefined) out.descripcion = body.descripcion ? String(body.descripcion).slice(0, 200) : null;
        if (body.orden !== undefined) out.orden = parseInt(body.orden, 10) || 0;
        return out;
    }

    app.post('/api/sanciones/tipos', exigeModerador, async (req, res) => {
        try {
            const { guildId } = req.body;
            if (!guildId) return res.status(400).json({ error: 'Falta el servidor' });
            const tipo = await TipoSancion.create({ guildId, ...limpiarTipo(req.body) });
            res.json({ success: true, tipo });
        } catch (error) {
            console.error('Error al crear tipo de sanción:', error);
            res.status(500).json({ error: 'No se pudo crear el tipo' });
        }
    });

    app.put('/api/sanciones/tipos/:id', scopeModRecurso(TipoSancion, 'tipo'), async (req, res) => {
        try {
            const tipo = await TipoSancion.findByIdAndUpdate(req.params.id, { $set: limpiarTipo(req.body) }, { new: true });
            if (!tipo) return res.status(404).json({ error: 'Tipo no encontrado' });
            res.json({ success: true, tipo });
        } catch (error) {
            console.error('Error al editar tipo de sanción:', error);
            res.status(500).json({ error: 'No se pudo editar el tipo' });
        }
    });

    app.delete('/api/sanciones/tipos/:id', scopeModRecurso(TipoSancion, 'tipo'), async (req, res) => {
        try {
            await TipoSancion.findByIdAndDelete(req.params.id);
            res.json({ success: true });
        } catch (error) {
            console.error('Error al eliminar tipo de sanción:', error);
            res.status(500).json({ error: 'No se pudo eliminar el tipo' });
        }
    });

    // --- Aplicar una sanción a un usuario ---
    app.post('/api/sanciones/aplicar', async (req, res) => {
        try {
            const { guildId, usuarioId, tipoId, accion, duracionMin, borrarMensajesHoras, motivo, pruebas } = req.body;
            if (!guildId || !usuarioId) return res.status(400).json({ error: 'Faltan datos (servidor o usuario)' });

            // Por tipo guardado (tipoId) o acción rápida sin tipo (accion suelta).
            let tipo;
            if (tipoId) {
                tipo = await TipoSancion.findById(tipoId);
                if (!tipo || tipo.guildId !== guildId) return res.status(404).json({ error: 'Tipo de sanción no válido' });
            } else if (['aviso', 'timeout', 'expulsion', 'ban'].includes(accion)) {
                tipo = {
                    nombre: null,
                    accion,
                    duracionMin: Math.max(0, parseInt(duracionMin, 10) || 0),
                    borrarMensajesHoras: Math.min(168, Math.max(0, parseInt(borrarMensajesHoras, 10) || 0)),
                };
            } else {
                return res.status(400).json({ error: 'Indica un tipo de sanción o una acción' });
            }

            // Permiso ESPECÍFICO según la acción: nativo de Discord o rol de moderación configurado.
            if (req.staff && !req.staff.owner) {
                const guild = client.guilds.cache.get(guildId);
                const member = guild ? await guild.members.fetch(req.staff.id).catch(() => null) : null;
                const P = PermissionsBitField.Flags;
                const requerido = { timeout: P.ModerateMembers, expulsion: P.KickMembers, ban: P.BanMembers, aviso: P.ModerateMembers }[tipo.accion];
                const cfgMod = await ServidorConfig.findOne({ guildId });
                const tieneRolMod = (cfgMod?.rolesModeracion || []).some((id) => member?.roles.cache.has(id));
                const ok = member && (member.permissions.has(P.Administrator) || member.permissions.has(requerido) || tieneRolMod);
                if (!ok) return res.status(403).json({ error: 'No tienes permiso para esta acción' });
            }

            const sancion = await aplicarSancion(client, {
                guildId, usuarioId, tipo, motivo: motivo || '',
                pruebas: Array.isArray(pruebas) ? pruebas : [],
                moderador: moderadorDe(req),
            });
            res.json({ success: true, sancion });
        } catch (error) {
            console.error('Error al aplicar sanción:', error);
            res.status(400).json({ error: error.message || 'No se pudo aplicar la sanción' });
        }
    });

    // --- Sanción MASIVA: misma acción a varios usuarios (limpieza de raids) ---
    app.post('/api/sanciones/aplicar-masiva', async (req, res) => {
        try {
            const { guildId, usuarioIds, tipoId, accion, duracionMin, borrarMensajesHoras, motivo } = req.body;
            if (!guildId || !Array.isArray(usuarioIds) || usuarioIds.length === 0) {
                return res.status(400).json({ error: 'Faltan datos (servidor o usuarios)' });
            }
            // Normaliza, deduplica y limita a 50 por llamada (seguridad / rate de Discord).
            const ids = [...new Set(usuarioIds.map((s) => String(s).trim()).filter(Boolean))].slice(0, 50);
            if (!ids.length) return res.status(400).json({ error: 'No hay IDs de usuario válidos' });

            // Tipo guardado (tipoId) o acción rápida (accion suelta) — igual que en /aplicar.
            let tipo;
            if (tipoId) {
                tipo = await TipoSancion.findById(tipoId);
                if (!tipo || tipo.guildId !== guildId) return res.status(404).json({ error: 'Tipo de sanción no válido' });
            } else if (['aviso', 'timeout', 'expulsion', 'ban'].includes(accion)) {
                tipo = {
                    nombre: null,
                    accion,
                    duracionMin: Math.max(0, parseInt(duracionMin, 10) || 0),
                    borrarMensajesHoras: Math.min(168, Math.max(0, parseInt(borrarMensajesHoras, 10) || 0)),
                };
            } else {
                return res.status(400).json({ error: 'Indica un tipo de sanción o una acción' });
            }

            // Mismo control de permisos por acción que en /aplicar.
            if (req.staff && !req.staff.owner) {
                const guild = client.guilds.cache.get(guildId);
                const member = guild ? await guild.members.fetch(req.staff.id).catch(() => null) : null;
                const P = PermissionsBitField.Flags;
                const requerido = { timeout: P.ModerateMembers, expulsion: P.KickMembers, ban: P.BanMembers, aviso: P.ModerateMembers }[tipo.accion];
                const cfgMod = await ServidorConfig.findOne({ guildId });
                const tieneRolMod = (cfgMod?.rolesModeracion || []).some((id) => member?.roles.cache.has(id));
                const ok = member && (member.permissions.has(P.Administrator) || member.permissions.has(requerido) || tieneRolMod);
                if (!ok) return res.status(403).json({ error: 'No tienes permiso para esta acción' });
            }

            const resultado = await aplicarSancionMasiva(client, {
                guildId, usuarioIds: ids, tipo, motivo: motivo || '', moderador: moderadorDe(req),
            });
            res.json({ success: true, ...resultado });
        } catch (error) {
            console.error('Error en sanción masiva:', error);
            res.status(400).json({ error: error.message || 'No se pudo aplicar la sanción masiva' });
        }
    });

    // --- Subir una prueba (imagen) ---
    app.post('/api/sanciones/upload', (req, res) => {
        try {
            const m = /^data:(image\/(png|jpe?g|gif|webp));base64,(.+)$/i.exec(req.body?.datos || '');
            if (!m) return res.status(400).json({ error: 'Formato no válido (solo imagen)' });
            const ext = m[2].toLowerCase() === 'jpeg' ? 'jpg' : m[2].toLowerCase();
            const buffer = Buffer.from(m[3], 'base64');
            if (buffer.length > 8 * 1024 * 1024) return res.status(400).json({ error: 'La imagen supera 8 MB' });
            const archivo = `prueba-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
            fs.writeFileSync(path.join(uploadsDir, archivo), buffer);
            res.json({ success: true, archivo, url: `/uploads/${archivo}` });
        } catch (error) {
            console.error('Error al subir prueba:', error);
            res.status(500).json({ error: 'No se pudo subir la prueba' });
        }
    });

    // --- Estadísticas para el panel (tarjetas del centro de mando) ---
    app.get('/api/sanciones/stats', exigeModerador, async (req, res) => {
        try {
            const { guildId } = req.query;
            const base = guildId ? { guildId } : (req.staff && !req.staff.owner ? { guildId: { $in: req.staff.guilds || [] } } : {});
            const hace7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const [total, porAccionAgg, bansActivos, recientes7d] = await Promise.all([
                Sancion.countDocuments(base),
                Sancion.aggregate([{ $match: base }, { $group: { _id: '$accion', n: { $sum: 1 } } }]),
                Sancion.countDocuments({ ...base, accion: 'ban', activa: true }),
                Sancion.countDocuments({ ...base, fecha: { $gte: hace7d } }),
            ]);
            const porAccion = { aviso: 0, timeout: 0, expulsion: 0, ban: 0 };
            porAccionAgg.forEach((a) => { if (a._id in porAccion) porAccion[a._id] = a.n; });
            res.json({ total, porAccion, bansActivos, recientes7d });
        } catch (error) {
            console.error('Error en stats de sanciones:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    });

    // --- Registro de sanciones (con filtros opcionales) ---
    app.get('/api/sanciones', exigeModerador, async (req, res) => {
        try {
            const { guildId, usuarioId, accion } = req.query;
            const filtro = {};
            if (guildId) filtro.guildId = guildId;
            else if (req.staff && !req.staff.owner) filtro.guildId = { $in: req.staff.guilds || [] };
            if (usuarioId) filtro.usuarioId = usuarioId;
            if (accion) filtro.accion = accion;
            res.json(await Sancion.find(filtro).sort({ fecha: -1 }).limit(200));
        } catch (error) {
            console.error('Error al listar sanciones:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    });

    // --- Revocar una sanción (desbanear / quitar aislamiento) ---
    app.post('/api/sanciones/:id/revocar', scopeModRecurso(Sancion, 'registro'), async (req, res) => {
        try {
            const sancion = await revocarSancion(client, req.params.id, moderadorDe(req));
            res.json({ success: true, sancion });
        } catch (error) {
            console.error('Error al revocar sanción:', error);
            res.status(400).json({ error: error.message || 'No se pudo revocar' });
        }
    });

    // --- Ficha de un miembro (para el Centro de Mando) ---
    app.get('/api/servidor/miembro/:userId', exigeModerador, async (req, res) => {
        try {
            const guild = await resolverGuild(req.query.guildId, req.staff);
            if (!guild) return res.status(404).json({ error: 'Servidor no encontrado' });
            const member = await guild.members.fetch(req.params.userId).catch(() => null);
            const user = member ? member.user : await client.users.fetch(req.params.userId).catch(() => null);
            if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
            const ban = await guild.bans.fetch(req.params.userId).catch(() => null);

            res.json({
                id: user.id,
                tag: user.username,
                displayName: member ? member.displayName : user.username,
                avatar: user.displayAvatarURL({ size: 128 }),
                enServidor: !!member,
                baneado: !!ban,
                creadoTimestamp: user.createdTimestamp,
                entradaTimestamp: member ? member.joinedTimestamp : null,
                esDueño: guild.ownerId === user.id,
                // ¿En voz ahora mismo? (estado en vivo)
                vozCanal: member?.voice?.channel ? { id: member.voice.channel.id, nombre: member.voice.channel.name } : null,
                roles: member
                    ? member.roles.cache.filter((r) => r.name !== '@everyone').sort((a, b) => b.position - a.position).map((r) => ({ id: r.id, nombre: r.name, color: r.hexColor }))
                    : [],
            });
        } catch (error) {
            console.error('Error al obtener miembro:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    });

    // --- Actividad de un usuario (resumen: último mensaje, voz, conteo) ---
    app.get('/api/servidor/actividad/:userId', exigeModerador, async (req, res) => {
        try {
            const act = await ActividadUsuario.findOne({ guildId: req.query.guildId, userId: req.params.userId });
            res.json(act || null);
        } catch (error) {
            console.error('Error al obtener actividad:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    });

    // --- Registro de mensajes de un usuario (los más recientes) ---
    app.get('/api/servidor/mensajes/:userId', exigeModerador, async (req, res) => {
        try {
            const limite = Math.min(100, parseInt(req.query.limit, 10) || 50);
            const mensajes = await RegistroMensaje.find({ guildId: req.query.guildId, userId: req.params.userId })
                .sort({ fecha: -1 }).limit(limite);
            res.json(mensajes);
        } catch (error) {
            console.error('Error al obtener mensajes del usuario:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    });

    // --- NIVELES: guardar configuración ---
    app.put('/api/config/:guildId/niveles', async (req, res) => {
        try {
            const b = req.body;
            const cambios = {};
            const numEntre = (v, min, max, def) => { const n = parseInt(v, 10); return Number.isNaN(n) ? def : Math.min(max, Math.max(min, n)); };

            if (b.nivelesActivo !== undefined) cambios.nivelesActivo = !!b.nivelesActivo;
            if (b.xpMin !== undefined) cambios.xpMin = numEntre(b.xpMin, 0, 1000, 15);
            if (b.xpMax !== undefined) cambios.xpMax = numEntre(b.xpMax, 0, 1000, 25);
            if (b.xpCooldownSeg !== undefined) cambios.xpCooldownSeg = numEntre(b.xpCooldownSeg, 0, 3600, 60);
            if (b.xpVozActivo !== undefined) cambios.xpVozActivo = !!b.xpVozActivo;
            if (b.xpVozPorMin !== undefined) cambios.xpVozPorMin = numEntre(b.xpVozPorMin, 0, 1000, 5);
            if (b.dificultad !== undefined) { const d = parseFloat(b.dificultad); cambios.dificultad = Number.isNaN(d) ? 1 : Math.min(5, Math.max(0.1, d)); }
            if (b.anuncioTipo !== undefined) cambios.anuncioTipo = ['canal', 'dm', 'off'].includes(b.anuncioTipo) ? b.anuncioTipo : 'canal';
            if (b.canalNivelesId !== undefined) cambios.canalNivelesId = b.canalNivelesId || null;
            if (b.mensajeSubida !== undefined) cambios.mensajeSubida = String(b.mensajeSubida).slice(0, 500);
            if (b.recompensaAcumulativa !== undefined) cambios.recompensaAcumulativa = !!b.recompensaAcumulativa;
            if (Array.isArray(b.canalesSinXp)) cambios.canalesSinXp = b.canalesSinXp.filter(Boolean);
            if (Array.isArray(b.rolesSinXp)) cambios.rolesSinXp = b.rolesSinXp.filter(Boolean);
            if (b.tarjetaActiva !== undefined) cambios.tarjetaActiva = !!b.tarjetaActiva;
            if (Array.isArray(b.multiplicadoresRol)) {
                cambios.multiplicadoresRol = b.multiplicadoresRol
                    .filter((m) => m && m.rolId)
                    .map((m) => ({ rolId: String(m.rolId), multiplicador: Math.min(10, Math.max(0, parseFloat(m.multiplicador) || 1)) }))
                    .slice(0, 50);
            }
            if (Array.isArray(b.recompensasNivel)) {
                cambios.recompensasNivel = b.recompensasNivel
                    .filter((r) => r && r.rolId && r.nivel)
                    .map((r) => ({ nivel: Math.max(1, parseInt(r.nivel, 10) || 1), rolId: String(r.rolId) }))
                    .slice(0, 50);
            }
            const config = await ServidorConfig.findOneAndUpdate(
                { guildId: req.params.guildId }, { $set: cambios }, { returnDocument: 'after', upsert: true },
            );
            res.json({ success: true, config });
        } catch (error) {
            console.error('Error al guardar niveles:', error);
            res.status(500).json({ error: 'No se pudo guardar' });
        }
    });

    // --- NIVELES: ranking (leaderboard) del servidor ---
    app.get('/api/niveles/ranking', async (req, res) => {
        try {
            const guild = await resolverGuild(req.query.guildId, req.staff);
            if (!guild) return res.json([]);
            const top = await ActividadUsuario.find({ guildId: guild.id, xp: { $gt: 0 } }).sort({ xp: -1 }).limit(50);
            const ranking = top.map((u, i) => {
                const member = guild.members.cache.get(u.userId);
                return {
                    posicion: i + 1,
                    userId: u.userId,
                    nombre: member ? member.displayName : (u.usuarioTag || 'Usuario'),
                    avatar: member ? member.user.displayAvatarURL({ size: 64 }) : null,
                    xp: u.xp,
                    nivel: u.nivel,
                };
            });
            res.json(ranking);
        } catch (error) {
            console.error('Error al obtener ranking:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    });

    // ========================================================================
    // PAGOS (Stripe). El webhook está más arriba (cuerpo crudo). Estos van
    // protegidos por el middleware /api: solo staff/propietario del servidor.
    // ========================================================================

    // Estado del plan del servidor (para pintar el panel y los candados).
    app.get('/api/billing/estado', async (req, res) => {
        try {
            const gid = req.query.guildId || (req.staff && (req.staff.guilds || [])[0]) || null;
            const cfg = gid ? await ServidorConfig.findOne({ guildId: gid }) : null;
            const estIA = billing.estadoIA(cfg);
            res.json({
                plan: (cfg && cfg.plan) || 'free',
                esPremium: billing.premiumActivo(cfg),
                premiumHasta: (cfg && cfg.premiumHasta) || null,
                cancelaAlFinal: !!(cfg && cfg.premiumCancelaAlFinal),
                pagosActivos: !!billing.getStripe(),       // ¿hay pasarela configurada?
                tieneSuscripcion: !!(cfg && cfg.stripeCustomerId),
                iaActiva: ia.iaDisponible(),
                iaUsos: estIA.usos, iaCuota: estIA.cuota,
            });
        } catch (e) {
            console.error('Error en estado de facturación:', e.message);
            res.status(500).json({ error: 'Error del servidor' });
        }
    });

    // Crea la sesión de pago y devuelve la URL de Stripe (el panel redirige ahí).
    app.post('/api/billing/checkout', async (req, res) => {
        try {
            if (!billing.getStripe()) return res.status(503).json({ error: 'Los pagos no están configurados.' });
            const { guildId, plan, intervalo } = req.body || {};
            if (!guildId) return res.status(400).json({ error: 'Falta el servidor' });
            if (!billing.PLANES_VALIDOS.includes(plan)) return res.status(400).json({ error: 'Plan no válido' });
            const intv = billing.INTERVALOS_VALIDOS.includes(intervalo) ? intervalo : 'month';
            const precio = billing.precioId(plan, intv);
            if (!precio) return res.status(400).json({ error: 'Ese plan o periodo no está disponible todavía' });

            const cfg = await ServidorConfig.findOne({ guildId });
            const sesion = await billing.crearSesionCheckout({
                guildId, plan, intervalo: intv, precio,
                clienteExistenteId: cfg && cfg.stripeCustomerId,
                exitoUrl: `${FRONTEND_URL}/?pago=ok`,
                cancelUrl: `${FRONTEND_URL}/?pago=cancelado`,
            });
            res.json({ url: sesion.url });
        } catch (e) {
            console.error('Error creando checkout:', e.message);
            res.status(500).json({ error: 'No se pudo iniciar el pago' });
        }
    });

    // Abre el Portal de Cliente de Stripe (gestionar / cancelar suscripción).
    app.post('/api/billing/portal', async (req, res) => {
        try {
            if (!billing.getStripe()) return res.status(503).json({ error: 'Los pagos no están configurados.' });
            const { guildId } = req.body || {};
            const cfg = guildId ? await ServidorConfig.findOne({ guildId }) : null;
            if (!cfg || !cfg.stripeCustomerId) return res.status(400).json({ error: 'No hay suscripción que gestionar' });
            const sesion = await billing.crearSesionPortal({
                clienteId: cfg.stripeCustomerId,
                retornoUrl: `${FRONTEND_URL}/`,
            });
            res.json({ url: sesion.url });
        } catch (e) {
            console.error('Error abriendo portal de pago:', e.message);
            res.status(500).json({ error: 'No se pudo abrir el portal' });
        }
    });

    // --- COMUNIDAD: sorteos, eventos, encuestas, sugerencias, presentaciones ---
    require('./comunidadRoutes.js')(app, client);

    // --- Frontend del panel (SPA de React, compilada con `npm run build`) ---
    // Servimos el build del panel desde el MISMO proceso y origen que la API.
    // Así un único dominio (p. ej. dashboard.sokyo.studio) sirve la web Y la API
    // sin problemas de CORS y con un solo túnel/proxy por delante.
    const panelDist = path.join(__dirname, '..', 'sokyo-panelFRONTEND', 'dist');
    if (fs.existsSync(panelDist)) {
        app.use(express.static(panelDist));
        // Fallback SPA: las rutas que no son de la API ni archivos subidos
        // devuelven index.html para que el enrutado del cliente
        // (?portal=1 y #dashboard) funcione al recargar o entrar directo.
        app.use((req, res, next) => {
            if (req.method !== 'GET') return next();
            if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
            res.sendFile(path.join(panelDist, 'index.html'));
        });
        console.log('🖥️  Panel web servido desde sokyo-panelFRONTEND/dist');
    } else {
        console.warn('ℹ️  No se encontró sokyo-panelFRONTEND/dist; ejecuta "npm run build" en el panel para servir la web desde la API.');
    }

    app.listen(port, () => console.log(`🌐 API corriendo en puerto ${port}`));
};