const mongoose = require('mongoose');

// Registro de la verificación (1.9.15): quién se ha verificado, a quién ha aceptado o
// rechazado el staff, quién ha fallado el captcha, a quién se ha frenado por los
// requisitos y a quién se ha expulsado por no verificarse. Lo enseña el panel
// (Verificación → Registro, con las cifras de la semana) y se borra solo a los 90 días.
// utils/puertaEntrada.js.
const RegistroEntradaSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    userTag: { type: String, default: '' },
    // verificado | pendiente | aceptado | rechazado | manual | captcha_fallido | castigado | bloqueado | expulsado
    tipo: { type: String, required: true },
    detalle: { type: String, default: '' }, // p. ej. 'edad', 'avatar', 'espera', quién revisó, el motivo…
    fecha: { type: Date, default: Date.now },
});
RegistroEntradaSchema.index({ guildId: 1, fecha: -1 });
RegistroEntradaSchema.index({ fecha: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

module.exports = mongoose.model('RegistroEntrada', RegistroEntradaSchema);
