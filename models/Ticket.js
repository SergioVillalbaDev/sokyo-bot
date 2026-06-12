const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
    canalId: { type: String, required: true, unique: true },
    creadorId: { type: String, required: true },
    creadorNombre: { type: String, required: true },
    
    // --- AQUÍ ESTÁ EL CAMPO QUE FALTABA ---
    motivo: { type: String, default: 'Sin especificar' }, 
    
    fechaCreacion: { type: Date, default: Date.now },
    estado: { type: String, default: 'Abierto' },
    visibleWeb: { type: Boolean, default: true },
    
    // 1. ASIGNACIÓN (CLAIMING)
    asignadoA: { type: String, default: null },
    asignadoNombre: { type: String, default: null },

    // 2. PRIORIDADES Y SLAs 
    prioridad: { type: String, default: 'Normal' }, 
    ultimaInteractStaff: { type: Date, default: Date.now },

    // 3. NOTAS INTERNAS
    notasInternas: [{
        contenido: String,
        autor: String,
        fecha: { type: Date, default: Date.now }
    }],

    // 4. ENCUESTA DE SATISFACCIÓN (CSAT)
    valoracionCSAT: { type: Number, default: null },
    comentarioCSAT: { type: String, default: null }
});

module.exports = mongoose.model('Ticket', TicketSchema);