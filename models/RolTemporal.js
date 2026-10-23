const mongoose = require('mongoose');

// Un rol temporal pendiente de expirar. Un barredor periódico (en ready.js)
// busca los que ya vencieron y se los quita al usuario.
const RolTemporalSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    roleId: { type: String, required: true },
    expiraEn: { type: Date, required: true },
});

// Índice para barrer rápido los vencidos.
RolTemporalSchema.index({ expiraEn: 1 });

module.exports = mongoose.model('RolTemporal', RolTemporalSchema);
