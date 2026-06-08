const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    guildId: String,
    canalId: String,
    creadorId: String,
    creadorNombre: String,
    motivo: { type: String, default: 'Sin especificar' },
    estado: { type: String, default: 'Abierto' },
    visibleWeb: { type: Boolean, default: true },
    
    // Registra el momento exacto de creación
    fechaCreacion: { 
        type: Date, 
        default: Date.now, 
        expires: 604800 // 7 días en segundos
    }
});

module.exports = mongoose.model('Ticket', ticketSchema);