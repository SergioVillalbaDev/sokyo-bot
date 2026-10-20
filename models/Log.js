const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    categoria: { type: String, default: 'General' }, // Tickets | Mensajes Borrados | Mensajes Editados | Entradas | Salidas
    accion: { type: String, required: true },
    usuario: { type: String, required: true },
    usuarioId: { type: String, default: null },
    detalles: { type: String, default: '' },
    color: { type: String, default: '#3498db' },
    fecha: { type: Date, default: Date.now }
});

logSchema.index({ guildId: 1, fecha: -1 });
logSchema.index({ guildId: 1, categoria: 1, fecha: -1 });

module.exports = mongoose.model('Log', logSchema);
