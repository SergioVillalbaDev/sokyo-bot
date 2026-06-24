const mongoose = require('mongoose');

const mensajeSchema = new mongoose.Schema({
    ticketId: { type: String, required: true },
    usuario: { type: String, required: true },
    usuarioId: { type: String, required: true },
    contenido: { type: String, default: '' },
    imagenes: { type: [String], default: [] }, 
    fecha: { type: Date, default: Date.now }
});

// Se consulta SIEMPRE por ticketId (cargar la conversación de un ticket) y se
// ordena por fecha. Sin este índice, cada apertura de ticket escanea toda la
// colección de mensajes -> se arrastra al crecer.
mensajeSchema.index({ ticketId: 1, fecha: 1 });

module.exports = mongoose.model('Mensaje', mensajeSchema);