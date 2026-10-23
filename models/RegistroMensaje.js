const mongoose = require('mongoose');

// Registro de mensajes de los usuarios (para el "historial" de moderación).
// Cada documento lleva su propia fecha de expiración (expiraEn): el índice TTL
// con expireAfterSeconds:0 borra el documento cuando esa fecha pasa. Así la
// retención es variable: 30 días (free) o 90 días (premium), fijada al insertar.
const RegistroMensajeSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    usuarioTag: { type: String, default: null },
    canalId: { type: String, default: null },
    contenido: { type: String, default: '' },
    fecha: { type: Date, default: Date.now },
    expiraEn: { type: Date, required: true },
});

RegistroMensajeSchema.index({ guildId: 1, userId: 1, fecha: -1 });
RegistroMensajeSchema.index({ expiraEn: 1 }, { expireAfterSeconds: 0 }); // TTL variable

module.exports = mongoose.model('RegistroMensaje', RegistroMensajeSchema);
