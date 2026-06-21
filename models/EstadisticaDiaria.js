const mongoose = require('mongoose');

// Foto diaria del servidor. Permite trazar histórico REAL (crecimiento de
// miembros, etc.) que no se puede reconstruir de los datos crudos (el conteo de
// miembros de días pasados no queda guardado en ningún otro sitio, y los
// mensajes tienen TTL). Se actualiza con upsert por {guildId, dia}.
const EstadisticaDiariaSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    dia: { type: String, required: true },        // 'YYYY-MM-DD' (UTC)
    fecha: { type: Date, default: Date.now },      // instante de la última actualización
    miembros: { type: Number, default: 0 },        // total de miembros (en vivo)
    mensajes: { type: Number, default: 0 },        // mensajes registrados ese día
    entradas: { type: Number, default: 0 },
    salidas: { type: Number, default: 0 },
    ticketsAbiertos: { type: Number, default: 0 },
    ticketsCerrados: { type: Number, default: 0 },
    sanciones: { type: Number, default: 0 },
    activos: { type: Number, default: 0 },          // miembros que escribieron ese día
});

EstadisticaDiariaSchema.index({ guildId: 1, dia: 1 }, { unique: true });

module.exports = mongoose.model('EstadisticaDiaria', EstadisticaDiariaSchema);
