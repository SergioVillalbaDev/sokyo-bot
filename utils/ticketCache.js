// Conjunto en memoria con los IDs de canal que son tickets.
// Sustituye a la detección por nombre ("ticket-...") para saber qué mensajes guardar.
const Ticket = require('../models/Ticket.js');

const canales = new Set();

async function cargar() {
    const ids = await Ticket.distinct('canalId', { canalBorrado: { $ne: true } });
    ids.forEach(id => canales.add(id));
    return canales.size;
}

module.exports = {
    cargar,
    tiene: (id) => canales.has(id),
    agregar: (id) => canales.add(id),
    quitar: (id) => canales.delete(id)
};
