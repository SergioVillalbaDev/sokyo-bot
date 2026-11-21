const mongoose = require('mongoose');

// Programa de referidos (1.10.0, utils/referidos.js).
// · `tipo: 'codigo'`: el código de quien recomienda Sokyo y el servidor que se lleva el premio.
// · `tipo: 'canje'`: un servidor nuevo que usó un código. Pasa a `premiado` si sigue con el
//   bot y tiene gente a los 7 días; a `anulado` si se va o no llega a tiempo.
const ReferidoSchema = new mongoose.Schema({
    tipo: { type: String, enum: ['codigo', 'canje'], required: true },
    codigo: { type: String, required: true },
    referidorId: { type: String, required: true, index: true },
    destinoGuildId: { type: String, default: null },        // codigo: servidor que recibe los días Premium
    guildId: { type: String, default: null },               // canje: servidor nuevo
    canjeadoPor: { type: String, default: null },
    estado: { type: String, enum: ['activo', 'pendiente', 'premiado', 'anulado'], default: 'activo' },
    motivo: { type: String, default: '' },
    premio: { type: String, default: '' },                  // qué se dio («7 días Premium» / «oro»)
    fecha: { type: Date, default: Date.now },
    resueltoEn: { type: Date, default: null },
});
ReferidoSchema.index({ codigo: 1 }, { unique: true, partialFilterExpression: { tipo: 'codigo' } });
ReferidoSchema.index({ tipo: 1, referidorId: 1 });
// Un servidor solo puede canjear un código una vez.
ReferidoSchema.index({ guildId: 1 }, { unique: true, partialFilterExpression: { tipo: 'canje' } });

module.exports = mongoose.model('Referido', ReferidoSchema);
