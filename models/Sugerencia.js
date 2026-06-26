const mongoose = require('mongoose');

// Comunidad · Sugerencia. Cuando un miembro escribe en el canal de sugerencias
// configurado, el bot transforma el mensaje en un embed con botones 👍/👎 y
// guarda este documento. El staff gestiona el estado desde el panel.
const SugerenciaSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    canalId: { type: String, default: null },
    mensajeId: { type: String, default: null },        // embed publicado por el bot
    autorId: { type: String, default: null },
    autor: { type: String, default: '' },              // tag para mostrar en el panel
    texto: { type: String, required: true },
    votos_pos: { type: Number, default: 0 },
    votos_neg: { type: Number, default: 0 },
    votantes_pos: { type: [String], default: [] },
    votantes_neg: { type: [String], default: [] },
    estado: { type: String, enum: ['pendiente', 'revision', 'aceptada', 'rechazada'], default: 'pendiente' },
    creadoFecha: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Sugerencia', SugerenciaSchema);
