const mongoose = require('mongoose');

// Recordatorio personal creado con !remind. El bot avisa al usuario en el canal
// (o por MD si el canal ya no existe) cuando llega la fecha.
const RecordatorioSchema = new mongoose.Schema({
    guildId: { type: String, default: null },
    canalId: { type: String, required: true },
    userId: { type: String, required: true },
    userTag: { type: String, default: '' },
    mensaje: { type: String, default: '' },
    fechaAviso: { type: Date, required: true, index: true },
    avisado: { type: Boolean, default: false },
    creadoFecha: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Recordatorio', RecordatorioSchema);
