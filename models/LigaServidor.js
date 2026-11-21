const mongoose = require('mongoose');

// Puntos de un servidor en la Liga Sokyo en un mes (1.14.0). Se suman por los
// votos de sus miembros, el oro que gastan en impulsarlo y los combates de su
// mascota. Al acabar el mes, el podio sale destacado. Lógica en utils/liga.js.
const LigaServidorSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    mes: { type: String, required: true },       // 'YYYY-MM'
    puntos: { type: Number, default: 0 },
    votos: { type: Number, default: 0 },         // puntos por votos
    impulsos: { type: Number, default: 0 },      // puntos por oro
    combates: { type: Number, default: 0 },      // puntos por combates
    posicion: { type: Number, default: null },   // al cerrar el mes
    destacadoHasta: { type: Date, default: null },
});

LigaServidorSchema.index({ guildId: 1, mes: 1 }, { unique: true });
LigaServidorSchema.index({ mes: 1, puntos: -1 });
LigaServidorSchema.index({ destacadoHasta: 1 });

module.exports = mongoose.model('LigaServidor', LigaServidorSchema);
