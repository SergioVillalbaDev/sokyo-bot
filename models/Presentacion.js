const mongoose = require('mongoose');

// Comunidad · Presentación. Cuando un nuevo miembro rellena el formulario de
// presentación (modal disparado al entrar), se guardan sus respuestas. Los
// filtros configurados pueden descartar/marcar la presentación automáticamente.
const RespuestaSchema = new mongoose.Schema({
    pregunta: { type: String, default: '' },
    respuesta: { type: String, default: '' },
}, { _id: false });

const PresentacionSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    autorId: { type: String, default: null },
    autor: { type: String, default: '' },
    respuestas: { type: [RespuestaSchema], default: [] },
    descartada: { type: Boolean, default: false },     // un filtro la descartó
    motivoDescarte: { type: String, default: '' },
    procesada: { type: Boolean, default: false },      // ya revisada / publicada al staff
    creadoFecha: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Presentacion', PresentacionSchema);
