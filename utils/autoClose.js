// Cierre automático de tickets por inactividad.
// Recorre los servidores con autoCierreDias > 0 y cierra los tickets abiertos
// cuyo último mensaje (o fecha de creación si no hay) supere ese umbral.
const Ticket = require('../models/Ticket.js');
const Mensaje = require('../models/Mensaje.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { cerrarTicket } = require('./ticketManager.js');

async function revisarAutoCierre(client) {
    try {
        const configs = await ServidorConfig.find({ autoCierreDias: { $gt: 0 } });
        for (const cfg of configs) {
            const limite = Date.now() - cfg.autoCierreDias * 24 * 60 * 60 * 1000;
            const tickets = await Ticket.find({ guildId: cfg.guildId, estado: 'Abierto' });
            for (const t of tickets) {
                const ultimoMsg = await Mensaje.findOne({ ticketId: t.canalId }).sort({ fecha: -1 });
                const referencia = (ultimoMsg && ultimoMsg.fecha) || t.fechaCreacion;
                if (referencia && new Date(referencia).getTime() < limite) {
                    console.log(`⏳ Auto-cierre por inactividad: ticket de ${t.creadorNombre} (${cfg.autoCierreDias}d)`);
                    await cerrarTicket(client, t.canalId, { autor: 'Sistema (inactividad)', avisarCanal: true });
                }
            }
        }
    } catch (e) {
        console.error('Error en el barrido de auto-cierre:', e);
    }
}

// Arranca el barrido: una primera pasada a los 30s y luego cada `intervaloMs`.
function iniciarAutoCierre(client, intervaloMs = 60 * 60 * 1000) {
    setTimeout(() => revisarAutoCierre(client), 30 * 1000);
    setInterval(() => revisarAutoCierre(client), intervaloMs);
}

module.exports = { revisarAutoCierre, iniciarAutoCierre };
