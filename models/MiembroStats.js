const mongoose = require('mongoose');

// Estadísticas de crecimiento por miembro y servidor: XP/nivel e invitaciones.
const MiembroStatsSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },

    // Niveles
    xp: { type: Number, default: 0 },
    nivel: { type: Number, default: 0 },
    mensajes: { type: Number, default: 0 },

    // Invitaciones: a cuántos ha traído, cuántos de ellos se fueron, y quién lo invitó a él
    invitaciones: { type: Number, default: 0 },
    invitacionesSalidas: { type: Number, default: 0 },
    invitadoPor: { type: String, default: null }
});

MiembroStatsSchema.index({ guildId: 1, userId: 1 }, { unique: true });
MiembroStatsSchema.index({ guildId: 1, xp: -1 });
MiembroStatsSchema.index({ guildId: 1, invitaciones: -1 });

module.exports = mongoose.model('MiembroStats', MiembroStatsSchema);
