const mongoose = require('mongoose');

const mensajeSchema = new mongoose.Schema({
    ticketId: { type: String, required: true },
    usuario: { type: String, required: true },
    usuarioId: { type: String, required: true },
    contenido: { type: String, default: '' },
    imagenes: { type: [String], default: [] }, 
    fecha: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Mensaje', mensajeSchema);