// Rutas del panel de staff.
//
// SEGURIDAD: cada ruta declara el permiso que exige con acceso('permiso'). El permiso se calcula en el
// servidor a partir de los roles reales del usuario en Discord (ver utils/permisos.js), así que ocultar
// un botón en el panel es solo cosmética: aunque alguien llame a la API a mano, recibe 403.
const express = require('express');
const ServidorConfig = require('../models/ServidorConfig.js');
const Ticket = require('../models/Ticket.js');
const Mensaje = require('../models/Mensaje.js');
const Log = require('../models/Log.js');
const Macro = require('../models/Macro.js');
const Articulo = require('../models/Articulo.js');
const { cerrarTicket, reabrirTicket, reclamarTicket, soltarTicket, registrarActividad, generarTranscriptHtml } = require('../utils/ticketManager.js');
const { ejecutarSancion, listarSanciones } = require('../utils/moderacion.js');
const { verificarToken } = require('../utils/auth.js');
const { GRUPOS, PERMISOS, SECCIONES, NOMBRE_FLAG, heredados, concesionesDeRol, sanitizarConcesion } = require('../utils/permisos.js');
const { calcularMetricas } = require('../utils/metricas.js');
const { SECCIONES: SECCIONES_CONFIG } = require('../utils/configSchema.js');
const { parseDuracion, normalizarNombreMacro, escaparRegex, campoCsv } = require('../utils/helpers.js');
const eventos = require('../utils/eventos.js');
const crearContexto = require('./contexto.js');

const PERMISOS_MOD = ['mod.historial', 'mod.warn', 'mod.mute', 'mod.kick', 'mod.ban'];
const hex = (n) => (n ? `#${n.toString(16).padStart(6, '0')}` : '#99aab5');
const avatarDe = (user) => user?.displayAvatarURL?.({ extension: 'png', size: 64 }) || null;

