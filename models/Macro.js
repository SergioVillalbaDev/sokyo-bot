const mongoose = require('mongoose');

// Respuestas rápidas del staff. Placeholders: {usuario} {staff} {ticket} {servidor}
const macroSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    nombre: { type: String, required: true },            // identificador corto (minúsculas, sin espacios)
    titulo: { type: String, default: '' },
    contenido: { type: String, required: true },
    creadoPor: { type: String, default: 'Desconocido' },
    usos: { type: Number, default: 0 },
    fecha: { type: Date, default: Date.now }
});
macroSchema.index({ guildId: 1, nombre: 1 }, { unique: true });

module.exports = mongoose.model('Macro', macroSchema);
