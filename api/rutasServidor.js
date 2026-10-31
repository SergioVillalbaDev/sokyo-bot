// Rutas de un servidor concreto: /api/g/:guildId/...
// Acceso según los permisos REALES del usuario en ese servidor de Discord:
//   - admin  → Administrador o Gestionar servidor (o dueño)
//   - staff  → tiene alguno de los roles de staff configurados
const express = require('express');
const mongoose = require('mongoose');
const { ChannelType, PermissionsBitField } = require('discord.js');
const Ticket = require('../models/Ticket.js');
const Mensaje = require('../models/Mensaje.js');
const Log = require('../models/Log.js');
const Articulo = require('../models/Articulo.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { obtenerConfig, buscarMotivo, buscarPanel, esPremium, limitesDe } = require('../utils/config.js');
const { esAdmin, puedeAtender } = require('../utils/permisos.js');
const { cerrarTicket, reabrirTicket } = require('../utils/ticketManager.js');
const { mensajePanel } = require('../utils/aperturaTickets.js');
const { conImagenesVigentes } = require('../utils/adjuntos.js');
const { registrarLog } = require('../utils/logs.js');
const ia = require('../utils/ia.js');

class HttpError extends Error {
    constructor(status, mensaje) { super(mensaje); this.status = status; }
}

const texto = (v, max) => String(v ?? '').trim().slice(0, max);
const entre = (n, min, max, defecto) => Math.min(Math.max(Number.isFinite(Number(n)) ? Number(n) : defecto, min), max);
const esColor = (c) => /^#[0-9a-f]{6}$/i.test(c || '');

module.exports = (client) => {
    const router = express.Router({ mergeParams: true });

    // ---------- Acceso ----------
    router.use(async (req, res, next) => {
        const guild = client.guilds.cache.get(req.params.guildId);
        if (!guild) return res.status(404).json({ error: 'El bot no está en ese servidor' });
        const member = await guild.members.fetch(req.usuario.id).catch(() => null);
        if (!member) return res.status(403).json({ error: 'No eres miembro de ese servidor' });

        const config = await obtenerConfig(guild.id);
        const admin = esAdmin(member);
        const rolesStaff = new Set([...config.rolesStaff, ...config.motivos.flatMap(m => m.rolesStaff || [])]);
        const staff = admin || member.roles.cache.some(r => rolesStaff.has(r.id)) ||
            (config.rolesStaff.length === 0 && member.permissions.has(PermissionsBitField.Flags.ManageChannels));
        if (!staff) return res.status(403).json({ error: 'No formas parte del equipo de soporte de este servidor' });

        Object.assign(req, { guild, member, config, permisos: { admin, staff } });
        next();
    });

    const soloAdmin = (req, res, next) => req.permisos.admin ? next() : res.status(403).json({ error: 'Solo los administradores pueden cambiar esto' });

    const cargarTicket = async (req, res, next) => {
        const ticket = await Ticket.findOne({ canalId: req.params.canalId, guildId: req.guild.id });
        if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
        if (!puedeAtender(req.member, req.config, buscarMotivo(req.config, ticket.motivoId || ticket.motivo))) {
            return res.status(403).json({ error: 'Este tipo de ticket lo atiende otro equipo' });
        }
        req.ticket = ticket;
        next();
    };

    const quien = (req) => req.usuario.username;

    // ---------- Resumen del servidor ----------
    router.get('/resumen', async (req, res) => {
        const guildId = req.guild.id;
        const hace30 = new Date(Date.now() - 30 * 86400000);
        const [abiertos, sinReclamar, csat, primeraRespuesta] = await Promise.all([
            Ticket.countDocuments({ guildId, estado: 'Abierto', canalBorrado: { $ne: true } }),
            Ticket.countDocuments({ guildId, estado: 'Abierto', asignadoA: null, canalBorrado: { $ne: true } }),
            Ticket.aggregate([{ $match: { guildId, valoracionCSAT: { $gt: 0 } } }, { $group: { _id: null, media: { $avg: '$valoracionCSAT' }, total: { $sum: 1 } } }]),
            Ticket.aggregate([
                { $match: { guildId, fechaCreacion: { $gte: hace30 }, primeraRespuestaStaff: { $ne: null } } },
                { $group: { _id: null, media: { $avg: { $subtract: ['$primeraRespuestaStaff', '$fechaCreacion'] } } } }
            ])
        ]);
        const config = req.config;
        res.json({
            servidor: { id: guildId, nombre: req.guild.name, icono: req.guild.iconURL({ size: 96 }), miembros: req.guild.memberCount },
            usuario: { id: req.usuario.id, username: req.usuario.username, avatar: req.usuario.avatar },
            permisos: req.permisos,
            plan: { premium: esPremium(config), premiumHasta: config.premiumHasta, limites: limitesDe(config) },
            ia: { ...ia.usoIA(config), deflexion: config.ia?.deflexion !== false, triaje: config.ia?.triaje !== false, ticketsEvitados: config.ia?.ticketsEvitados || 0 },
            urgencias: config.urgencias,
            configurado: config.rolesStaff.length > 0,
            stats: {
                abiertos, sinReclamar,
                csatMedio: csat[0]?.media || null, valoraciones: csat[0]?.total || 0,
                primeraRespuestaMin: primeraRespuesta[0]?.media ? Math.round(primeraRespuesta[0].media / 60000) : null
            }
        });
    });

    // ---------- Tickets ----------
    router.get('/tickets', async (req, res) => {
        const filtro = { guildId: req.guild.id, visibleWeb: true };
        if (req.query.estado === 'Abierto' || req.query.estado === 'Cerrado') filtro.estado = req.query.estado;
        const tickets = await Ticket.find(filtro).sort({ fechaCreacion: -1 }).limit(300).lean();
        const visibles = tickets.filter(t => req.permisos.admin || puedeAtender(req.member, req.config, buscarMotivo(req.config, t.motivoId || t.motivo)));
        res.json(visibles);
    });

    router.get('/tickets/:canalId', cargarTicket, (req, res) => res.json(req.ticket));

    router.get('/tickets/:canalId/mensajes', cargarTicket, async (req, res) => {
        const mensajes = await Mensaje.find({ ticketId: req.ticket.canalId }).sort({ fecha: 1 });
        res.json(await conImagenesVigentes(client, mensajes));
    });

    router.post('/tickets/:canalId/mensajes', cargarTicket, async (req, res) => {
        const contenido = texto(req.body?.contenido, 1900);
        if (!contenido) throw new HttpError(400, 'Mensaje vacío');
        if (req.ticket.estado === 'Cerrado') throw new HttpError(400, 'Este ticket está cerrado');
        const canal = client.channels.cache.get(req.ticket.canalId);
        if (!canal) throw new HttpError(410, 'El canal de este ticket ya no existe');

        await canal.send({ content: `**[${quien(req)}]** ${contenido}`, allowedMentions: { parse: [] } });
        const mensaje = await Mensaje.create({ ticketId: req.ticket.canalId, usuarioId: req.usuario.id, usuario: quien(req), contenido, desdeWeb: true });

        const ahora = new Date();
        const cambios = { ultimaInteractStaff: ahora };
        if (!req.ticket.primeraRespuestaStaff) cambios.primeraRespuestaStaff = ahora;
        await Ticket.updateOne({ _id: req.ticket._id }, { $set: cambios });
        res.json({ success: true, mensaje });
    });

    router.post('/tickets/:canalId/notas', cargarTicket, async (req, res) => {
        const contenido = texto(req.body?.contenido, 2000);
        if (!contenido) throw new HttpError(400, 'Nota vacía');
        const ticket = await Ticket.findOneAndUpdate(
            { _id: req.ticket._id },
            { $push: { notasInternas: { contenido, autor: quien(req), fecha: new Date() } } },
            { returnDocument: 'after' }
        );
        res.json({ success: true, ticket });
    });

    router.put('/tickets/:canalId/cerrar', cargarTicket, async (req, res) => {
        const r = await cerrarTicket(client, req.ticket.canalId, { autor: `${quien(req)} (web)`, avisarCanal: true });
        if (!r.ok) throw new HttpError(404, r.error);
        res.json({ success: true, ticket: r.ticket });
    });

    router.put('/tickets/:canalId/reabrir', cargarTicket, async (req, res) => {
        const r = await reabrirTicket(client, req.ticket.canalId, { autor: `${quien(req)} (web)` });
        if (!r.ok) throw new HttpError(404, r.error);
        res.json({ success: true, ticket: r.ticket });
    });

    router.put('/tickets/:canalId/ocultar', cargarTicket, async (req, res) => {
        const ticket = await Ticket.findOneAndUpdate({ _id: req.ticket._id }, { visibleWeb: false }, { returnDocument: 'after' });
        res.json({ success: true, ticket });
    });

    // ---------- IA para el staff ----------
    router.post('/tickets/:canalId/ia/:accion', cargarTicket, async (req, res) => {
        const acciones = ['resumen', 'sugerencia', 'traduccion', 'articulo'];
        if (!acciones.includes(req.params.accion)) throw new HttpError(404, 'Acción de IA desconocida');
        try {
            await ia.prepararIA(req.config);
            const mensajes = await Mensaje.find({ ticketId: req.ticket.canalId }).sort({ fecha: 1 }).lean();
            const ticket = req.ticket;
            let resultado;
            if (req.params.accion === 'resumen') resultado = await ia.resumirTicket({ ticket, mensajes });
            if (req.params.accion === 'sugerencia') {
                const articulos = await Articulo.find({ guildId: req.guild.id }).sort({ usos: -1 }).limit(40).lean();
                resultado = await ia.sugerirRespuesta({ ticket, mensajes, articulos, staffNombre: quien(req) });
            }
            if (req.params.accion === 'traduccion') resultado = await ia.traducirConversacion({ ticket, mensajes });
            if (req.params.accion === 'articulo') resultado = await ia.generarArticulo({ ticket, mensajes });
            res.json({ ...resultado, uso: ia.usoIA(await ServidorConfig.findOne({ guildId: req.guild.id }).lean()) });
        } catch (e) {
            if (e instanceof ia.IAError) {
                const status = { no_configurada: 503, desactivada: 403, sin_cupo: 402, limite: 429 }[e.codigo] || 502;
                return res.status(status).json({ error: e.message, codigo: e.codigo });
            }
            throw e;
        }
    });

    // ---------- Usuarios y logs ----------
    router.get('/usuarios/stats', async (req, res) => {
        const stats = await Ticket.aggregate([
            { $match: { guildId: req.guild.id } },
            { $sort: { fechaCreacion: -1 } },
            {
                $group: {
                    _id: '$creadorId',
                    nombre: { $first: '$creadorNombre' },
                    avatar: { $first: '$creadorAvatar' },
                    totalTickets: { $sum: 1 },
                    ticketsAbiertos: { $sum: { $cond: [{ $eq: ['$estado', 'Abierto'] }, 1, 0] } },
                    ratingTotal: { $sum: { $ifNull: ['$valoracionCSAT', 0] } },
                    ratingCount: { $sum: { $cond: [{ $gt: ['$valoracionCSAT', 0] }, 1, 0] } },
                    ultimoTicket: { $first: '$fechaCreacion' }
                }
            },
            {
                $project: {
                    nombre: 1, avatar: 1, totalTickets: 1, ticketsAbiertos: 1, ultimoTicket: 1,
                    ratingMedio: { $cond: [{ $eq: ['$ratingCount', 0] }, null, { $divide: ['$ratingTotal', '$ratingCount'] }] }
                }
            },
            { $sort: { totalTickets: -1 } },
            { $limit: 500 }
        ]);
        res.json(stats);
    });

    router.get('/logs', async (req, res) => {
        const limite = limitesDe(req.config).logs;
        const logs = await Log.find({ guildId: req.guild.id }).sort({ fecha: -1 }).limit(limite).lean();
        res.json({ logs, limite, esPremium: esPremium(req.config) });
    });

    // ---------- FAQ (base de conocimiento de la IA) ----------
    router.get('/faq', async (req, res) => {
        res.json(await Articulo.find({ guildId: req.guild.id }).sort({ usos: -1, fecha: -1 }).lean());
    });

    const datosArticulo = (body) => {
        const pregunta = texto(body?.pregunta, 300);
        const respuesta = texto(body?.respuesta, 4000);
        if (!pregunta || !respuesta) throw new HttpError(400, 'La pregunta y la respuesta son obligatorias');
        return { pregunta, respuesta };
    };

    router.post('/faq', async (req, res) => {
        const total = await Articulo.countDocuments({ guildId: req.guild.id });
        if (total >= 200) throw new HttpError(400, 'Máximo 200 artículos por servidor');
        const articulo = await Articulo.create({ guildId: req.guild.id, ...datosArticulo(req.body), creadoPor: quien(req) });
        res.json(articulo);
    });

    router.put('/faq/:id', async (req, res) => {
        if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Artículo no encontrado');
        const articulo = await Articulo.findOneAndUpdate({ _id: req.params.id, guildId: req.guild.id }, datosArticulo(req.body), { returnDocument: 'after' });
        if (!articulo) throw new HttpError(404, 'Artículo no encontrado');
        res.json(articulo);
    });

    router.delete('/faq/:id', async (req, res) => {
        if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Artículo no encontrado');
        await Articulo.deleteOne({ _id: req.params.id, guildId: req.guild.id });
        res.json({ success: true });
    });

    // ---------- Configuración (solo administradores) ----------
    router.get('/config', soloAdmin, (req, res) => res.json(req.config.toObject()));

    // Roles y canales del servidor para los desplegables del panel
    router.get('/discord', soloAdmin, (req, res) => {
        const ordenar = (a, b) => b.position - a.position;
        res.json({
            roles: [...req.guild.roles.cache.values()].filter(r => r.id !== req.guild.id && !r.managed).sort(ordenar)
                .map(r => ({ id: r.id, nombre: r.name, color: r.hexColor })),
            categorias: [...req.guild.channels.cache.values()].filter(c => c.type === ChannelType.GuildCategory)
                .sort((a, b) => a.position - b.position).map(c => ({ id: c.id, nombre: c.name })),
            canales: [...req.guild.channels.cache.values()].filter(c => c.type === ChannelType.GuildText)
                .sort((a, b) => a.rawPosition - b.rawPosition).map(c => ({ id: c.id, nombre: c.name }))
        });
    });

    const rolValido = (guild, id) => guild.roles.cache.has(id) && id !== guild.id;
    const categoriaValida = (guild, id) => (id && guild.channels.cache.get(id)?.type === ChannelType.GuildCategory) ? id : null;

    router.put('/config/equipo', soloAdmin, async (req, res) => {
        const b = req.body || {};
        const guild = req.guild;
        const config = req.config;
        config.rolesStaff = (Array.isArray(b.rolesStaff) ? b.rolesStaff : []).filter(id => rolValido(guild, id)).slice(0, 10);
        config.categoriaTicketsId = categoriaValida(guild, b.categoriaTicketsId);
        config.canalLogsId = (b.canalLogsId && guild.channels.cache.get(b.canalLogsId)?.isTextBased()) ? b.canalLogsId : null;
        config.mencionarStaff = b.mencionarStaff !== false;
        config.maxTicketsPorUsuario = entre(b.maxTicketsPorUsuario, 1, 10, 2);
        await config.save();
        await registrarLog(client, { guildId: guild.id, categoria: 'Configuración', accion: '⚙️ Equipo y canales actualizados', usuario: `${quien(req)} (web)`, color: '#5865F2' });
        res.json({ success: true, config });
    });

    router.put('/config/motivos', soloAdmin, async (req, res) => {
        const lista = req.body?.motivos;
        if (!Array.isArray(lista) || lista.length === 0 || lista.length > 25) throw new HttpError(400, 'Debe haber entre 1 y 25 tipos de ticket');
        const guild = req.guild;
        req.config.motivos = lista.map(m => {
            const nombre = texto(m.nombre, 100);
            if (!nombre) throw new HttpError(400, 'Todos los tipos de ticket necesitan nombre');
            const preguntas = (Array.isArray(m.preguntas) ? m.preguntas : []).slice(0, 5).map(p => ({
                etiqueta: texto(p.etiqueta, 45),
                placeholder: texto(p.placeholder, 100),
                estilo: p.estilo === 'corto' ? 'corto' : 'largo',
                requerida: p.requerida !== false,
                max: entre(p.max, 10, 4000, 1000)
            })).filter(p => p.etiqueta);
            const motivo = {
                nombre,
                emoji: texto(m.emoji, 64),
                descripcion: texto(m.descripcion, 100),
                urgencia: texto(m.urgencia, 50) || 'Normal',
                preguntas,
                rolesStaff: (Array.isArray(m.rolesStaff) ? m.rolesStaff : []).filter(id => rolValido(guild, id)).slice(0, 10),
                categoriaId: categoriaValida(guild, m.categoriaId)
            };
            if (m._id && mongoose.isValidObjectId(m._id)) motivo._id = m._id;
            return motivo;
        });
        // Los paneles solo pueden apuntar a tipos que existen
        const ids = new Set(req.config.motivos.map(m => String(m._id)));
        req.config.paneles.forEach(p => { p.motivos = p.motivos.filter(id => ids.has(String(id))); });
        await req.config.save();
        res.json({ success: true, config: req.config });
    });

    router.put('/config/urgencias', soloAdmin, async (req, res) => {
        const lista = req.body?.urgencias;
        if (!Array.isArray(lista) || lista.length === 0 || lista.length > 15) throw new HttpError(400, 'Debe haber entre 1 y 15 urgencias');
        req.config.urgencias = lista.map(u => ({
            nombre: texto(u.nombre, 50) || 'Normal',
            color: esColor(u.color) ? u.color : '#3498db',
            nivel: entre(u.nivel, 1, 1000, 1)
        }));
        await req.config.save();
        res.json({ success: true, config: req.config });
    });

    router.put('/config/paneles', soloAdmin, async (req, res) => {
        const lista = req.body?.paneles;
        if (!Array.isArray(lista) || lista.length === 0 || lista.length > 10) throw new HttpError(400, 'Debe haber entre 1 y 10 paneles');
        const idsMotivos = new Set(req.config.motivos.map(m => String(m._id)));
        req.config.paneles = lista.map(p => {
            const panel = {
                nombre: texto(p.nombre, 50) || 'Panel',
                titulo: texto(p.titulo, 256) || '🎫 Soporte',
                descripcion: texto(p.descripcion, 4000) || 'Pulsa el botón para abrir un ticket.',
                color: esColor(p.color) ? p.color : '#5865F2',
                textoBoton: texto(p.textoBoton, 80) || '📩 Abrir Ticket',
                motivos: (Array.isArray(p.motivos) ? p.motivos : []).map(String).filter(id => idsMotivos.has(id))
            };
            if (p._id && mongoose.isValidObjectId(p._id)) panel._id = p._id;
            return panel;
        });
        // Pie de página propio: solo Premium (en el plan gratis se muestra la marca Sokyo)
        if (esPremium(req.config) && typeof req.body.footer === 'string') req.config.footerPersonalizado = texto(req.body.footer, 200);
        await req.config.save();
        res.json({ success: true, config: req.config });
    });

    router.post('/paneles/:panelId/publicar', soloAdmin, async (req, res) => {
        const panel = buscarPanel(req.config, req.params.panelId);
        if (!panel) throw new HttpError(404, 'Panel no encontrado');
        const canal = req.guild.channels.cache.get(req.body?.canalId);
        if (!canal || !canal.isTextBased()) throw new HttpError(400, 'Elige un canal de texto');
        const P = PermissionsBitField.Flags;
        if (!canal.permissionsFor(req.guild.members.me)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks])) {
            throw new HttpError(400, `El bot no puede escribir en #${canal.name}`);
        }
        const mensaje = await canal.send(mensajePanel(req.config, panel, client));
        res.json({ success: true, url: mensaje.url });
    });

    router.put('/config/ia', soloAdmin, async (req, res) => {
        const b = req.body || {};
        req.config.ia.activada = b.activada !== false;
        req.config.ia.deflexion = b.deflexion !== false;
        req.config.ia.triaje = b.triaje !== false;
        await req.config.save();
        res.json({ success: true, ia: ia.usoIA(req.config) });
    });

    return router;
};
