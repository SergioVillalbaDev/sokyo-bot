const mongoose = require('mongoose');

const participanteSchema = new mongoose.Schema({
    id: String,
    username: String,
    avatar: String,
    rol: String // 'Creador' | 'Staff' | 'Invitado'
}, { _id: false });

const notaSchema = new mongoose.Schema({
    contenido: { type: String, required: true },
    autor: { type: String, default: 'Staff' },
    autorId: { type: String, default: null },
    fecha: { type: Date } // sin default: las notas antiguas no tenían fecha y no queremos inventarla
});

const ticketSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    canalId: { type: String, required: true, unique: true },
    numero: { type: Number, default: null }, // nº correlativo por servidor (#0001)
    mensajeControlId: { type: String, default: null }, // mensaje con el embed y los botones del ticket

    creadorId: { type: String, required: true },
    creadorNombre: { type: String, required: true },
    creadorAvatar: { type: String, default: null },

    motivo: { type: String, default: 'Sin especificar' },
    titulo: { type: String, default: 'Ticket de Soporte' },
    descripcion: { type: String, default: 'Sin descripción' },

    participantes: { type: [participanteSchema], default: [] },

    prioridad: { type: String, default: 'Normal' },
    estado: { type: String, enum: ['Abierto', 'Cerrado'], default: 'Abierto' },
    asignadoA: { type: String, default: null },
    asignadoNombre: { type: String, default: null },

    fechaCreacion: { type: Date, default: Date.now },
    fechaCierre: { type: Date, default: null },
    cerradoPor: { type: String, default: null },
    motivoCierre: { type: String, default: null },

    // Seguimiento de actividad (para saber quién debe responder)
    ultimaActividad: { type: Date, default: null },
    esperando: { type: String, enum: ['staff', 'usuario', null], default: 'staff' },
    ultimaInteractStaff: { type: Date, default: null },
    primeraRespuestaStaff: { type: Date, default: null },
    avisoInactividad: { type: Date, default: null }, // cuándo se avisó del cierre automático (null = sin aviso)

    notasInternas: { type: [notaSchema], default: [] },
    visibleWeb: { type: Boolean, default: true },
    canalEliminado: { type: Boolean, default: false },

    valoracionCSAT: { type: Number, min: 1, max: 5, default: null },
    comentarioCSAT: { type: String, default: null }
});

ticketSchema.index({ guildId: 1, fechaCreacion: -1 });
ticketSchema.index({ guildId: 1, creadorId: 1, estado: 1 });
ticketSchema.index({ creadorId: 1, fechaCreacion: -1 });

module.exports = mongoose.model('Ticket', ticketSchema);
