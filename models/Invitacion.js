const mongoose = require('mongoose');

// Crecimiento · Entrada de un miembro y quién le invitó. Un documento por persona
// y servidor: si alguien sale y vuelve, se reutiliza (así nadie cuenta dos veces).
// La lógica vive en utils/invitaciones.js.
//  estado:
//   - pendiente: acaba de entrar; cuenta cuando siga dentro pasado `confirmarEn`.
//   - valida:    confirmada; ya dio sus recompensas a quien invitó.
//   - salio:     se fue antes de confirmarse (no cuenta).
//   - falsa:     cuenta de Discord demasiado nueva (no cuenta nunca).
const InvitacionSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    invitadoId: { type: String, required: true },
    invitadoTag: { type: String, default: '' },
    invitadorId: { type: String, default: null },     // null = no se sabe (descubrimiento, vanity, web…)
    invitadorTag: { type: String, default: '' },
    codigo: { type: String, default: null },
    fuente: { type: String, enum: ['invitacion', 'vanity', 'web', 'desconocida'], default: 'desconocida' },
    estado: { type: String, enum: ['pendiente', 'valida', 'salio', 'falsa'], default: 'pendiente' },
    fechaEntrada: { type: Date, default: Date.now },
    confirmarEn: { type: Date, default: null },
    fechaConfirmada: { type: Date, default: null },
    seFue: { type: Date, default: null },             // salió del servidor (en cualquier estado)
    cuentaCreada: { type: Date, default: null },
});

InvitacionSchema.index({ guildId: 1, invitadoId: 1 }, { unique: true });
InvitacionSchema.index({ guildId: 1, invitadorId: 1, estado: 1 });
InvitacionSchema.index({ estado: 1, confirmarEn: 1 });
InvitacionSchema.index({ guildId: 1, fechaEntrada: -1 });

module.exports = mongoose.model('Invitacion', InvitacionSchema);
