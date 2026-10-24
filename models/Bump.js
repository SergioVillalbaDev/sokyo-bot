const mongoose = require('mongoose');

// Crecimiento · Registro de cada bump de Disboard hecho en un servidor (para el
// ranking de quién más ayuda a posicionarlo). Lógica en utils/bump.js.
const BumpSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, default: null },
    canalId: { type: String, default: null },
    fecha: { type: Date, default: Date.now },
});

BumpSchema.index({ guildId: 1, fecha: -1 });
BumpSchema.index({ guildId: 1, userId: 1 });

module.exports = mongoose.model('Bump', BumpSchema);
