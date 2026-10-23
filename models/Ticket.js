const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    canalId: { type: String, required: true, unique: true },
    creadorId: { type: String, required: true },
    creadorNombre: { type: String, required: true },
    creadorAvatar: { type: String, default: null },
    
    motivo: { type: String, default: 'Not specified' }, 
    titulo: { type: String, default: 'Support Ticket' },
    descripcion: { type: String, default: 'No description' },
    
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
    etiquetas: { type: [String], default: [] },
    visibleWeb: { type: Boolean, default: true },
    valoracionCSAT: { type: Number, default: null }
});

// El panel filtra tickets por servidor + estado y los ordena por fecha; las
// vistas de usuario buscan por creador. Sin estos índices cada listado escanea
// toda la colección.
ticketSchema.index({ guildId: 1, estado: 1, fechaCreacion: -1 });
ticketSchema.index({ guildId: 1, creadorId: 1 });

module.exports = mongoose.model('Ticket', ticketSchema);