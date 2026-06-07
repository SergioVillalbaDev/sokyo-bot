const moongoose = require('mongoose');

const mensajeSchema = new moongoose.Schema({
    ticketId: { type: String, required: true }, // La ID del ticket al que pertenece este mensaje
    usuarioId: { type: String, required: true }, // La ID del usuario que envió el mensaje
    usuario: { type: String, required: true }, // El nombre del usuario (para la web)
    contenido: { type: String, required: true }, // El contenido del mensaje
    fecha: { type: Date, default: Date.now } // La fecha en que se envió el mensaje
});

module.exports = moongoose.model('Mensaje', mensajeSchema);