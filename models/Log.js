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

module.exports = mongoose.model('Log', logSchema);