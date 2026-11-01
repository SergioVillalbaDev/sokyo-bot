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
    valoracionCSAT: { type: Number, default: null },

    // --- Seguimiento de actividad (métricas, SLA e inactividad) ---
    primeraRespuestaStaff: { type: Date, default: null },   // cuándo contestó el staff por 1ª vez
    ultimoMensajeFecha: { type: Date, default: null },
    ultimoMensajePor: { type: String, default: null },      // 'usuario' | 'staff'
    slaAvisado: { type: Boolean, default: false },          // ya se avisó al staff de que está sin atender
    inactividadAvisadaEn: { type: Date, default: null }     // ya se avisó al usuario de que se cerrará
});
ticketSchema.index({ guildId: 1, estado: 1 });
ticketSchema.index({ creadorId: 1, estado: 1 });

module.exports = mongoose.model('Ticket', ticketSchema);