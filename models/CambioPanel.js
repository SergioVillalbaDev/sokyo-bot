const mongoose = require('mongoose');

// Historial de cambios del panel: cada vez que alguien guarda algo de la
// configuración del servidor se apunta qué cambió (antes y después), quién y
// cuándo, para poder verlo y «volver a como estaba». Se borran solos a los 90 días.
const CambioPanelSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    usuarioId: { type: String, default: null },
    usuarioNombre: { type: String, default: '' },
    fecha: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 },
    secciones: { type: [String], default: [] }, // pestañas del panel (navConfig.js) afectadas
    claves: { type: [String], default: [] },    // campos de ServidorConfig que cambiaron
    antes: { type: mongoose.Schema.Types.Mixed, default: {} },
    despues: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Si es un «deshacer», a qué cambio deshace. Si lo han deshecho, quién y cuándo.
    deshaceA: { type: mongoose.Schema.Types.ObjectId, default: null },
    deshechoPor: { type: String, default: null },
    deshechoEn: { type: Date, default: null },
}, { minimize: false });

CambioPanelSchema.index({ guildId: 1, fecha: -1 });

module.exports = mongoose.model('CambioPanel', CambioPanelSchema);
