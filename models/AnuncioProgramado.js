const mongoose = require('mongoose');

// Anuncio programado: un mensaje (texto y/o embed) que el bot publica en un canal
// a una fecha/hora concreta. Puede repetirse a diario o semanalmente.
const AnuncioProgramadoSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    canalId: { type: String, required: true },
    contenido: { type: String, default: '' },                         // texto fuera del embed
    embed: { type: mongoose.Schema.Types.Mixed, default: null },       // config del embed (o null)
    fechaEnvio: { type: Date, required: true, index: true },           // próximo (o único) envío
    repetir: { type: String, enum: ['no', 'diario', 'semanal'], default: 'no' },
    enviado: { type: Boolean, default: false },                        // true cuando ya se envió (no recurrente)
    creadoPor: { type: String, default: '' },
    creadoFecha: { type: Date, default: Date.now },
});

module.exports = mongoose.model('AnuncioProgramado', AnuncioProgramadoSchema);
