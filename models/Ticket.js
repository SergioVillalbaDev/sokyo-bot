const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    canalId: { type: String, required: true, unique: true },
    creadorId: { type: String, required: true },
    creadorNombre: { type: String, required: true },
    creadorAvatar: { type: String, default: null },
    
    motivo: { type: String, default: 'Sin especificar' }, 
    titulo: { type: String, default: 'Ticket de Soporte' },
    descripcion: { type: String, default: 'Sin descripción' },
    
    // --- NUEVO: LISTA DE IMPLICADOS ---
    participantes: { type: Array, default: [] }, 

    prioridad: { type: String, default: 'Normal' },
    estado: { type: String, default: 'Abierto' },
    asignadoA: { type: String, default: null },
    asignadoNombre: { type: String, default: null },
    fechaCreacion: { type: Date, default: Date.now },
    fechaCierre: { type: Date, default: null },
    ultimaInteractStaff: { type: Date, default: null },
    notasInternas: { type: Array, default: [] },
    visibleWeb: { type: Boolean, default: true },
    valoracionCSAT: { type: Number, default: null } 
});

module.exports = mongoose.model('Ticket', ticketSchema);