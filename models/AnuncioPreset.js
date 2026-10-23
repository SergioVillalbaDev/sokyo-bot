const mongoose = require('mongoose');

// Preset de anuncio: un mensaje guardado (texto y/o embed) para reutilizar al
// instante o al programar un anuncio. Si `embed` es null, es solo texto.
const AnuncioPresetSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    nombre: { type: String, required: true },
    contenido: { type: String, default: '' },                    // texto fuera del embed
    embed: { type: mongoose.Schema.Types.Mixed, default: null }, // config del embed (o null = solo texto)
    creadoFecha: { type: Date, default: Date.now },
});

module.exports = mongoose.model('AnuncioPreset', AnuncioPresetSchema);
