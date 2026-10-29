const mongoose = require('mongoose');

// Solicitudes (por ejemplo, para entrar al staff): alguien rellena el formulario
// desde Discord y el staff la acepta (el bot le da el rol) o la rechaza, desde
// Discord o desde el panel. Lógica en utils/solicitudes.js.
const SolicitudSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    formularioId: { type: String, required: true },
    formularioNombre: { type: String, default: '' },
    userId: { type: String, required: true },
    userTag: { type: String, default: '' },
    respuestas: { type: [{ pregunta: String, respuesta: String, _id: false }], default: [] },
    estado: { type: String, enum: ['pendiente', 'aceptada', 'rechazada'], default: 'pendiente' },
    motivo: { type: String, default: '' },              // por qué se rechaza (se le manda)
    revisadoPor: { type: String, default: null },
    revisionCanalId: { type: String, default: null },
    revisionMensajeId: { type: String, default: null },
    fecha: { type: Date, default: Date.now },
    fechaRevision: { type: Date, default: null },
});

SolicitudSchema.index({ guildId: 1, estado: 1, fecha: -1 });
SolicitudSchema.index({ guildId: 1, userId: 1, formularioId: 1, fecha: -1 });

module.exports = mongoose.model('Solicitud', SolicitudSchema);
