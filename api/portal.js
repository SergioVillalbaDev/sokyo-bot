// Rutas del Portal del Cliente: /api/portal/...
// Cada usuario (sesión de Discord) solo ve los tickets que abrió o a los que le invitaron.
const express = require('express');
const Ticket = require('../models/Ticket.js');
const Mensaje = require('../models/Mensaje.js');
const { obtenerConfig } = require('../utils/config.js');
const { refrescarAdjuntos } = require('../utils/adjuntos.js');
const { registrarLog } = require('../utils/logger.js');
const {
    TicketError, COLORES, etiquetaTicket, motivosDe, crearTicket, cerrarTicket, enviarMensajeWeb, ticketsAbiertosDe
} = require('../utils/ticketManager.js');
const { limitador, obtenerMiembro, infoServidor } = require('./middleware.js');

// Lo que el usuario NUNCA debe ver: notas internas del staff y metadatos del panel.
const CAMPOS_PRIVADOS = '-notasInternas -visibleWeb -mensajeControlId';

const filtroAcceso = (usuarioId) => ({
    $or: [{ creadorId: usuarioId }, { participantes: { $elemMatch: { id: usuarioId, rol: 'Invitado' } } }]
});

module.exports = (client) => {
    const router = express.Router();
    const limitarMensajes = limitador({ ventanaMs: 10 * 1000, max: 5 });
    const limitarTickets = limitador({ ventanaMs: 10 * 60 * 1000, max: 5 });

    const conServidor = (ticket) => {
        const guild = client.guilds.cache.get(ticket.guildId);
        return { ...ticket, servidor: guild ? { nombre: guild.name, icono: guild.iconURL({ extension: 'png', size: 64 }) } : null };
    };

    async function buscarTicket(req) {
        const ticket = await Ticket.findOne({ canalId: req.params.canalId, ...filtroAcceso(req.auth.usuario.id) });
        if (!ticket) throw new TicketError('No se encontró el ticket.', 404);
        return ticket;
    }

    // Servidores donde el usuario puede abrir tickets (es miembro y el bot está).
    router.get('/servidores', async (req, res) => {
        const resultado = [];
        for (const guild of client.guilds.cache.values()) {
            if (!(await obtenerMiembro(guild, req.auth.usuario.id))) continue;
            const config = await obtenerConfig(guild.id);
            const abiertos = await ticketsAbiertosDe(client, guild, req.auth.usuario.id);
            resultado.push({
                ...infoServidor(guild),
                motivos: motivosDe(config).map(m => ({ nombre: m.nombre, urgencia: m.urgencia })),
                maxTickets: config.maxTicketsPorUsuario || 1,
                abiertos: abiertos.length
            });
        }
        res.json(resultado);
    });

    router.get('/tickets', async (req, res) => {
        const tickets = await Ticket.find(filtroAcceso(req.auth.usuario.id))
            .select(CAMPOS_PRIVADOS).sort({ fechaCreacion: -1 }).limit(200).lean();
        res.json(tickets.map(conServidor));
    });

    router.post('/tickets', limitarTickets, async (req, res) => {
        const { guildId, motivo, asunto, descripcion } = req.body || {};
        const guild = client.guilds.cache.get(String(guildId || ''));
        if (!guild) throw new TicketError('Ese servidor no existe o el bot ya no está en él.', 404);
        const miembro = await obtenerMiembro(guild, req.auth.usuario.id);
        if (!miembro) throw new TicketError('Tienes que ser miembro del servidor para abrir un ticket.', 403);
        if (!String(asunto || '').trim()) throw new TicketError('Escribe un asunto.', 400);
        if (!String(descripcion || '').trim()) throw new TicketError('Describe tu problema.', 400);

        const { ticket } = await crearTicket(client, {
            guild,
            usuario: { id: miembro.id, username: miembro.user.username, avatar: miembro.user.displayAvatarURL({ extension: 'png', size: 128 }) },
            motivo: String(motivo || ''),
            asunto: String(asunto).slice(0, 100),
            descripcion: String(descripcion).slice(0, 1500),
            origen: 'portal'
        });
        const limpio = await Ticket.findById(ticket._id).select(CAMPOS_PRIVADOS).lean();
        res.status(201).json(conServidor(limpio));
    });

    router.get('/tickets/:canalId', async (req, res) => {
        const ticket = await buscarTicket(req);
        const limpio = await Ticket.findById(ticket._id).select(CAMPOS_PRIVADOS).lean();
        res.json(conServidor(limpio));
    });

    router.get('/tickets/:canalId/mensajes', async (req, res) => {
        await buscarTicket(req);
        // Los mensajes borrados en Discord no se muestran al usuario.
        const mensajes = await Mensaje.find({ ticketId: req.params.canalId, borrado: { $ne: true } })
            .select('-mensajeId').sort({ fecha: 1 });
        res.json(await refrescarAdjuntos(client, mensajes));
    });

    router.post('/tickets/:canalId/mensajes', limitarMensajes, async (req, res) => {
        const ticket = await buscarTicket(req);
        const mensaje = await enviarMensajeWeb(client, ticket, {
            autor: req.auth.usuario, contenido: req.body?.contenido, origen: 'portal', esStaff: false
        });
        res.status(201).json(mensaje);
    });

    router.put('/tickets/:canalId/cerrar', limitarMensajes, async (req, res) => {
        const ticket = await buscarTicket(req);
        if (ticket.creadorId !== req.auth.usuario.id) throw new TicketError('Solo quien abrió el ticket puede cerrarlo.', 403);
        await cerrarTicket(client, ticket.canalId, {
            autor: req.auth.usuario.username, autorId: req.auth.usuario.id, motivo: req.body?.motivo || 'Cerrado por el usuario desde el portal'
        });
        res.json(conServidor(await Ticket.findById(ticket._id).select(CAMPOS_PRIVADOS).lean()));
    });

    router.post('/tickets/:canalId/valoracion', limitarMensajes, async (req, res) => {
        const ticket = await buscarTicket(req);
        if (ticket.creadorId !== req.auth.usuario.id) throw new TicketError('Solo quien abrió el ticket puede valorarlo.', 403);
        if (ticket.estado !== 'Cerrado') throw new TicketError('Podrás valorar el ticket cuando se cierre.', 409);

        const valoracion = Number(req.body?.valoracion);
        if (!Number.isInteger(valoracion) || valoracion < 1 || valoracion > 5) throw new TicketError('La valoración debe ser de 1 a 5 estrellas.', 400);
        const comentario = String(req.body?.comentario || '').trim().slice(0, 500) || null;

        const actualizado = await Ticket.findByIdAndUpdate(
            ticket._id,
            { $set: { valoracionCSAT: valoracion, comentarioCSAT: comentario } },
            { returnDocument: 'after' }
        ).select(CAMPOS_PRIVADOS).lean();
        await registrarLog(client, {
            guildId: ticket.guildId, categoria: 'Tickets', accion: `⭐ Ticket Valorado (${valoracion}/5)`,
            usuario: ticket.creadorNombre, usuarioId: ticket.creadorId, color: COLORES.valorado,
            detalles: `Ticket ${etiquetaTicket(ticket)}: **${ticket.titulo || ticket.motivo}** (desde el portal)`
        });
        res.json(conServidor(actualizado));
    });

    return router;
};
