// Rutas del panel del staff: /api/servidores/:guildId/...
// Llegan ya autenticadas y con req.guild comprobado (ver staffDeServidor).
const express = require('express');
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const Ticket = require('../models/Ticket.js');
const Mensaje = require('../models/Mensaje.js');
const Log = require('../models/Log.js');
const { obtenerConfig, actualizarConfig } = require('../utils/config.js');
const { refrescarAdjuntos } = require('../utils/adjuntos.js');
const { resumenServidor, estadisticasUsuarios } = require('../utils/estadisticas.js');
const { generarTranscriptHtml, nombreTranscript } = require('../utils/transcript.js');
const { publicarPanel, actualizarPanelPublicado } = require('../utils/panelSoporte.js');
const {
    TicketError, cerrarTicket, reabrirTicket, asignarTicket, cambiarPrioridad, enviarMensajeWeb, sincronizarRolStaff
} = require('../utils/ticketManager.js');
const { validarCambiosConfig, afectaAlPanel } = require('./validacion.js');
const { limitador, infoServidor } = require('./middleware.js');

const LIMITE_LOGS = { gratis: 50, premium: 150 };
const CATEGORIAS_LOG = ['Tickets', 'Mensajes Borrados', 'Mensajes Editados', 'Entradas', 'Salidas'];
const escaparRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = (client) => {
    const router = express.Router({ mergeParams: true });
    const limitarEscritura = limitador({ ventanaMs: 10 * 1000, max: 8 });

    // Quién firma las acciones: el usuario de Discord, o "Administrador" con la clave de API.
    const autor = (req) => ({ autor: req.auth.usuario.username, autorId: req.auth.usuario.id });
    const perfilAutor = (req) => req.auth.tipo === 'discord'
        ? req.auth.usuario
        : { id: 'sokyo-web', username: 'Soporte', avatar: client.user.displayAvatarURL({ extension: 'png', size: 128 }) };

    // Siempre filtrando por servidor: el staff de un servidor no puede tocar tickets de otro.
    async function buscarTicket(req) {
        const ticket = await Ticket.findOne({ canalId: req.params.canalId, guildId: req.guild.id });
        if (!ticket) throw new TicketError('No se encontró el ticket.', 404);
        return ticket;
    }

    const conCanal = (ticket) => ({ ...ticket.toObject(), canalExiste: client.channels.cache.has(ticket.canalId) });

    // ------------------------------------------------------- servidor y config

    router.get('/', async (req, res) => {
        const config = await obtenerConfig(req.guild.id);
        res.json({ servidor: infoServidor(req.guild), config: { ...config.toObject(), premiumActivo: config.premiumActivo() } });
    });

    // Roles y canales del servidor, para los desplegables de la configuración.
    router.get('/discord', (req, res) => {
        const porPosicion = (a, b) => a.rawPosition - b.rawPosition;
        const roles = req.guild.roles.cache
            .filter(r => r.id !== req.guild.id)
            .sort((a, b) => b.position - a.position)
            .map(r => ({ id: r.id, nombre: r.name, color: r.hexColor, gestionado: r.managed }));
        const canales = req.guild.channels.cache;
        const me = req.guild.members.me;
        res.json({
            roles,
            categorias: canales.filter(c => c.type === ChannelType.GuildCategory).sort(porPosicion).map(c => ({ id: c.id, nombre: c.name })),
            canales: canales
                .filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement)
                .sort(porPosicion)
                .map(c => ({
                    id: c.id,
                    nombre: c.name,
                    categoria: c.parent?.name || null,
                    puedoEscribir: Boolean(c.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]))
                }))
        });
    });

    router.put('/config', async (req, res) => {
        const actual = await obtenerConfig(req.guild.id);
        const cambios = validarCambiosConfig(req.body, req.guild, actual);
        const config = await actualizarConfig(req.guild.id, cambios);

        if (cambios.rolesStaff) {
            const antes = new Set(actual.rolesStaff || []);
            const despues = new Set(cambios.rolesStaff);
            const sincronizar = (rolId, conceder) => sincronizarRolStaff(client, req.guild.id, rolId, conceder)
                .catch(e => console.warn('Sincronizando rol de staff:', e.message));
            cambios.rolesStaff.filter(id => !antes.has(id)).forEach(id => sincronizar(id, true));
            [...antes].filter(id => !despues.has(id)).forEach(id => sincronizar(id, false));
        }

        const panelActualizado = afectaAlPanel(cambios) ? await actualizarPanelPublicado(client, config) : null;
        res.json({ config: { ...config.toObject(), premiumActivo: config.premiumActivo() }, panelActualizado });
    });

    // Publica (o vuelve a publicar) el panel de soporte en un canal.
    router.post('/panel', limitarEscritura, async (req, res) => {
        const canal = req.guild.channels.cache.get(String(req.body?.canalId || ''));
        if (!canal || !canal.isTextBased() || canal.isThread()) throw new TicketError('Elige un canal de texto válido.', 400);
        if (!canal.permissionsFor(req.guild.members.me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
            throw new TicketError(`El bot no puede escribir en #${canal.name}.`, 403);
        }
        const mensaje = await publicarPanel(canal, await obtenerConfig(req.guild.id));
        res.json({ ok: true, canalId: canal.id, mensajeId: mensaje.id, url: mensaje.url });
    });

    // ---------------------------------------------------------------- resumen

    router.get('/resumen', async (req, res) => {
        res.json(await resumenServidor(req.guild.id, { dias: 14 }));
    });

    // ---------------------------------------------------------------- tickets

    router.get('/tickets', async (req, res) => {
        const filtro = { guildId: req.guild.id, visibleWeb: req.query.ocultos === '1' ? false : { $ne: false } };
        if (req.query.estado === 'Abierto' || req.query.estado === 'Cerrado') filtro.estado = req.query.estado;

        const q = String(req.query.q || '').trim().slice(0, 80);
        if (q) {
            const regex = new RegExp(escaparRegex(q), 'i');
            const condiciones = [{ titulo: regex }, { creadorNombre: regex }, { motivo: regex }, { descripcion: regex }, { asignadoNombre: regex }];
            const numero = parseInt(q.replace(/^#/, ''), 10);
            if (/^#?\d+$/.test(q) && numero > 0) condiciones.push({ numero });
            filtro.$or = condiciones;
        }

        const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 300, 1), 1000);
        const tickets = await Ticket.find(filtro).select('-notasInternas').sort({ fechaCreacion: -1 }).limit(limite).lean();
        res.json(tickets.map(t => ({ ...t, canalExiste: client.channels.cache.has(t.canalId) })));
    });

    router.get('/tickets/:canalId', async (req, res) => {
        res.json(conCanal(await buscarTicket(req)));
    });

    router.get('/tickets/:canalId/mensajes', async (req, res) => {
        await buscarTicket(req);
        const mensajes = await Mensaje.find({ ticketId: req.params.canalId }).sort({ fecha: 1 });
        res.json(await refrescarAdjuntos(client, mensajes));
    });

    router.post('/tickets/:canalId/mensajes', limitarEscritura, async (req, res) => {
        const ticket = await buscarTicket(req);
        const mensaje = await enviarMensajeWeb(client, ticket, {
            autor: perfilAutor(req), contenido: req.body?.contenido, origen: 'panel', esStaff: true
        });
        res.status(201).json(mensaje);
    });

    router.post('/tickets/:canalId/notas', limitarEscritura, async (req, res) => {
        await buscarTicket(req);
        const contenido = String(req.body?.contenido || '').trim();
        if (!contenido) throw new TicketError('La nota está vacía.', 400);
        if (contenido.length > 1000) throw new TicketError('La nota no puede superar los 1000 caracteres.', 400);

        const ticket = await Ticket.findOneAndUpdate(
            { canalId: req.params.canalId, guildId: req.guild.id },
            { $push: { notasInternas: { contenido, autor: req.auth.usuario.username, autorId: req.auth.usuario.id, fecha: new Date() } } },
            { returnDocument: 'after' }
        );
        res.status(201).json(conCanal(ticket));
    });

    router.delete('/tickets/:canalId/notas/:notaId', async (req, res) => {
        await buscarTicket(req);
        const ticket = await Ticket.findOneAndUpdate(
            { canalId: req.params.canalId, guildId: req.guild.id, 'notasInternas._id': req.params.notaId },
            { $pull: { notasInternas: { _id: req.params.notaId } } },
            { returnDocument: 'after' }
        ).catch(() => null);
        if (!ticket) throw new TicketError('No se encontró la nota.', 404);
        res.json(conCanal(ticket));
    });

    router.put('/tickets/:canalId/cerrar', limitarEscritura, async (req, res) => {
        await buscarTicket(req);
        res.json(conCanal(await cerrarTicket(client, req.params.canalId, { ...autor(req), motivo: req.body?.motivo })));
    });

    router.put('/tickets/:canalId/reabrir', limitarEscritura, async (req, res) => {
        await buscarTicket(req);
        res.json(conCanal(await reabrirTicket(client, req.params.canalId, autor(req))));
    });

    router.put('/tickets/:canalId/asignacion', limitarEscritura, async (req, res) => {
        await buscarTicket(req);
        const accion = req.body?.accion;
        if (accion === 'reclamar') {
            if (req.auth.tipo !== 'discord') throw new TicketError('Inicia sesión con Discord para reclamar tickets.', 400);
            return res.json(conCanal(await asignarTicket(client, req.params.canalId, { staff: req.auth.usuario, ...autor(req), soloSiLibre: true })));
        }
        if (accion === 'liberar') return res.json(conCanal(await asignarTicket(client, req.params.canalId, { staff: null, ...autor(req) })));
        throw new TicketError('Acción no válida.', 400);
    });

    router.put('/tickets/:canalId/prioridad', limitarEscritura, async (req, res) => {
        await buscarTicket(req);
        res.json(conCanal(await cambiarPrioridad(client, req.params.canalId, String(req.body?.prioridad || ''), autor(req))));
    });

    router.put('/tickets/:canalId/visibilidad', async (req, res) => {
        await buscarTicket(req);
        const ticket = await Ticket.findOneAndUpdate(
            { canalId: req.params.canalId, guildId: req.guild.id },
            { $set: { visibleWeb: Boolean(req.body?.visible) } },
            { returnDocument: 'after' }
        );
        res.json(conCanal(ticket));
    });

    router.get('/tickets/:canalId/transcript', async (req, res) => {
        const ticket = await buscarTicket(req);
        const mensajes = await refrescarAdjuntos(client, await Mensaje.find({ ticketId: ticket.canalId }).sort({ fecha: 1 }));
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.set('Content-Disposition', `attachment; filename="${nombreTranscript(ticket, 'html')}"`);
        res.send(generarTranscriptHtml(ticket, mensajes, { nombreServidor: req.guild.name }));
    });

    // --------------------------------------------------------- usuarios y logs

    router.get('/usuarios', async (req, res) => {
        res.json(await estadisticasUsuarios(req.guild.id));
    });

    router.get('/logs', async (req, res) => {
        const config = await obtenerConfig(req.guild.id);
        const esPremium = config.premiumActivo();
        const limite = esPremium ? LIMITE_LOGS.premium : LIMITE_LOGS.gratis;

        const filtro = { guildId: req.guild.id };
        if (CATEGORIAS_LOG.includes(req.query.categoria)) filtro.categoria = req.query.categoria;
        const q = String(req.query.q || '').trim().slice(0, 80);
        if (q) {
            const regex = new RegExp(escaparRegex(q), 'i');
            filtro.$or = [{ usuario: regex }, { accion: regex }, { detalles: regex }];
        }

        const logs = await Log.find(filtro).sort({ fecha: -1 }).limit(limite).lean();
        res.json({ logs, limite, esPremium });
    });

    return router;
};
