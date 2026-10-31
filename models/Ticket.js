const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    canalId: { type: String, required: true, unique: true },
    numero: { type: Number, default: null },
    creadorId: { type: String, required: true },
    creadorNombre: { type: String, required: true },
    creadorAvatar: { type: String, default: null },

    motivo: { type: String, default: 'Sin especificar' },
    motivoId: { type: String, default: null },
    titulo: { type: String, default: 'Ticket de Soporte' },
    descripcion: { type: String, default: 'Sin descripción' },
    respuestas: { type: [{ pregunta: String, respuesta: String, _id: false }], default: [] },

    participantes: { type: Array, default: [] },

    prioridad: { type: String, default: 'Normal' },
    estado: { type: String, default: 'Abierto' },
    asignadoA: { type: String, default: null },
    asignadoNombre: { type: String, default: null },
    fechaCreacion: { type: Date, default: Date.now },
    fechaCierre: { type: Date, default: null },
    primeraRespuestaStaff: { type: Date, default: null },
    ultimaInteractStaff: { type: Date, default: null },
    notasInternas: { type: Array, default: [] },
    visibleWeb: { type: Boolean, default: true },
    canalBorrado: { type: Boolean, default: false },
    valoracionCSAT: { type: Number, default: null },

    // Análisis de la IA (triaje al abrir y resumen al cerrar)
    ia: {
        idioma: { type: String, default: null },
        sentimiento: { type: String, default: null },
        resumen: { type: String, default: null },
        urgenciaSugerida: { type: String, default: null },
        motivoUrgencia: { type: String, default: null },
        resumenCierre: { type: String, default: null }
    }
});

ticketSchema.index({ guildId: 1, fechaCreacion: -1 });
ticketSchema.index({ guildId: 1, creadorId: 1, estado: 1 });

module.exports = mongoose.model('Ticket', ticketSchema);
