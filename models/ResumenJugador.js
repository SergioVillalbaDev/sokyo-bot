const mongoose = require('mongoose');

// Resumen diario por privado (1.34.0, utils/resumenJugador.js): quien lo pide en /menu recibe una vez al día, en cada
// servidor donde lo active, lo que tiene listo (granja, diario, huevos, jefe…). Solo si hay algo que hacer.
const ResumenJugadorSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    activo: { type: Boolean, default: true },
    hora: { type: Number, default: 17 },       // hora UTC a partir de la cual se manda
    ultimo: { type: String, default: null },   // día (YYYY-MM-DD) del último enviado o revisado
});
ResumenJugadorSchema.index({ guildId: 1, userId: 1 }, { unique: true });
ResumenJugadorSchema.index({ activo: 1, ultimo: 1 });

module.exports = mongoose.model('ResumenJugador', ResumenJugadorSchema);