module.exports = (app, client, { JWT_SECRET }) => {
    const { contexto, invalidar } = crearContexto(client);
    const router = express.Router();

    // ---------- Autenticación: solo sesiones de STAFF (las del portal de clientes no valen) ----------
    const staffAuth = (req, res, next) => {
        const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        const usuario = verificarToken(token, JWT_SECRET);
        if (!usuario || usuario.tipo !== 'staff') return res.status(401).json({ error: 'Sesión no válida o caducada' });
        req.staff = usuario;
        next();
    };

    // Servidor sobre el que actúa la petición: el del ticket si lo hay (no se puede falsear), si no el indicado.
    const guildDe = (req) => req.ticket?.guildId || req.params.guildId || req.headers['x-guild-id'] || req.query.guildId;

    // acceso('a','b') => hace falta tener AL MENOS UNO de esos permisos en el servidor.
    const acceso = (...permisos) => async (req, res, next) => {
        try {
            const guildId = guildDe(req);
            if (!guildId) return res.status(400).json({ error: 'Falta el servidor (cabecera x-guild-id)' });
            const ctx = await contexto(guildId, req.staff.id);
            if (!ctx) return res.status(403).json({ error: 'No perteneces a ese servidor' });
            // Sin permisos indicados = "cualquier acceso al panel": hay que tener AL MENOS un permiso, no basta con ser miembro.
            const autorizado = permisos.length === 0 ? ctx.calculo.permisos.size > 0 : permisos.some(p => ctx.calculo.permisos.has(p));
            if (!autorizado) return res.status(403).json({ error: 'No tienes permiso para esto', requiere: permisos });
            req.guildId = guildId;
            req.ctx = ctx;
            next();
        } catch (error) {
            console.error('Error comprobando permisos:', error);
            res.status(500).json({ error: 'Fallo interno' });
        }
    };

    // Descarga los miembros del servidor como mucho una vez cada 5 min (el gateway limita esta petición).
    const ultimaCarga = new Map();
    const cargarMiembros = async (guild) => {
        if (Date.now() - (ultimaCarga.get(guild.id) || 0) < 300_000) return;
        ultimaCarga.set(guild.id, Date.now());
        await guild.members.fetch().catch(() => {});
    };

    const manejar = (fn) => async (req, res) => {
        try { await fn(req, res); }
        catch (error) { console.error(`Error en ${req.method} ${req.path}:`, error); res.status(500).json({ error: 'Fallo interno' }); }
    };

    const auditar = (guildId, categoria, accion, req, detalles, color = '#5865F2') =>
        Log.create({ guildId, categoria, accion, usuario: req.staff.username, detalles, color }).catch(() => {});

    // Carga el ticket de la URL (y de paso fija el servidor al del ticket).
    const cargarTicket = async (req, res, next, id) => {
        req.ticket = await Ticket.findOne({ canalId: id });
        if (!req.ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
        next();
    };
    router.param('canalId', cargarTicket);
    router.param('ticketId', cargarTicket);

    router.use(staffAuth);

    // =============== SESIÓN Y PERMISOS ===============

    // Servidores a los que puede entrar esta persona y qué puede hacer en cada uno.
    router.get('/staff/yo', manejar(async (req, res) => {
        const servidores = [];
        for (const guild of client.guilds.cache.values()) {
            const ctx = await contexto(guild.id, req.staff.id);
            if (ctx && ctx.calculo.permisos.size > 0) {
                servidores.push({
                    id: guild.id, nombre: guild.name, icono: guild.iconURL({ extension: 'png', size: 64 }),
                    rango: ctx.calculo.rango, permisos: [...ctx.calculo.permisos]
                });
            }
        }
        res.json({ usuario: { id: req.staff.id, username: req.staff.username, avatar: req.staff.avatar }, servidores });
    }));

    // Catálogo para que el panel pinte permisos, grupos y secciones (una sola fuente de verdad).
    router.get('/permisos/catalogo', (req, res) => res.json({ grupos: GRUPOS, permisos: PERMISOS, secciones: SECCIONES, flags: NOMBRE_FLAG }));

    // Mis permisos efectivos en el servidor, con el ORIGEN de cada uno (Discord / rol).
    router.get('/permisos/yo', acceso(), manejar(async (req, res) => {
        const { calculo } = req.ctx;
        res.json({ rango: calculo.rango, permisos: [...calculo.permisos], fuentes: calculo.fuentes });
    }));

    // Mapa de roles: qué puede hacer cada rol (heredado de Discord + concedido desde el panel).
    router.get('/permisos/roles', acceso(), manejar(async (req, res) => {
        const { guild, config, calculo } = req.ctx;
        await cargarMiembros(guild); // para contar miembros por rol
        const roles = guild.roles.cache.filter(r => r.id !== guild.id && !r.managed).sort((a, b) => b.position - a.position).map(r => ({
            id: r.id, nombre: r.name, color: hex(r.color), posicion: r.position,
            miembros: r.members.size,
            muestra: [...r.members.values()].slice(0, 5).map(m => ({ id: m.id, nombre: m.displayName, avatar: avatarDe(m.user) })),
            esAdmin: r.permissions.has('Administrator'),
            heredados: [...heredados(f => r.permissions.has(f))],
            concedidos: concesionesDeRol(config, r.id),
            // ¿puede el usuario que mira editar este rol? (propietario, o rol por debajo del suyo)
            editable: calculo.permisos.has('config.permisos') && (guild.ownerId === req.staff.id || r.position < req.ctx.member.roles.highest.position)
        })).filter(r => r.heredados.length > 0 || r.concedidos.length > 0 || r.editable || r.miembros > 0);
        res.json({ roles, puedeEditar: calculo.permisos.has('config.permisos') });
    }));

    // Guardar los permisos de panel de un rol.
    router.put('/permisos/roles/:rolId', acceso('config.permisos'), manejar(async (req, res) => {
        const { guild, config, calculo, member } = req.ctx;
        const rol = guild.roles.cache.get(req.params.rolId);
        if (!rol || rol.id === guild.id) return res.status(404).json({ error: 'Rol no encontrado' });
        if (guild.ownerId !== req.staff.id && rol.position >= member.roles.highest.position) {
            return res.status(403).json({ error: 'Solo puedes editar roles que estén por debajo de tu rol más alto.' });
        }

        const existentes = concesionesDeRol(config, rol.id);
        const { permitidos, rechazados } = sanitizarConcesion(req.body?.permisos, calculo.permisos);
        // Los permisos que tú no tienes no puedes ni dar ni quitar: se conservan tal cual estaban.
        const finales = [...new Set([...existentes.filter(p => !calculo.permisos.has(p)), ...permitidos])];

        const resto = (config.rolesPermisos || []).filter(r => r.rolId !== rol.id);
        if (finales.length > 0) resto.push({ rolId: rol.id, permisos: finales });
        await ServidorConfig.updateOne({ guildId: req.guildId }, { $set: { rolesPermisos: resto } });
        invalidar(req.guildId);

        const dados = finales.filter(p => !existentes.includes(p)), quitados = existentes.filter(p => !finales.includes(p));
        await auditar(req.guildId, 'Permisos', '🔐 Permisos de rol modificados', req,
            `Rol: @${rol.name}\nAñadidos: ${dados.join(', ') || '—'}\nQuitados: ${quitados.join(', ') || '—'}`, '#eb459e');
        res.json({ success: true, permisos: finales, rechazados });
    }));

    // =============== DATOS DEL SERVIDOR (selectores del panel) ===============

    router.get('/guild/info', acceso('config.comunidad', 'config.tickets', 'config.automatizacion', 'config.automod', 'config.permisos'), manejar(async (req, res) => {
        const { guild } = req.ctx;
        res.json({
            roles: guild.roles.cache.filter(r => r.id !== guild.id && !r.managed).sort((a, b) => b.position - a.position).map(r => ({ id: r.id, nombre: r.name, color: hex(r.color) })),
            canales: guild.channels.cache.filter(c => c.isTextBased() && !c.isThread() && c.type === 0).sort((a, b) => a.position - b.position).map(c => ({ id: c.id, nombre: c.name }))
        });
    }));

    // Configuración del servidor (la necesitan casi todas las pantallas: urgencias, motivos…).
    router.get('/config', acceso(), manejar(async (req, res) => {
        const config = (await ServidorConfig.findOne({ guildId: req.guildId }))?.toObject() || {};
        if (!req.ctx.calculo.permisos.has('config.permisos')) delete config.rolesPermisos;
        res.json(config);
    }));

    router.put('/config/:guildId/motivos', acceso('config.tickets'), manejar(async (req, res) => {
        const motivos = (Array.isArray(req.body.motivos) ? req.body.motivos : []).slice(0, 25)
            .map(m => ({ nombre: String(m.nombre || '').slice(0, 100), urgencia: String(m.urgencia || 'Normal').slice(0, 50) })).filter(m => m.nombre);
        const config = await ServidorConfig.findOneAndUpdate({ guildId: req.guildId }, { motivos }, { returnDocument: 'after' });
        invalidar(req.guildId);
        await auditar(req.guildId, 'Configuración', '🛠️ Motivos de ticket actualizados', req, motivos.map(m => m.nombre).join(', '));
        res.json({ success: true, config });
    }));

    router.put('/config/:guildId/urgencias', acceso('config.tickets'), manejar(async (req, res) => {
        const urgencias = (Array.isArray(req.body.urgencias) ? req.body.urgencias : []).slice(0, 20)
            .map(u => ({ nombre: String(u.nombre || '').slice(0, 50), color: /^#[0-9a-f]{6}$/i.test(u.color) ? u.color : '#3498db', nivel: Math.min(1000, Math.max(1, parseInt(u.nivel) || 1)) })).filter(u => u.nombre);
        const config = await ServidorConfig.findOneAndUpdate({ guildId: req.guildId }, { urgencias }, { returnDocument: 'after' });
        invalidar(req.guildId);
        await auditar(req.guildId, 'Configuración', '🚥 Urgencias actualizadas', req, urgencias.map(u => u.nombre).join(', '));
        res.json({ success: true, config });
    }));

    router.put('/config/:guildId/textos', acceso('config.textos'), manejar(async (req, res) => {
        const { titulo, descripcion, footer } = req.body;
        const config = await ServidorConfig.findOneAndUpdate({ guildId: req.guildId }, {
            mensajeSoporteTitulo: String(titulo || '').slice(0, 256),
            mensajeSoporteDescripcion: String(descripcion || '').slice(0, 2000),
            footerPersonalizado: String(footer || '').slice(0, 200)
        }, { returnDocument: 'after' });
        invalidar(req.guildId);
        await auditar(req.guildId, 'Configuración', '📝 Textos del panel de soporte actualizados', req, '');
        res.json({ success: true, config });
    }));

    // Secciones genéricas (tickets/automatización/automod/comunidad): cada una exige su propio permiso.
    router.put('/config/:guildId/seccion/:seccion', async (req, res, next) => {
        const def = SECCIONES_CONFIG[req.params.seccion];
        if (!def) return res.status(404).json({ error: 'Sección desconocida' });
        return acceso(def.permiso)(req, res, next);
    }, manejar(async (req, res) => {
        const def = SECCIONES_CONFIG[req.params.seccion];
        const config = await ServidorConfig.findOneAndUpdate({ guildId: req.guildId }, { $set: def.limpiar(req.body || {}) }, { returnDocument: 'after' });
        invalidar(req.guildId);
        await auditar(req.guildId, 'Configuración', `⚙️ Ajustes de «${req.params.seccion}» actualizados`, req, '');
        res.json({ success: true, config });
    }));

    // =============== TICKETS ===============

    router.get('/tickets', acceso('tickets.ver'), manejar(async (req, res) => {
        const { q, estado, prioridad, asignado, motivo } = req.query;
        const filtro = { guildId: req.guildId, visibleWeb: true };
        if (estado && ['Abierto', 'Cerrado'].includes(estado)) filtro.estado = estado;
        if (prioridad) filtro.prioridad = String(prioridad);
        if (motivo) filtro.motivo = String(motivo);
        if (asignado === 'yo') filtro.asignadoA = req.staff.id;
        else if (asignado === 'ninguno') filtro.asignadoA = null;
        else if (asignado) filtro.asignadoA = String(asignado);

        if (q && String(q).trim()) {
            const re = new RegExp(escaparRegex(String(q).trim().slice(0, 80)), 'i');
            // También busca dentro del contenido de las conversaciones.
            const canalesConTexto = await Mensaje.distinct('ticketId', { contenido: re });
            filtro.$or = [{ titulo: re }, { motivo: re }, { creadorNombre: re }, { descripcion: re }, { asignadoNombre: re }, { canalId: { $in: canalesConTexto.slice(0, 500) } }];
        }
        res.json(await Ticket.find(filtro).sort({ fechaCreacion: -1 }).limit(500));
    }));

    router.get('/tickets/exportar', acceso('tickets.exportar'), manejar(async (req, res) => {
        const tickets = await Ticket.find({ guildId: req.guildId }).sort({ fechaCreacion: -1 });
        const cab = ['id_canal', 'titulo', 'motivo', 'prioridad', 'estado', 'creador', 'atendido_por', 'creado', 'cerrado', 'primera_respuesta_min', 'valoracion'];
        const filas = tickets.map(t => [
            t.canalId, t.titulo, t.motivo, t.prioridad, t.estado, t.creadorNombre, t.asignadoNombre || '',
            t.fechaCreacion?.toISOString(), t.fechaCierre?.toISOString() || '',
            t.primeraRespuestaStaff ? Math.round((t.primeraRespuestaStaff - t.fechaCreacion) / 60000) : '', t.valoracionCSAT ?? ''
        ].map(campoCsv).join(','));
        await auditar(req.guildId, 'Tickets', '📥 Exportación de tickets (CSV)', req, `${tickets.length} tickets`, '#3498db');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="tickets.csv"');
        res.send('﻿' + [cab.join(','), ...filas].join('\n'));
    }));

    router.get('/tickets/asignados/:staffId', acceso('tickets.ver'), manejar(async (req, res) => {
        res.json(await Ticket.find({ guildId: req.guildId, asignadoA: req.params.staffId, visibleWeb: true }).sort({ fechaCreacion: -1 }));
    }));

    router.get('/mensajes/:ticketId', acceso('tickets.ver'), manejar(async (req, res) => {
        res.json(await Mensaje.find({ ticketId: req.params.ticketId }).sort({ fecha: 1 }));
    }));

    router.get('/tickets/:canalId/transcripcion', acceso('tickets.exportar'), manejar(async (req, res) => {
        const html = await generarTranscriptHtml(req.ticket.canalId, req.ticket);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="transcripcion-${req.ticket.canalId}.html"`);
        res.send(html);
    }));

    // Responder desde el panel. El autor sale de la SESIÓN (antes se aceptaba cualquier nombre del navegador).
    router.post('/mensajes/:ticketId', acceso('tickets.responder'), manejar(async (req, res) => {
        const contenido = String(req.body?.contenido || '').trim().slice(0, 1900);
        if (!contenido) return res.status(400).json({ error: 'Mensaje vacío' });
        if (req.ticket.estado === 'Cerrado') return res.status(400).json({ error: 'Este ticket está cerrado' });

        const nombre = req.ctx.member.displayName || req.staff.username;
        const nuevoMsg = await Mensaje.create({ ticketId: req.ticket.canalId, usuarioId: req.staff.id, usuario: nombre, contenido });
        const canal = client.channels.cache.get(req.ticket.canalId);
        // allowedMentions vacío: un staff no puede disparar @everyone ni menciones masivas desde el panel.
        if (canal) await canal.send({ content: `**[${nombre}]** ${contenido}`, allowedMentions: { parse: [] } });
        await registrarActividad(req.ticket.canalId, req.staff.id);
        res.json({ success: true, mensaje: nuevoMsg });
    }));

    router.post('/tickets/:canalId/notas', acceso('tickets.notas'), manejar(async (req, res) => {
        const contenido = String(req.body?.contenido || '').trim().slice(0, 1000);
        if (!contenido) return res.status(400).json({ error: 'Nota vacía' });
        const ticket = await Ticket.findOneAndUpdate({ canalId: req.ticket.canalId },
            { $push: { notasInternas: { contenido, autor: req.ctx.member.displayName || req.staff.username, fecha: new Date() } } }, { returnDocument: 'after' });
        eventos.emitir(req.guildId, 'ticket:actualizado', { canalId: ticket.canalId });
        res.json({ success: true, ticket });
    }));

    router.put('/tickets/:canalId/reclamar', acceso('tickets.reclamar'), manejar(async (req, res) => {
        const r = await reclamarTicket(client, req.ticket.canalId, { id: req.staff.id, username: req.ctx.member.user.username, avatar: avatarDe(req.ctx.member.user) });
        if (!r.ok) return res.status(409).json({ error: r.error });
        const canal = client.channels.cache.get(req.ticket.canalId);
        if (canal) await canal.send(`📢 El agente de soporte **${req.ctx.member.user.username}** se ha hecho cargo de este ticket (desde el panel).`).catch(() => {});
        res.json({ success: true, ticket: r.ticket });
    }));

    router.put('/tickets/:canalId/soltar', acceso('tickets.reclamar'), manejar(async (req, res) => {
        if (req.ticket.asignadoA !== req.staff.id && !req.ctx.calculo.permisos.has('tickets.reasignar')) {
            return res.status(403).json({ error: 'Solo quien atiende el ticket (o alguien con permiso de reasignar) puede soltarlo.', requiere: ['tickets.reasignar'] });
        }
        const r = await soltarTicket(client, req.ticket.canalId, { autor: req.ctx.member.user.username });
        if (!r.ok) return res.status(409).json({ error: r.error });
        res.json({ success: true, ticket: r.ticket });
    }));

    router.put('/tickets/:canalId/cerrar', acceso('tickets.cerrar'), manejar(async (req, res) => {
        const r = await cerrarTicket(client, req.ticket.canalId, { autor: req.ctx.member.user.username, avisarCanal: true });
        if (!r.ok) return res.status(404).json({ error: r.error });
        res.json({ success: true, ticket: r.ticket });
    }));

    router.put('/tickets/:canalId/reabrir', acceso('tickets.reabrir'), manejar(async (req, res) => {
        const r = await reabrirTicket(client, req.ticket.canalId, { autor: req.ctx.member.user.username });
        if (!r.ok) return res.status(404).json({ error: r.error });
        res.json({ success: true, ticket: r.ticket });
    }));

    router.put('/tickets/:canalId/ocultar', acceso('tickets.ocultar'), manejar(async (req, res) => {
        const ticket = await Ticket.findOneAndUpdate({ canalId: req.ticket.canalId }, { visibleWeb: false }, { returnDocument: 'after' });
        await auditar(req.guildId, 'Tickets', '🗑️ Ticket ocultado del panel', req, `Ticket: ${ticket.titulo}`, '#95a5a6');
        eventos.emitir(req.guildId, 'ticket:actualizado', { canalId: ticket.canalId });
        res.json({ success: true, ticket });
    }));

    // =============== ANÁLISIS ===============

    router.get('/usuarios/stats', acceso('usuarios.ver'), manejar(async (req, res) => {
        res.json(await Ticket.aggregate([
            { $match: { guildId: req.guildId } },
            { $sort: { fechaCreacion: -1 } },
            { $group: {
                _id: '$creadorId', nombre: { $first: '$creadorNombre' }, avatar: { $first: '$creadorAvatar' },
                totalTickets: { $sum: 1 },
                ticketsAbiertos: { $sum: { $cond: [{ $eq: ['$estado', 'Abierto'] }, 1, 0] } },
                ratingTotal: { $sum: '$valoracionCSAT' },
                ratingCount: { $sum: { $cond: [{ $gt: ['$valoracionCSAT', 0] }, 1, 0] } },
                ultimoTicket: { $first: '$fechaCreacion' }
            } },
            { $project: { nombre: 1, avatar: 1, totalTickets: 1, ticketsAbiertos: 1, ultimoTicket: 1,
                ratingMedio: { $cond: [{ $eq: ['$ratingCount', 0] }, null, { $divide: ['$ratingTotal', '$ratingCount'] }] } } },
            { $sort: { totalTickets: -1 } }
        ]));
    }));

    router.get('/metricas', acceso('metricas.ver'), manejar(async (req, res) => {
        const dias = Math.min(365, Math.max(1, parseInt(req.query.dias) || 30));
        const tickets = await Ticket.find({ guildId: req.guildId }).lean();
        res.json(calcularMetricas(tickets, { dias, offsetMin: parseInt(req.query.offset) || 0 }));
    }));

    router.get('/logs', acceso('logs.ver'), manejar(async (req, res) => {
        const config = await ServidorConfig.findOne({ guildId: req.guildId });
        const esPremium = config?.esPremium === true;
        const limite = esPremium ? 150 : 50;
        const logs = await Log.find({ guildId: req.guildId }).sort({ fecha: -1 }).limit(limite);
        res.json({ logs, limite, esPremium });
    }));

    // =============== RESPUESTAS RÁPIDAS Y FAQ ===============

    router.get('/macros', acceso('tickets.macros', 'config.contenido'), manejar(async (req, res) => {
        res.json(await Macro.find({ guildId: req.guildId }).sort({ nombre: 1 }));
    }));

    router.post('/macros', acceso('config.contenido'), manejar(async (req, res) => {
        const nombre = normalizarNombreMacro(req.body?.nombre);
        const contenido = String(req.body?.contenido || '').trim().slice(0, 1900);
        if (!nombre || !contenido) return res.status(400).json({ error: 'Nombre y contenido son obligatorios' });
        try {
            const macro = await Macro.create({ guildId: req.guildId, nombre, titulo: String(req.body?.titulo || '').slice(0, 80), contenido, creadoPor: req.staff.username });
            res.json({ success: true, macro });
        } catch (e) {
            if (e.code === 11000) return res.status(409).json({ error: 'Ya existe una respuesta con ese nombre' });
            throw e;
        }
    }));

    router.put('/macros/:id', acceso('config.contenido'), manejar(async (req, res) => {
        const contenido = String(req.body?.contenido || '').trim().slice(0, 1900);
        if (!contenido) return res.status(400).json({ error: 'El contenido es obligatorio' });
        const macro = await Macro.findOneAndUpdate({ _id: req.params.id, guildId: req.guildId }, { contenido, titulo: String(req.body?.titulo || '').slice(0, 80) }, { returnDocument: 'after' });
        if (!macro) return res.status(404).json({ error: 'No encontrada' });
        res.json({ success: true, macro });
    }));

    router.delete('/macros/:id', acceso('config.contenido'), manejar(async (req, res) => {
        await Macro.deleteOne({ _id: req.params.id, guildId: req.guildId });
        res.json({ success: true });
    }));

    const limpiarPalabras = (v) => [...new Set((Array.isArray(v) ? v : String(v || '').split(',')).map(x => String(x).trim().toLowerCase()).filter(Boolean))].slice(0, 30);

    router.get('/faq', acceso('config.contenido'), manejar(async (req, res) => {
        res.json(await Articulo.find({ guildId: req.guildId }).sort({ titulo: 1 }));
    }));

    router.post('/faq', acceso('config.contenido'), manejar(async (req, res) => {
        const titulo = String(req.body?.titulo || '').trim().slice(0, 100);
        const contenido = String(req.body?.contenido || '').trim().slice(0, 3500);
        if (!titulo || !contenido) return res.status(400).json({ error: 'Título y contenido son obligatorios' });
        res.json({ success: true, articulo: await Articulo.create({ guildId: req.guildId, titulo, contenido, palabras: limpiarPalabras(req.body?.palabras), creadoPor: req.staff.username }) });
    }));

    router.put('/faq/:id', acceso('config.contenido'), manejar(async (req, res) => {
        const articulo = await Articulo.findOneAndUpdate({ _id: req.params.id, guildId: req.guildId }, {
            titulo: String(req.body?.titulo || '').trim().slice(0, 100), contenido: String(req.body?.contenido || '').trim().slice(0, 3500), palabras: limpiarPalabras(req.body?.palabras)
        }, { returnDocument: 'after' });
        if (!articulo) return res.status(404).json({ error: 'No encontrado' });
        res.json({ success: true, articulo });
    }));

    router.delete('/faq/:id', acceso('config.contenido'), manejar(async (req, res) => {
        await Articulo.deleteOne({ _id: req.params.id, guildId: req.guildId });
        res.json({ success: true });
    }));

    // =============== MODERACIÓN (permisos 100% de Discord) ===============

    // Buscar miembros por nombre o ID. Devuelve además qué acciones podría hacer ESTE staff sobre cada uno.
    router.get('/moderacion/miembros', acceso(...PERMISOS_MOD), manejar(async (req, res) => {
        const { guild, member: actor, calculo } = req.ctx;
        const q = String(req.query.q || '').trim();
        if (q.length < 2) return res.json([]);
        const encontrados = /^\d{15,25}$/.test(q)
            ? [await guild.members.fetch(q).catch(() => null)].filter(Boolean)
            : [...(await guild.members.search({ query: q, limit: 10 })).values()];

        res.json(encontrados.map(m => {
            const jerarquiaOk = guild.ownerId === actor.id || m.roles.highest.position < actor.roles.highest.position;
            const esProtegido = m.id === actor.id || m.id === guild.ownerId || m.id === client.user.id;
            const puede = (perm, botOk) => calculo.permisos.has(perm) && jerarquiaOk && !esProtegido && botOk;
            return {
                id: m.id, nombre: m.user.username, apodo: m.displayName, avatar: avatarDe(m.user),
                rolMasAlto: m.roles.highest.id !== guild.id ? { nombre: m.roles.highest.name, color: hex(m.roles.highest.color) } : null,
                silenciado: !!m.communicationDisabledUntil && m.communicationDisabledUntil > new Date(),
                puede: {
                    warn: puede('mod.warn', true), mute: puede('mod.mute', m.moderatable), kick: puede('mod.kick', m.kickable), ban: puede('mod.ban', m.bannable)
                },
                motivoBloqueo: esProtegido ? 'Usuario protegido' : (!jerarquiaOk ? 'Rol igual o superior al tuyo' : null)
            };
        }));
    }));

    router.get('/moderacion/sanciones', acceso('mod.historial'), manejar(async (req, res) => {
        res.json(await listarSanciones(req.guildId, req.query.usuarioId ? String(req.query.usuarioId) : null, 50));
    }));

    router.post('/moderacion/:tipo', acceso(...PERMISOS_MOD), manejar(async (req, res) => {
        const tipo = req.params.tipo;
        if (!['warn', 'mute', 'unmute', 'kick', 'ban', 'unban'].includes(tipo)) return res.status(404).json({ error: 'Acción desconocida' });
        const usuarioId = String(req.body?.usuarioId || '');
        if (!/^\d{15,25}$/.test(usuarioId)) return res.status(400).json({ error: 'ID de usuario no válido' });
        const duracionMs = req.body?.duracion ? parseDuracion(req.body.duracion) : null;
        if (req.body?.duracion && !duracionMs) return res.status(400).json({ error: 'Duración no válida (ej. 10m, 2h, 1d)' });

        // ejecutarSancion vuelve a comprobar el permiso de Discord, la jerarquía de roles y los límites del bot.
        const r = await ejecutarSancion(client, {
            guildId: req.guildId, tipo, actorMember: req.ctx.member, objetivoId: usuarioId,
            razon: req.body?.razon, duracionMs, diasBorrar: parseInt(req.body?.dias) || 0, origen: 'panel'
        });
        if (!r.ok) return res.status(403).json({ error: r.error });
        res.json({ success: true, objetivo: r.objetivo });
    }));

    // =============== EVENTOS EN VIVO (Server-Sent Events) ===============

    router.get('/eventos', manejar(async (req, res) => {
        const permitidos = new Set();
        const refrescar = async () => {
            permitidos.clear();
            for (const g of client.guilds.cache.values()) {
                const ctx = await contexto(g.id, req.staff.id);
                if (ctx?.calculo.permisos.has('tickets.ver')) permitidos.add(g.id);
            }
        };
        await refrescar();

        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write('retry: 5000\n\n');
        const baja = eventos.suscribir({ res, puede: (guildId) => permitidos.has(guildId) });
        const latido = setInterval(() => res.write(': latido\n\n'), 25_000);
        const permisos = setInterval(refrescar, 60_000); // si le quitan el permiso, deja de recibir en ≤ 1 min
        req.on('close', () => { clearInterval(latido); clearInterval(permisos); baja(); });
    }));

    app.use('/api', router);
};
