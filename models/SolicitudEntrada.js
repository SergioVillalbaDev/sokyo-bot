const mongoose = require('mongoose');

// Verificación con aprobación del staff (1.9.13): quien termina la verificación (y
// las preguntas al entrar, si las hay) queda a la espera hasta que el staff la
// acepta (se le dan los roles y el de acceso) o la rechaza (privado con el motivo).
// utils/preguntasEntrada.js.
const SolicitudEntradaSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    userTag: { type: String, default: '' },
    origen: { type: String, default: 'verif' },               // 'verif' | 'embudo' (de dónde sale el rol de acceso)
    respuestas: { type: mongoose.Schema.Types.Mixed, default: {} }, // { preguntaId: [opcionIds] }
    resumen: { type: [{ pregunta: String, respuesta: String, _id: false }], default: [] },
    estado: { type: String, enum: ['pendiente', 'revisando', 'aceptada', 'rechazada'], default: 'pendiente', index: true },
    revisandoDesde: { type: Date, default: null }, // una revisión que se queda a medias (reinicio) se libera sola
    motivo: { type: String, default: '' },
    revisadaPor: { type: String, default: '' },
    revisadaFecha: { type: Date, default: null },
    canalId: { type: String, default: null },   // aviso al staff (para actualizarlo al revisar)
    mensajeId: { type: String, default: null },
    fecha: { type: Date, default: Date.now },
});

module.exports = mongoose.model('SolicitudEntrada', SolicitudEntradaSchema);
