const mongoose = require('mongoose');

// «Recordarme votar» (1.11.0, /votar recordar): quien lo pide recibe un privado cuando
// puede volver a votar en top.gg (12 h después de su último voto). Lo envía utils/votos.js.
const RecordatorioVotoSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    activo: { type: Boolean, default: true },
    proximoAviso: { type: Date, default: null, index: true },
});

module.exports = mongoose.model('RecordatorioVoto', RecordatorioVotoSchema);
