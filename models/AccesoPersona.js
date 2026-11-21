const mongoose = require('mongoose');

// Acceso al panel dado a UNA persona (1.13.0), sin tener que crearle un rol: a qué áreas
// llega, si puede moderar y hasta cuándo (null = sin fecha). Lo dan los administradores
// en Configuración → Acceso al panel. Lo aplican guildsDelStaff, tieneAreaAcceso,
// /api/mis-permisos y puedeModerar (api/server.js) y utils/accesoPanel.js.
const AccesoPersonaSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    areas: { type: [String], default: [] },
    moderar: { type: Boolean, default: false },
    expiraEn: { type: Date, default: null },
    nota: { type: String, default: '' },
    creadoPor: { type: String, default: null },
    creadoPorNombre: { type: String, default: '' },
}, { timestamps: true });
AccesoPersonaSchema.index({ guildId: 1, userId: 1 }, { unique: true });
AccesoPersonaSchema.index({ userId: 1 });
AccesoPersonaSchema.index({ expiraEn: 1 });

module.exports = mongoose.model('AccesoPersona', AccesoPersonaSchema);
