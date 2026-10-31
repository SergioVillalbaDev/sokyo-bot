// Artículo de la base de conocimiento (FAQ) de un servidor.
// La IA lo usa para responder antes de que se abra un ticket.
const mongoose = require('mongoose');

const articuloSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    pregunta: { type: String, required: true },
    respuesta: { type: String, required: true },
    usos: { type: Number, default: 0 },
    creadoPor: { type: String, default: null },
    fecha: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Articulo', articuloSchema);
