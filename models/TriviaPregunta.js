const mongoose = require('mongoose');

// Dinámicas · Trivia. Banco de preguntas de un servidor. Cada pregunta tiene
// varias opciones y el índice de la correcta. El bot lanza una al día (o por
// comando) con botones; los aciertos dan XP y suman al ranking semanal
// (campos trivia* de ActividadUsuario). Se crean/borran desde el panel.
const TriviaPreguntaSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    pregunta: { type: String, required: true },
    opciones: { type: [String], default: [] },       // 2-4 opciones
    correcta: { type: Number, default: 0 },           // índice de la opción correcta
    categoria: { type: String, default: '' },         // etiqueta opcional
    vecesUsada: { type: Number, default: 0 },         // para rotar y no repetir
    creadoPor: { type: String, default: 'Panel Web' },
    creadoFecha: { type: Date, default: Date.now },
});

module.exports = mongoose.model('TriviaPregunta', TriviaPreguntaSchema);
