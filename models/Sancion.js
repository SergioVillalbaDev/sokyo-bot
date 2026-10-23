const mongoose = require('mongoose');

// El registro de una sanción aplicada. Guarda TODO para auditoría: a quién, quién
// la puso, tipo/acción, motivo, pruebas, cuándo, cuándo expira y si fue revocada.
const SancionSchema = new mongoose.Schema({
    guildId: { type: String, required: true },

    // Usuario sancionado (guardamos tag/avatar por si luego sale del servidor).
    usuarioId: { type: String, required: true },
    usuarioTag: { type: String, default: null },
    usuarioAvatar: { type: String, default: null },

    // Moderador que la aplicó.
    moderadorId: { type: String, default: null },
    moderadorTag: { type: String, default: 'Panel Web' },

    tipoNombre: { type: String, default: null },                 // nombre del tipo en ese momento
    accion: { type: String, enum: ['aviso', 'timeout', 'expulsion', 'ban'], required: true },
    motivo: { type: String, default: '' },
    duracionMin: { type: Number, default: 0 },
    pruebas: { type: [String], default: [] },                    // URLs externas o /uploads/...

    fecha: { type: Date, default: Date.now },
    expiraEn: { type: Date, default: null },                     // ban temporal / timeout

    // Estado: una sanción "activa" (ban en vigor) la puede levantar el barredor o el moderador.
    activa: { type: Boolean, default: false },
    revocada: { type: Boolean, default: false },
    revocadaPor: { type: String, default: null },
    revocadaFecha: { type: Date, default: null },
}, { timestamps: true });

SancionSchema.index({ guildId: 1, fecha: -1 });
SancionSchema.index({ accion: 1, activa: 1, expiraEn: 1 }); // para el barredor de bans temporales

module.exports = mongoose.model('Sancion', SancionSchema);
