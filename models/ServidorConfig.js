const mongoose = require('mongoose');

const ServidorConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },

    // --- Categorías (motivos) que el usuario elige al abrir un ticket ---
    motivos: {
        type: [{ _id: false, nombre: String, urgencia: String }],
        default: [
            { nombre: 'Soporte General', urgencia: 'Normal' },
            { nombre: 'Reportar Usuario', urgencia: 'Alta' },
            { nombre: 'Donaciones', urgencia: 'Baja' }
        ]
    },

    // --- Niveles de urgencia personalizados (nivel más alto = más prioritario) ---
    urgencias: {
        type: [{ _id: false, nombre: String, color: String, nivel: Number }],
        default: [
            { nombre: 'Urgente', color: '#e74c3c', nivel: 4 },
            { nombre: 'Alta', color: '#e67e22', nivel: 3 },
            { nombre: 'Normal', color: '#3498db', nivel: 2 },
            { nombre: 'Baja', color: '#95a5a6', nivel: 1 }
        ]
    },

    // --- Marca blanca: textos y apariencia del panel de soporte ---
    mensajeSoporteTitulo: { type: String, default: '🎫 Soporte Técnico Activo' },
    mensajeSoporteDescripcion: { type: String, default: 'Haz clic en el botón de abajo para abrir un ticket de soporte.' },
    footerPersonalizado: { type: String, default: 'Sistema de Gestión Sokyo' },
    colorPanel: { type: String, default: '#5865F2' },
    textoBoton: { type: String, default: 'Abrir Ticket' },
    mensajeBienvenida: { type: String, default: 'Un miembro del equipo lo revisará en breve.' },

    // Dónde está publicado el panel, para poder actualizarlo al cambiar los textos
    panelCanalId: { type: String, default: null },
    panelMensajeId: { type: String, default: null },

    // --- Funcionamiento ---
    rolesStaff: { type: [String], default: [] },
    categoriaTicketsId: { type: String, default: null },
    canalTranscriptsId: { type: String, default: null },
    canalLogsId: { type: String, default: null },
    maxTicketsPorUsuario: { type: Number, default: 1, min: 1, max: 10 },
    contadorTickets: { type: Number, default: 0 },

    // --- Módulos activables desde el panel ---
    modulos: {
        valoraciones: { type: Boolean, default: true },   // encuesta de satisfacción por DM al cerrar
        transcriptDM: { type: Boolean, default: true },   // copia de la conversación por DM al cerrar
        mencionarStaff: { type: Boolean, default: true }, // menciona a los roles de staff al abrir un ticket
        logsMensajes: { type: Boolean, default: true },   // auditoría de mensajes editados/borrados
        logsMiembros: { type: Boolean, default: true }    // auditoría de entradas/salidas
    },

    // Última versión del bot anunciada con el aviso "Bot actualizado" (ver utils/anuncioActualizacion.js)
    ultimaVersionAnunciada: { type: String, default: null },

    esPremium: { type: Boolean, default: false },
    premiumHasta: { type: Date, default: null }
});

// Premium activo: marcado como premium y sin caducar.
ServidorConfigSchema.methods.premiumActivo = function () {
    return this.esPremium === true && (!this.premiumHasta || this.premiumHasta > new Date());
};

module.exports = mongoose.model('ServidorConfig', ServidorConfigSchema);
