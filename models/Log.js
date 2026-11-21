const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    categoria: { type: String, default: 'General' }, // para el filtro jiji
    accion: { type: String, required: true },
    usuario: { type: String, required: true },
    detalles: { type: String, default: '' },
    color: { type: String, default: '#3498db' },
    fecha: { type: Date, default: Date.now }
});

logSchema.index({ guildId: 1, fecha: -1 });

// Los logs guardan texto de mensajes: se borran solos tras LOG_RETENTION_DAYS días (por defecto 90; 0 = no borrar).
const dias = Number.parseInt(process.env.LOG_RETENTION_DAYS ?? '90', 10);
if (Number.isFinite(dias) && dias > 0) logSchema.index({ fecha: 1 }, { expireAfterSeconds: dias * 86400 });

module.exports = mongoose.model('Log', logSchema);