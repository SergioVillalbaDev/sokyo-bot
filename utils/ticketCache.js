// Caché en memoria de los canales de tickets ABIERTOS. Sustituye a detectar tickets por el nombre
// del canal ("ticket-..."), que fallaba al renombrar y confundía canales normales con ese prefijo.
const Ticket = require('../models/Ticket.js');

const abiertos = new Set();
let cargada = false;

async function cargar() {
    const lista = await Ticket.find({ estado: { $ne: 'Cerrado' } }).select('canalId').lean();
    abiertos.clear();
    lista.forEach(t => abiertos.add(t.canalId));
    cargada = true;
}

const agregar = (canalId) => abiertos.add(canalId);
const quitar = (canalId) => abiertos.delete(canalId);

// Si la caché aún no se ha cargado (arranque), consulta a la base de datos.
async function esTicketAbierto(canalId) {
    if (cargada) return abiertos.has(canalId);
    return !!(await Ticket.exists({ canalId, estado: { $ne: 'Cerrado' } }));
}

module.exports = { cargar, agregar, quitar, esTicketAbierto };
