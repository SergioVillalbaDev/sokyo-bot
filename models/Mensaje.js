const mongoose = require('mongoose');

const mensajeSchema = new mongoose.Schema({
    ticketId: { type: String, required: true },
    usuario: { type: String, required: true },
    usuarioId: { type: String, required: true },
    contenido: { type: String, default: '' },
    imagenes: { type: [String], default: [] },
    desdeWeb: { type: Boolean, default: false },
    fecha: { type: Date, default: Date.now }
});

mensajeSchema.index({ ticketId: 1, fecha: 1 });

module.exports = mongoose.model('Mensaje', mensajeSchema);