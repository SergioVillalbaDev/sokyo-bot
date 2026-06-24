const mongoose = require('mongoose');

// Una "plantilla" de sanción que diseña el admin: p. ej. "Ban 7 días", "Aviso",
// "Aislar 1h". Define qué acción aplica y con qué parámetros. Desde el Centro de
// Mando, cada tipo es un botón que se aplica al usuario seleccionado.
const TipoSancionSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    nombre: { type: String, required: true },

    // Qué hace en Discord: aviso (solo registro), timeout (aislar), expulsion (kick) o ban.
    accion: { type: String, enum: ['aviso', 'timeout', 'expulsion', 'ban'], default: 'aviso' },

    duracionMin: { type: Number, default: 0 },          // timeout y ban temporal (0 = permanente)
    borrarMensajesHoras: { type: Number, default: 0 },  // solo ban: horas de mensajes a borrar (0–168)

    // Apariencia del botón en el panel.
    color: { type: String, default: '#ef4444' },
    emoji: { type: String, default: null },
    descripcion: { type: String, default: null },
    orden: { type: Number, default: 0 },
}, { timestamps: true });

// Los tipos de sanción se cargan por servidor (Centro de Mando y panel).
TipoSancionSchema.index({ guildId: 1, orden: 1 });

module.exports = mongoose.model('TipoSancion', TipoSancionSchema);
