const mongoose = require('mongoose');

// Cada cofre abierto (para las estadísticas del panel y las «últimas aperturas»).
const AperturaCofreSchema = new mongoose.Schema({
    guildId: { type: String, default: null },
    userId: { type: String, required: true },
    cofre: { type: String, required: true },
    companero: { type: String, required: true },
    rareza: { type: String, required: true },
    fecha: { type: Date, default: Date.now },
});
AperturaCofreSchema.index({ guildId: 1, fecha: -1 });
AperturaCofreSchema.index({ rareza: 1 });
AperturaCofreSchema.index({ fecha: 1 }, { expireAfterSeconds: 180 * 24 * 3600 });

module.exports = mongoose.model('AperturaCofre', AperturaCofreSchema);
