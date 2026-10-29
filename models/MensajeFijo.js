const mongoose = require('mongoose');

// Mensaje fijo abajo: el bot lo vuelve a publicar al final del canal cada vez que
// alguien escribe, para que siempre se vea (normas, cómo pedir ayuda…). Uno por
// canal. Lógica en utils/mensajesFijos.js.
const MensajeFijoSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    canalId: { type: String, required: true },
    titulo: { type: String, default: '' },
    texto: { type: String, default: '' },
    color: { type: String, default: '#a855f7' },
    comoEmbed: { type: Boolean, default: true },
    activo: { type: Boolean, default: true },
    ultimoMensajeId: { type: String, default: null }, // el que está publicado ahora
    creadoPor: { type: String, default: '' },
}, { timestamps: true });

MensajeFijoSchema.index({ guildId: 1, canalId: 1 }, { unique: true });

module.exports = mongoose.model('MensajeFijo', MensajeFijoSchema);
