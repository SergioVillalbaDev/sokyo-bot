const mongoose = require('mongoose');

const mensajeSchema = new mongoose.Schema({
    ticketId: String,
    usuarioId: String,
    usuario: String,
    contenido: String,
    
    //Los mensajes también caducan a los 7 días
    fechaCreacion: { 
        type: Date, 
        default: Date.now, 
        expires: 604800 // 7 días en segundos
    }
});

module.exports = mongoose.model('Mensaje', mensajeSchema);