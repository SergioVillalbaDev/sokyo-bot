// Ficha de una persona en un servidor: lo justo para decidir rápido (desde
// cuándo está, roles, nivel, sanciones y tickets). La usan el clic derecho
// «Ver ficha» en Discord y la ficha rápida del panel (al pasar el ratón).
const Sancion = require('../models/Sancion.js');
const Ticket = require('../models/Ticket.js');
const ActividadUsuario = require('../models/ActividadUsuario.js');

async function fichaMiembro(client, guildId, userId) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return null;
    const member = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null);
    const user = member ? member.user : await client.users.fetch(userId).catch(() => null);
    if (!user) return null;
    const ahora = Date.now();
    const [sanciones, tickets, actividad] = await Promise.all([
        Sancion.find({ guildId, usuarioId: userId }).sort({ fecha: -1 }).limit(50).lean().catch(() => []),
        Ticket.find({ guildId, creadorId: userId }).select('estado').lean().catch(() => []),
        ActividadUsuario.findOne({ guildId, userId }).lean().catch(() => null),
    ]);
    const roles = member
        ? member.roles.cache.filter((r) => r.id !== guild.id).sort((a, b) => b.position - a.position)
        : null;
    return {
        id: user.id,
        username: user.username,
        displayName: member ? member.displayName : (user.globalName || user.username),
        avatar: user.displayAvatarURL({ size: 128 }),
        bot: !!user.bot,
        enServidor: !!member,
        esDueno: guild.ownerId === user.id,
        unidoEn: member ? member.joinedTimestamp : null,
        creadoEn: user.createdTimestamp,
        aisladoHasta: member && (member.communicationDisabledUntilTimestamp || 0) > ahora ? member.communicationDisabledUntilTimestamp : null,
        roles: roles ? roles.first(5).map((r) => ({ id: r.id, nombre: r.name, color: r.hexColor })) : [],
        totalRoles: roles ? roles.size : 0,
        nivel: actividad ? actividad.nivel || 0 : 0,
        xp: actividad ? actividad.xp || 0 : 0,
        mensajes: actividad ? actividad.mensajesTotal || 0 : 0,
        sanciones: {
            total: sanciones.length,
            activas: sanciones.filter((s) => s.activa && !s.revocada).length,
            ultimas: sanciones.slice(0, 3).map((s) => ({ accion: s.accion, motivo: s.motivo || '', fecha: s.fecha, revocada: !!s.revocada })),
        },
        tickets: { total: tickets.length, abiertos: tickets.filter((x) => x.estado !== 'Cerrado').length },
    };
}

module.exports = { fichaMiembro };
