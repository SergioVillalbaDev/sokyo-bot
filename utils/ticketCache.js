// Conjunto en memoria con los IDs de canal que son tickets.
// Evita consultar la base de datos por cada mensaje que se escribe en el servidor.
const Ticket = require('../models/Ticket.js');

const canales = new Set();

async function cargarCanalesTicket() {
    const ids = await Ticket.distinct('canalId', { canalEliminado: { $ne: true } });
    canales.clear();
    ids.forEach(id => canales.add(id));
    return canales.size;
}

const esCanalTicket = (canalId) => canales.has(canalId);
const registrarCanalTicket = (canalId) => canales.add(canalId);
const olvidarCanalTicket = (canalId) => canales.delete(canalId);

module.exports = { cargarCanalesTicket, esCanalTicket, registrarCanalTicket, olvidarCanalTicket };
