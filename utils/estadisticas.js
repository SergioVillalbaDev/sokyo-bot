// Consultas de estadísticas compartidas por los comandos de Discord y el panel web.
const Ticket = require('../models/Ticket.js');

const ZONA_HORARIA = process.env.TZ || 'Europe/Madrid';
const DIA_MS = 24 * 60 * 60 * 1000;

// Resumen general de un servidor (dashboard del panel y /estadisticas).
async function resumenServidor(guildId, { dias = 14 } = {}) {
    const ahora = Date.now();
    const desdeGrafica = new Date(ahora - (dias - 1) * DIA_MS);
    desdeGrafica.setHours(0, 0, 0, 0);
    const hace30 = new Date(ahora - 30 * DIA_MS);
    const hace7 = new Date(ahora - 7 * DIA_MS);

    const [resultado] = await Ticket.aggregate([
        { $match: { guildId } },
        {
            $facet: {
                contadores: [{
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        abiertos: { $sum: { $cond: [{ $eq: ['$estado', 'Abierto'] }, 1, 0] } },
                        sinAsignar: { $sum: { $cond: [{ $and: [{ $eq: ['$estado', 'Abierto'] }, { $not: ['$asignadoA'] }] }, 1, 0] } },
                        esperandoStaff: { $sum: { $cond: [{ $and: [{ $eq: ['$estado', 'Abierto'] }, { $eq: ['$esperando', 'staff'] }] }, 1, 0] } },
                        ultimos7: { $sum: { $cond: [{ $gte: ['$fechaCreacion', hace7] }, 1, 0] } },
                        valoracionMedia: { $avg: '$valoracionCSAT' },
                        valoraciones: { $sum: { $cond: [{ $gt: ['$valoracionCSAT', 0] }, 1, 0] } }
                    }
                }],
                tiempos: [
                    { $match: { fechaCreacion: { $gte: hace30 } } },
                    {
                        $group: {
                            _id: null,
                            primeraRespuesta: { $avg: { $cond: [{ $gt: ['$primeraRespuestaStaff', null] }, { $subtract: ['$primeraRespuestaStaff', '$fechaCreacion'] }, null] } },
                            resolucion: { $avg: { $cond: [{ $and: [{ $eq: ['$estado', 'Cerrado'] }, { $gt: ['$fechaCierre', null] }] }, { $subtract: ['$fechaCierre', '$fechaCreacion'] }, null] } }
                        }
                    }
                ],
                abiertosPorDia: [
                    { $match: { fechaCreacion: { $gte: desdeGrafica } } },
                    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$fechaCreacion', timezone: ZONA_HORARIA } }, n: { $sum: 1 } } }
                ],
                cerradosPorDia: [
                    { $match: { fechaCierre: { $gte: desdeGrafica } } },
                    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$fechaCierre', timezone: ZONA_HORARIA } }, n: { $sum: 1 } } }
                ],
                porCategoria: [
                    { $group: { _id: '$motivo', total: { $sum: 1 }, abiertos: { $sum: { $cond: [{ $eq: ['$estado', 'Abierto'] }, 1, 0] } } } },
                    { $sort: { total: -1 } },
                    { $limit: 6 }
                ],
                porStaff: [
                    { $match: { asignadoA: { $ne: null } } },
                    {
                        $group: {
                            _id: '$asignadoA',
                            nombre: { $last: '$asignadoNombre' },
                            atendidos: { $sum: 1 },
                            abiertos: { $sum: { $cond: [{ $eq: ['$estado', 'Abierto'] }, 1, 0] } },
                            valoracionMedia: { $avg: '$valoracionCSAT' }
                        }
                    },
                    { $sort: { atendidos: -1 } },
                    { $limit: 5 }
                ]
            }
        }
    ]);

    const contadores = resultado.contadores[0] || { total: 0, abiertos: 0, sinAsignar: 0, esperandoStaff: 0, ultimos7: 0, valoracionMedia: null, valoraciones: 0 };
    const tiempos = resultado.tiempos[0] || {};
    const abiertosDia = new Map(resultado.abiertosPorDia.map(d => [d._id, d.n]));
    const cerradosDia = new Map(resultado.cerradosPorDia.map(d => [d._id, d.n]));

    const formato = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit' });
    const porDia = [];
    for (let i = dias - 1; i >= 0; i--) {
        const fecha = formato.format(new Date(ahora - i * DIA_MS)); // YYYY-MM-DD
        porDia.push({ fecha, abiertos: abiertosDia.get(fecha) || 0, cerrados: cerradosDia.get(fecha) || 0 });
    }

    return {
        total: contadores.total,
        abiertos: contadores.abiertos,
        cerrados: contadores.total - contadores.abiertos,
        sinAsignar: contadores.sinAsignar,
        esperandoStaff: contadores.esperandoStaff,
        ultimos7: contadores.ultimos7,
        valoracionMedia: contadores.valoracionMedia,
        valoraciones: contadores.valoraciones,
        primeraRespuestaMediaMs: tiempos.primeraRespuesta ?? null,
        resolucionMediaMs: tiempos.resolucion ?? null,
        porDia,
        porCategoria: resultado.porCategoria.map(c => ({ motivo: c._id || 'Sin categoría', total: c.total, abiertos: c.abiertos })),
        porStaff: resultado.porStaff.map(s => ({ id: s._id, nombre: s.nombre, atendidos: s.atendidos, abiertos: s.abiertos, valoracionMedia: s.valoracionMedia }))
    };
}

// Una fila por usuario que ha abierto tickets (pestaña "Usuarios" del panel).
async function estadisticasUsuarios(guildId) {
    return Ticket.aggregate([
        { $match: { guildId } },
        { $sort: { fechaCreacion: -1 } },
        {
            $group: {
                _id: '$creadorId',
                nombre: { $first: '$creadorNombre' },
                avatar: { $first: '$creadorAvatar' }, // ordenado: el avatar de su ticket más reciente
                totalTickets: { $sum: 1 },
                ticketsAbiertos: { $sum: { $cond: [{ $eq: ['$estado', 'Abierto'] }, 1, 0] } },
                ratingMedio: { $avg: '$valoracionCSAT' },
                valoraciones: { $sum: { $cond: [{ $gt: ['$valoracionCSAT', 0] }, 1, 0] } },
                ultimoTicket: { $first: '$fechaCreacion' }
            }
        },
        { $sort: { totalTickets: -1, ultimoTicket: -1 } }
    ]);
}

// Estadísticas de un usuario concreto (/usuario).
async function estadisticasUsuario(guildId, usuarioId) {
    const tickets = await Ticket.find({ guildId, creadorId: usuarioId }).sort({ fechaCreacion: -1 }).lean();
    const valorados = tickets.filter(t => t.valoracionCSAT);
    return {
        total: tickets.length,
        abiertos: tickets.filter(t => t.estado === 'Abierto').length,
        cerrados: tickets.filter(t => t.estado === 'Cerrado').length,
        valoracionMedia: valorados.length ? valorados.reduce((s, t) => s + t.valoracionCSAT, 0) / valorados.length : null,
        ultimo: tickets[0] || null
    };
}

function formatoDuracion(ms) {
    if (ms == null) return '—';
    const min = Math.round(ms / 60000);
    if (min < 1) return 'menos de 1 min';
    if (min < 60) return `${min} min`;
    const horas = Math.floor(min / 60);
    if (horas < 48) return `${horas} h ${min % 60} min`;
    return `${Math.floor(horas / 24)} días ${horas % 24} h`;
}

module.exports = { resumenServidor, estadisticasUsuarios, estadisticasUsuario, formatoDuracion };
