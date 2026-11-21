// Actividad del staff (1.13.0): quién atiende tickets, cuánto tarda en dar la primera
// respuesta, qué valoración recibe y cuántas sanciones pone, en los últimos X días.
// Lo enseña Datos → Actividad del staff (GET /api/config/:guildId/staff/actividad).
const Ticket = require('../models/Ticket.js');
const Mensaje = require('../models/Mensaje.js');
const Sancion = require('../models/Sancion.js');

const SNOWFLAKE = /^\d{17,20}$/;

// Junta las cifras por persona (pura: la prueban los tests).
// `tickets`: [{ canalId, creadorId, asignadoA, estado, fechaCreacion, valoracionCSAT }]
// `mensajes`: [{ ticketId, usuarioId, fecha }] ordenados por fecha.
// `sanciones`: [{ moderadorId, accion }]
function resumir({ tickets = [], mensajes = [], sanciones = [] }) {
    const porId = new Map();
    const de = (id) => {
        if (!porId.has(id)) porId.set(id, { userId: id, atendidos: 0, cerrados: 0, mensajes: 0, primeras: 0, sumaPrimeraMs: 0, valoraciones: 0, sumaValoracion: 0, sanciones: { aviso: 0, timeout: 0, expulsion: 0, ban: 0 } });
        return porId.get(id);
    };
    const porTicket = new Map(tickets.map((t) => [t.canalId, t]));
    const yaRespondido = new Set();
    for (const t of tickets) {
        if (!t.asignadoA || !SNOWFLAKE.test(t.asignadoA)) continue;
        const p = de(t.asignadoA);
        p.atendidos++;
        if (t.estado === 'Cerrado') p.cerrados++;
        if (t.valoracionCSAT > 0) { p.valoraciones++; p.sumaValoracion += t.valoracionCSAT; }
    }
    for (const m of mensajes) {
        const t = porTicket.get(m.ticketId);
        if (!t || !SNOWFLAKE.test(m.usuarioId) || m.usuarioId === t.creadorId) continue;
        const p = de(m.usuarioId);
        p.mensajes++;
        // La primera respuesta de alguien que no es quien abrió el ticket.
        if (!yaRespondido.has(m.ticketId)) {
            yaRespondido.add(m.ticketId);
            p.primeras++;
            p.sumaPrimeraMs += Math.max(0, new Date(m.fecha) - new Date(t.fechaCreacion));
        }
    }
    for (const s of sanciones) {
        if (!s.moderadorId || !SNOWFLAKE.test(s.moderadorId)) continue;
        const p = de(s.moderadorId);
        if (p.sanciones[s.accion] !== undefined) p.sanciones[s.accion]++;
    }
    return [...porId.values()].map((p) => {
        const totalSanciones = Object.values(p.sanciones).reduce((a, b) => a + b, 0);
        return {
            userId: p.userId,
            tickets: {
                atendidos: p.atendidos, cerrados: p.cerrados, mensajes: p.mensajes,
                primeraRespuestaMin: p.primeras ? Math.round(p.sumaPrimeraMs / p.primeras / 60000) : null,
                valoracion: p.valoraciones ? Math.round((p.sumaValoracion / p.valoraciones) * 10) / 10 : null,
            },
            sanciones: { total: totalSanciones, ...p.sanciones },
            // Puntos para ordenar: atender y responder pesa más que sancionar.
            puntos: p.atendidos * 5 + p.mensajes + p.primeras * 3 + totalSanciones * 2,
        };
    }).sort((a, b) => b.puntos - a.puntos);
}

async function calcular(guild, dias = 30) {
    const desde = new Date(Date.now() - dias * 24 * 3600 * 1000);
    const tickets = await Ticket.find({ guildId: guild.id, fechaCreacion: { $gte: desde } })
        .select('canalId creadorId asignadoA estado fechaCreacion valoracionCSAT').limit(5000).lean();
    const mensajes = tickets.length
        ? await Mensaje.find({ ticketId: { $in: tickets.map((t) => t.canalId) } }).select('ticketId usuarioId fecha').sort({ fecha: 1 }).limit(50000).lean()
        : [];
    const sanciones = await Sancion.find({ guildId: guild.id, fecha: { $gte: desde } }).select('moderadorId accion').limit(20000).lean();
    const filas = resumir({ tickets, mensajes, sanciones });
    const staff = [];
    for (const f of filas.slice(0, 50)) {
        const m = guild.members.cache.get(f.userId) || await guild.members.fetch(f.userId).catch(() => null);
        if (m?.user?.bot) continue;
        const alto = m?.roles?.highest;
        staff.push({
            ...f,
            nombre: m ? m.displayName : f.userId,
            usuario: m ? m.user.username : '',
            avatar: m ? m.displayAvatarURL({ size: 128, extension: 'png' }) : null,
            rolPrincipal: alto && alto.id !== guild.id ? { nombre: alto.name, color: alto.hexColor } : null,
            enServidor: !!m,
        });
    }
    // Tickets en los que nadie del staff ha escrito (una sola pasada por los mensajes).
    const creador = new Map(tickets.map((t) => [t.canalId, t.creadorId]));
    const respondidos = new Set(mensajes.filter((m) => SNOWFLAKE.test(m.usuarioId) && m.usuarioId !== creador.get(m.ticketId)).map((m) => m.ticketId));
    const sinRespuesta = tickets.length - respondidos.size;
    return {
        dias,
        staff,
        totales: { tickets: tickets.length, sinRespuesta, sanciones: sanciones.length },
    };
}

module.exports = { resumir, calcular };
