// Trabajos automáticos de tickets, ejecutados cada pocos minutos:
//  · SLA: avisa al staff cuando un usuario lleva demasiado tiempo esperando respuesta.
//  · Inactividad: avisa al usuario que no contesta y, si sigue sin hacerlo, cierra el ticket.
const Ticket = require('../models/Ticket.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { cerrarTicket } = require('./ticketManager.js');
const { formatDuracion } = require('./helpers.js');

const HORA = 3_600_000;

async function procesarGuild(client, config, ahora = Date.now()) {
    const auto = config.automatizacion || {};
    const abiertos = await Ticket.find({ guildId: config.guildId, estado: 'Abierto' });

    for (const t of abiertos) {
        const canal = client.channels.cache.get(t.canalId);
        if (!canal) continue;
        const ultimo = (t.ultimoMensajeFecha || t.fechaCreacion).getTime();

        // --- SLA: el usuario espera al staff ---
        if (auto.slaActivo && t.ultimoMensajePor !== 'staff' && !t.slaAvisado && ahora - ultimo > (auto.slaHoras || 4) * HORA) {
            const menciones = t.asignadoA ? `<@${t.asignadoA}>` : (config.tickets?.rolStaffId ? `<@&${config.tickets.rolStaffId}>` : '');
            await canal.send(`⏰ ${menciones} Este ticket lleva **${formatDuracion(ahora - ultimo)}** esperando respuesta del equipo.`).catch(() => {});
            await Ticket.updateOne({ canalId: t.canalId }, { $set: { slaAvisado: true } });
            continue;
        }

        // --- Inactividad: el staff respondió y el usuario no contesta ---
        if (auto.inactividadActiva && t.ultimoMensajePor === 'staff') {
            if (!t.inactividadAvisadaEn && ahora - ultimo > (auto.avisoHoras || 24) * HORA) {
                await canal.send(`⌛ <@${t.creadorId}>, ¿sigues ahí? Si no respondes, este ticket se cerrará automáticamente en **${auto.cierreHoras || 24} h**. Escribe cualquier mensaje para mantenerlo abierto.`).catch(() => {});
                await Ticket.updateOne({ canalId: t.canalId }, { $set: { inactividadAvisadaEn: new Date() } });
            } else if (t.inactividadAvisadaEn && ahora - t.inactividadAvisadaEn.getTime() > (auto.cierreHoras || 24) * HORA) {
                await canal.send('🔒 Cerrando este ticket por inactividad.').catch(() => {});
                await cerrarTicket(client, t.canalId, { autor: 'Sistema (inactividad)' });
            }
        }
    }
}

async function ejecutarCiclo(client) {
    try {
        const configs = await ServidorConfig.find({ $or: [{ 'automatizacion.inactividadActiva': true }, { 'automatizacion.slaActivo': true }] });
        for (const c of configs) await procesarGuild(client, c);
    } catch (error) { console.error('Error en el ciclo de automatización:', error); }
}

let temporizador = null;
function iniciar(client, cadaMs = 5 * 60_000) {
    if (temporizador) return;
    temporizador = setInterval(() => ejecutarCiclo(client), cadaMs);
    temporizador.unref?.();
}

module.exports = { iniciar, ejecutarCiclo, procesarGuild };
