const mongoose = require('mongoose');

// Lo que cada miembro hace por la mascota de su servidor en un mes: puntos de
// cuidado (ranking y «Cuidador del mes») y sus esperas. Lógica en utils/mascota.js.
const CuidadoMascotaSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    mes: { type: String, required: true },            // 'YYYY-MM'
    puntos: { type: Number, default: 0 },
    oro: { type: Number, default: 0 },                // oro dado de comer este mes
    ultimaCaricia: { type: Date, default: null },
    ultimoJuego: { type: Date, default: null },
    ultimoEntreno: { type: Date, default: null },
    ultimaCharla: { type: Date, default: null },
});

CuidadoMascotaSchema.index({ guildId: 1, userId: 1, mes: 1 }, { unique: true });
CuidadoMascotaSchema.index({ guildId: 1, mes: 1, puntos: -1 });

module.exports = mongoose.model('CuidadoMascota', CuidadoMascotaSchema);
