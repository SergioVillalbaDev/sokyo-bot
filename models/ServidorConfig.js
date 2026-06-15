const mongoose = require('mongoose');

const ServidorConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    motivos: { 
        type: [{ nombre: String, urgencia: String }], 
        default: [
            { nombre: 'Soporte General', urgencia: 'Normal' },
            { nombre: 'Reportar Usuario', urgencia: 'Alta' },
            { nombre: 'Donaciones', urgencia: 'Baja' }
        ] 
    },
    
    // --- NUEVO SISTEMA DE URGENCIAS PERSONALIZADAS ---
    urgencias: {
        type: [{ nombre: String, color: String, nivel: Number }],
        default: [
            { nombre: 'Urgente', color: '#e74c3c', nivel: 4 },
            { nombre: 'Alta', color: '#e67e22', nivel: 3 },
            { nombre: 'Normal', color: '#3498db', nivel: 2 },
            { nombre: 'Baja', color: '#95a5a6', nivel: 1 }
        ]
    },

    mensajeSoporteTitulo: { type: String, default: '🎫 Soporte Técnico Activo' },
    mensajeSoporteDescripcion: { type: String, default: 'Haz clic en el botón de abajo para abrir un ticket de soporte.' },
    footerPersonalizado: { type: String, default: 'Sistema de Gestión Sokyo' },

    // --- PERSONALIZACIÓN / MARCA (Fase 2) ---
    colorEmbed: { type: String, default: '#5865F2' },                                  // color del panel !sokyo
    textoBoton: { type: String, default: '📩 Abrir Ticket' },                          // texto del botón del panel
    mensajeBienvenida: { type: String, default: 'Un miembro del equipo lo revisará en breve.' }, // nota al abrir ticket
    prefijo: { type: String, default: '!' },                                           // prefijo de comandos
    categoriaArchivados: { type: String, default: '🗄️ Tickets Archivados' },          // categoría de tickets cerrados

    // --- REGLAS Y CONTROL (Fase 3) ---
    rolStaffId: { type: String, default: null },              // rol que puede reclamar/cerrar (además de admins)
    categoriaTicketsId: { type: String, default: null },      // categoría de Discord donde se crean los tickets
    maxTicketsAbiertos: { type: Number, default: 0 },         // máx. tickets abiertos por usuario (0 = sin límite)
    autoCierreDias: { type: Number, default: 0 },             // cierre automático por inactividad (0 = desactivado)

    // --- AJUSTES DE COMPORTAMIENTO (Fase 1) ---
    // Todos los defaults reproducen el comportamiento que tenía el bot antes.
    ratingActivo: { type: Boolean, default: true },        // encuesta CSAT (estrellas) al cerrar
    enviarTranscript: { type: Boolean, default: true },    // mandar copia de la conversación por DM
    avisoCierreCanal: { type: Boolean, default: true },    // mensaje "ticket cerrado" en el canal
    pingSoporte: { type: Boolean, default: false },        // avisar a un rol al abrir un ticket
    rolSoporteId: { type: String, default: null },         // ID del rol a avisar
    logsActivos: {                                         // qué categorías de logs se registran
        entradas: { type: Boolean, default: true },
        salidas: { type: Boolean, default: true },
        mensajesBorrados: { type: Boolean, default: true },
        mensajesEditados: { type: Boolean, default: true },
        tickets: { type: Boolean, default: true },
    },

    esPremium: { type: Boolean, default: false },
    premiumHasta: { type: Date, default: null }
});

module.exports = mongoose.model('ServidorConfig', ServidorConfigSchema);