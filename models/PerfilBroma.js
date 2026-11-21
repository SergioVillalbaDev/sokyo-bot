const mongoose = require('mongoose');

// Lo de cada miembro en las bromas de un servidor: su escudo, si no quiere jugar
// (y entonces tampoco puede gastarlas) y sus números. Lógica en utils/bromas.js.
const PerfilBromaSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    escudoHasta: { type: Date, default: null },
    fuera: { type: Boolean, default: false },   // no quiere bromas (ni recibirlas ni gastarlas)
    ultimaBroma: { type: Date, default: null }, // la última que gastó (para la espera)
    gastadas: { type: Number, default: 0 },
    recibidas: { type: Number, default: 0 },
    devueltas: { type: Number, default: 0 },
});

PerfilBromaSchema.index({ guildId: 1, userId: 1 }, { unique: true });
PerfilBromaSchema.index({ guildId: 1, gastadas: -1 });

module.exports = mongoose.model('PerfilBroma', PerfilBromaSchema);
