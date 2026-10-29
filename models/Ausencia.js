const mongoose = require('mongoose');

// Modo ausente (/ausente): mientras dura, si alguien te menciona el bot le dice que
// no estás y por qué. Se quita solo al volver a escribir. Lógica en utils/ausente.js.
const AusenciaSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    motivo: { type: String, default: '' },
    desde: { type: Date, default: Date.now },
    apodoAnterior: { type: String, default: null }, // si el bot le puso «[Ausente]» delante
    menciones: { type: Number, default: 0 },        // cuánta gente le ha mencionado mientras
});

AusenciaSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Ausencia', AusenciaSchema);
