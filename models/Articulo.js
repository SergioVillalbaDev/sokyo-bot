const mongoose = require('mongoose');

// Base de conocimiento: artículos que el bot sugiere antes de abrir un ticket.
const articuloSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    titulo: { type: String, required: true },
    palabras: { type: [String], default: [] },           // palabras clave que disparan la sugerencia
    contenido: { type: String, required: true },
    creadoPor: { type: String, default: 'Desconocido' },
    visitas: { type: Number, default: 0 },
    fecha: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Articulo', articuloSchema);
