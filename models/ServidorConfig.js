const mongoose = require('mongoose');

const servidorSchema = new mongoose.Schema({
    guildId: { 
        type: String, 
        required: true, 
        unique: true 
    },
    canalTicketsId: { 
        type: String, 
        required: true 
    },
    // NUEVO: La lista de opciones que saldrán en el menú desplegable
    motivos: {
        type: [String],
        default: ['Fallo Técnico', 'Reportar Usuario', 'Duda de Pago'] // Unos por defecto
    }
});

module.exports = mongoose.model('ServidorConfig', servidorSchema);