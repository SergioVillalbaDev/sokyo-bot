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

    // Dinámicas · Reto diario / racha (lo actualiza utils/dinamicas.js).
    retoDia: { type: String, default: '' },      // 'YYYY-MM-DD' del reto en curso
    retoConteo: { type: Number, default: 0 },    // mensajes contados hoy hacia el objetivo
    retoCompletado: { type: Boolean, default: false }, // ¿ya se llevó la recompensa hoy?
    retoRacha: { type: Number, default: 0 },     // días seguidos completando el reto

    // Dinámicas · Trivia (ranking semanal).
    triviaSemana: { type: String, default: '' }, // 'YYYY-Www' de la puntuación actual
    triviaPuntos: { type: Number, default: 0 },  // aciertos en la semana en curso
}, { timestamps: true });

ActividadUsuarioSchema.index({ guildId: 1, userId: 1 }, { unique: true });
ActividadUsuarioSchema.index({ guildId: 1, xp: -1 }); // para el ranking

module.exports = mongoose.model('ActividadUsuario', ActividadUsuarioSchema);
