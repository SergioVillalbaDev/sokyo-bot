const mongoose = require('mongoose');

// Resumen de actividad de un usuario en un servidor (último mensaje, conteo,
// última vez en voz). Se va actualizando con los eventos en tiempo real.
const ActividadUsuarioSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    usuarioTag: { type: String, default: null },

    // Mensajes
    mensajesTotal: { type: Number, default: 0 },
    ultimoMensajeFecha: { type: Date, default: null },
    ultimoMensajeCanalId: { type: String, default: null },
    ultimoMensajeTexto: { type: String, default: null },

    // Voz
    ultimaVozFecha: { type: Date, default: null },
    ultimaVozCanalId: { type: String, default: null },

    // Niveles / XP
    xp: { type: Number, default: 0 },
    nivel: { type: Number, default: 0 },
    ultimoXp: { type: Date, default: null }, // cooldown para no farmear XP con spam
}, { timestamps: true });

ActividadUsuarioSchema.index({ guildId: 1, userId: 1 }, { unique: true });
ActividadUsuarioSchema.index({ guildId: 1, xp: -1 }); // para el ranking

module.exports = mongoose.model('ActividadUsuario', ActividadUsuarioSchema);
