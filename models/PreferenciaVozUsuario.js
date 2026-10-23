const mongoose = require('mongoose');

// Preferencias de canal de voz temporal de un usuario (función Pro). Cuando un
// servidor de pago crea la sala de alguien, le aplica estas preferencias para
// que su canal salga "como le gusta" sin tener que reconfigurarlo cada vez.
const PreferenciaVozUsuarioSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },

    nombre: { type: String, default: null },      // null = usar la plantilla del generador
    limite: { type: Number, default: null },      // null = usar el del generador
    bloqueado: { type: Boolean, default: false }, // nace bloqueada
    oculto: { type: Boolean, default: false },    // nace oculta
    permitidos: { type: [String], default: [] },  // usuarios con acceso garantizado
    bloqueados: { type: [String], default: [] },  // usuarios vetados de su sala
});

// Una preferencia por usuario y servidor.
PreferenciaVozUsuarioSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('PreferenciaVozUsuario', PreferenciaVozUsuarioSchema);
