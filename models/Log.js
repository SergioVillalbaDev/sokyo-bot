const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    categoria: { type: String, default: 'General' }, // para el filtro jiji
    accion: { type: String, required: true },
    usuario: { type: String, required: true },
    detalles: { type: String, default: '' },
    imagenes: { type: [String], default: [] }, // adjuntos del mensaje borrado/editado (si tenía)
    color: { type: String, default: '#3498db' },
    fecha: { type: Date, default: Date.now }
});

// La vista de logs filtra por servidor (y categoría) y ordena por fecha desc.
logSchema.index({ guildId: 1, fecha: -1 });
logSchema.index({ guildId: 1, categoria: 1, fecha: -1 });

module.exports = mongoose.model('Log', logSchema);