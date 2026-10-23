const mongoose = require('mongoose');

// Comunidad · Encuesta. Se crea desde el panel, el bot la publica con botones de
// voto y el scheduler la cierra al llegar fechaFin (edita el mensaje con el
// resultado final). Los votos se guardan por opción + un set de votantes para
// evitar duplicados (y permitir cambiar el voto si no es múltiple).
const OpcionSchema = new mongoose.Schema({
    texto: { type: String, required: true },
    votos: { type: Number, default: 0 },
    votantes: { type: [String], default: [] }, // userIds que votaron esta opción
}, { _id: false });

const EncuestaSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    canalId: { type: String, required: true },
    mensajeId: { type: String, default: null }, // mensaje publicado (para editar/cerrar)
    pregunta: { type: String, required: true },
    opciones: { type: [OpcionSchema], default: [] },
    multiple: { type: Boolean, default: false },   // permite votar varias opciones
    anonima: { type: Boolean, default: false },    // no mostrar quién votó
    activa: { type: Boolean, default: true },
    fechaFin: { type: Date, required: true, index: true },
    creadoPor: { type: String, default: 'Panel Web' },
    creadoFecha: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Encuesta', EncuestaSchema);
