const mongoose = require('mongoose');

// ============================================================================
// Embudo de Bienvenida · Test A/B de retención.
// Una ficha por cada usuario que entra mientras el embudo A/B está activo.
// Al entrar se le asigna una variante (50/50) y aquí se va anotando su recorrido:
// si se le mostró el onboarding, si se verificó, si participó (primer mensaje)
// y si sigue en el servidor. La analítica compara las dos variantes con esto.
// ============================================================================
const EmbudoCohorteSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    usuarioTag: { type: String, default: null },

    // Variante asignada al entrar: 'A' (reglas en texto + captcha) o 'B' (embed visual).
    variante: { type: String, enum: ['A', 'B'], required: true },
    // Cómo se le entregó el onboarding: panel (botón en canal) o md (mensaje directo).
    entrega: { type: String, enum: ['panel', 'md'], default: 'panel' },
    mostrado: { type: Boolean, default: false }, // ¿se le llegó a mostrar la variante? (un MD puede fallar)

    fechaEntrada: { type: Date, default: Date.now },

    // Hitos del embudo
    verificado: { type: Boolean, default: false },        // completó el onboarding (consiguió el rol)
    fechaVerificado: { type: Date, default: null },
    participo: { type: Boolean, default: false },         // mandó su primer mensaje
    fechaPrimerMensaje: { type: Date, default: null },

    // Retención
    sigueEnServidor: { type: Boolean, default: true },
    fechaSalida: { type: Date, default: null },
}, { timestamps: true });

EmbudoCohorteSchema.index({ guildId: 1, userId: 1 }, { unique: true });
EmbudoCohorteSchema.index({ guildId: 1, variante: 1 });
EmbudoCohorteSchema.index({ guildId: 1, fechaEntrada: 1 });

module.exports = mongoose.model('EmbudoCohorte', EmbudoCohorteSchema);
